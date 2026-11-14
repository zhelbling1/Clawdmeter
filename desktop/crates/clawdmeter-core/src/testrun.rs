//! Did a shell tool call run a test suite, and did it pass?
//!
//! The hook (`clawdmeter hook event`) asks this after every `PostToolUse` and
//! `PostToolUseFailure` of a shell tool and, when the answer is clear, logs a
//! second events.log line `TestPass` or `TestFail`; the daemon turns that into
//! the payload's `e:"t"` / `e:"f"` and the device throws a party or goes
//! looking for the bug. Only the verdict leaves the hook, never the command or
//! its output.
//!
//! Conservative by design: an unknown command, an interrupted run, empty or
//! ambiguous output, and a failed exit whose output names no failing test are
//! all "no verdict" (`None`). Detection adapted from
//! <https://github.com/matejkrajcovic111-ctrl/Clawdmeter>.

/// Claude Code's shell tools, the only ones whose calls can run tests.
pub fn is_shell_tool(tool_name: &str) -> bool {
    matches!(tool_name, "Bash" | "PowerShell")
}

/// Splits a shell command on `&`, `|`, `;` and newlines outside quotes.
fn split_segments(command: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut quote: Option<char> = None;
    let mut start = 0;
    for (i, c) in command.char_indices() {
        match quote {
            Some(q) => {
                if c == q {
                    quote = None;
                }
            }
            None => match c {
                '"' | '\'' => quote = Some(c),
                '&' | '|' | ';' | '\n' | '\r' => {
                    out.push(&command[start..i]);
                    start = i + c.len_utf8();
                }
                _ => {}
            },
        }
    }
    out.push(&command[start..]);
    out
}

/// Lowercased program name without directory or script extension.
fn program_name(token: &str) -> String {
    let base = token
        .trim_matches(|c| c == '"' || c == '\'' || c == '(' || c == '&')
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    for ext in [".exe", ".cmd", ".bat", ".ps1"] {
        if let Some(stem) = base.strip_suffix(ext) {
            return stem.to_string();
        }
    }
    base
}

/// `NAME=value` (POSIX) or `$env:NAME=value` (PowerShell) before the program.
fn is_env_assignment(token: &str) -> bool {
    if token.starts_with('-') {
        return false;
    }
    match token.split_once('=') {
        Some((name, _)) => {
            let name = name.strip_prefix("$env:").unwrap_or(name);
            !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        }
        None => false,
    }
}

fn segment_is_test(segment: &str) -> bool {
    let mut toks: Vec<&str> = segment.split_whitespace().collect();
    while let Some(first) = toks.first() {
        if is_env_assignment(first) || matches!(*first, "sudo" | "time" | "env" | "call" | "(" | "&") {
            toks.remove(0);
        } else {
            break;
        }
    }
    if toks.is_empty() {
        return false;
    }
    let prog = program_name(toks[0]);
    let args: Vec<&str> = toks[1..].iter().map(|t| t.trim_matches(['"', '\''])).collect();
    let arg = |i: usize| args.get(i).copied().unwrap_or("");
    let runner = |s: &str| matches!(s, "jest" | "vitest");
    match prog.as_str() {
        "cargo" => {
            let i = usize::from(arg(0).starts_with('+'));
            matches!(arg(i), "test" | "nextest")
        }
        // `pio test` (also `pio test -d firmware -e native`).
        "pio" | "platformio" => arg(0) == "test",
        "pytest" | "py.test" | "jest" | "vitest" | "ctest" | "rspec" | "phpunit" => true,
        "python" | "python3" | "py" => arg(0) == "-m" && matches!(arg(1), "pytest" | "unittest"),
        "npm" | "pnpm" | "yarn" | "bun" => {
            matches!(arg(0), "test" | "t")
                || (matches!(arg(0), "run" | "run-script") && arg(1).starts_with("test"))
                || (matches!(arg(0), "exec" | "dlx") && runner(arg(1)))
                || (prog != "npm" && runner(arg(0)))
        }
        "npx" | "pnpx" | "bunx" => args.iter().find(|a| !a.starts_with('-')).is_some_and(|a| runner(a)),
        "go" | "dotnet" | "deno" | "mix" => arg(0) == "test",
        "mvn" | "mvnw" | "gradle" | "gradlew" | "make" => args.contains(&"test"),
        "bundle" => arg(0) == "exec" && arg(1) == "rspec",
        _ => false,
    }
}

/// True when a shell command runs a test suite.
pub fn is_test_command(command: &str) -> bool {
    split_segments(command).into_iter().any(segment_is_test)
}

/// Numbers N that appear as "N word" in the text.
fn counts_before(text: &str, word: &str) -> Vec<u64> {
    let needle = format!(" {word}");
    text.match_indices(&needle)
        .filter_map(|(i, _)| {
            let head = &text[..i];
            let digits = head.chars().rev().take_while(char::is_ascii_digit).count();
            if digits == 0 {
                return None;
            }
            head[head.len() - digits..].parse().ok()
        })
        .collect()
}

/// The last 16 KB: a summary line is at the end, and old output above it
/// (an earlier run in the same command) must not decide.
fn tail_16k(s: &str) -> &str {
    const MAX: usize = 16 * 1024;
    if s.len() <= MAX {
        return s;
    }
    let mut start = s.len() - MAX;
    while !s.is_char_boundary(start) {
        start += 1;
    }
    &s[start..]
}

fn has_fail_signal(text: &str) -> bool {
    if text.contains("test result: FAILED")
        || text.contains("error: test failed")
        || text.contains("could not compile")
        || text.contains("error[E")
        || text.contains("FAILED (failures=")
        || text.contains("FAILED (errors=")
        || text.contains("--- FAIL")
        || text.contains("[FAILED]")
        || text.contains("Failed!")
    {
        return true;
    }
    for line in text.lines() {
        let t = line.trim();
        if t.starts_with("FAIL ")
            || t.starts_with("FAIL\t")
            || t == "FAIL"
            || t.starts_with("FAILED ")
            || t.ends_with("... FAILED")
        {
            return true;
        }
        if t.starts_with('=')
            && t.ends_with('=')
            && (t.contains(" failed") || t.contains(" error") || t.contains("FAILURES"))
        {
            return true;
        }
    }
    counts_before(text, "failed").iter().any(|&n| n > 0)
}

fn has_pass_signal(text: &str) -> bool {
    let results: Vec<&str> = text.lines().map(str::trim).filter(|l| l.starts_with("test result:")).collect();
    if !results.is_empty() && results.iter().all(|l| l.starts_with("test result: ok")) {
        return true;
    }
    for line in text.lines() {
        let t = line.trim();
        if t == "OK"
            || t.starts_with("OK (")
            || t == "PASS"
            || t.starts_with("ok  \t")
            || t.starts_with("ok\t")
            || t.starts_with("PASS ")
        {
            return true;
        }
    }
    text.contains("[PASSED]")
        || text.contains("Passed!")
        || (text.contains("test cases:") && text.contains(" succeeded"))
        || counts_before(text, "passed").iter().any(|&n| n > 0)
        || counts_before(text, "failed").contains(&0)
}

/// Verdict of a shell call that finished (`PostToolUse`, exit code 0):
/// `Some(true)` passed, `Some(false)` failed (a test runner piped into
/// `tail` exits 0 whatever happened), `None` when it isn't a test run, was
/// interrupted or the output is unclear.
pub fn test_outcome(command: &str, stdout: &str, stderr: &str, interrupted: bool) -> Option<bool> {
    if interrupted || !is_test_command(command) {
        return None;
    }
    let combined = format!("{stdout}\n{stderr}");
    let text = tail_16k(&combined);
    if has_fail_signal(text) {
        Some(false)
    } else if has_pass_signal(text) {
        Some(true)
    } else {
        None
    }
}

/// Verdict of a shell call that failed (`PostToolUseFailure`: a non-zero
/// exit, a timeout). Claude Code's `error` is `Exit code N` and the output.
/// Only a failure the output names counts (`Some(false)`): a non-zero exit
/// alone may be a later command in a chain (`cargo test && cargo clippy`), a
/// missing tool or a timeout, and is no verdict.
pub fn failure_outcome(command: &str, error: &str, interrupted: bool) -> Option<bool> {
    if interrupted || !is_test_command(command) {
        return None;
    }
    has_fail_signal(tail_16k(error)).then_some(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_tools() {
        assert!(is_shell_tool("Bash"));
        assert!(is_shell_tool("PowerShell"));
        assert!(!is_shell_tool("Read"));
        assert!(!is_shell_tool("BashOutput"));
    }

    #[test]
    fn detects_test_commands() {
        for c in [
            "cargo test",
            "cargo test -p foo --release",
            "cargo +nightly test",
            "cargo nextest run",
            "pio test -e native",
            "pio test -d firmware -e native -f test_director",
            "pytest -q",
            "python -m pytest tests/",
            "python3 -m unittest discover",
            "npm test",
            "npm run test",
            "npm run test:unit",
            "pnpm test",
            "yarn test",
            "bun test",
            "npx jest --ci",
            "npx -y vitest run",
            "jest",
            "vitest run",
            "go test ./...",
            "dotnet test",
            "mvn clean test",
            "gradle test",
            "./gradlew test",
            "ctest --output-on-failure",
            "make test",
            "rspec spec/",
            "bundle exec rspec",
            "vendor/bin/phpunit",
            "mix test",
            "deno test",
            "cd desktop && cargo test 2>&1",
            "cd x; cargo test | tail -20",
            "RUST_LOG=debug cargo test",
            "$env:Path='x'; cd E:\\p; cargo test -p a",
            "$env:RUST_BACKTRACE=1; cargo test",
            "cargo build && cargo test",
            "& \"$env:USERPROFILE\\.pio-venv\\Scripts\\pio.exe\" test -d firmware -e native",
            "cargo test --workspace 2>&1 | Select-Object -Last 30",
        ] {
            assert!(is_test_command(c), "{c}");
        }
    }

    #[test]
    fn rejects_non_test_commands() {
        for c in [
            "git commit -m \"test\"",
            "echo test",
            "cat test.txt",
            "cargo build",
            "cargo clippy --all-targets",
            "npm install",
            "npm run build",
            "go build ./...",
            "ls tests/",
            "echo \"a && cargo test\"",
            "pio run -e native",
            "",
        ] {
            assert!(!is_test_command(c), "{c}");
        }
    }

    fn out(cmd: &str, so: &str, se: &str) -> Option<bool> {
        test_outcome(cmd, so, se, false)
    }

    #[test]
    fn cargo_pass_and_fail() {
        let ok = "running 3 tests\ntest a ... ok\ntest b ... ok\n\ntest result: ok. 3 passed; 0 failed; 0 ignored\n";
        assert_eq!(out("cargo test", ok, ""), Some(true));
        let bad =
            "running 2 tests\ntest a ... ok\ntest b ... FAILED\n\ntest result: FAILED. 1 passed; 1 failed; 0 ignored\n";
        assert_eq!(out("cargo test", bad, ""), Some(false));
        let two = "test result: ok. 3 passed; 0 failed\ntest result: FAILED. 0 passed; 1 failed\n";
        assert_eq!(out("cargo test", two, ""), Some(false));
        let stderr = "error[E0425]: cannot find value `x`\nerror: could not compile `foo` (lib test)\n";
        assert_eq!(out("cargo test", "", stderr), Some(false));
        assert_eq!(out("cargo test", "", "error: test failed, to rerun pass `--lib`"), Some(false));
    }

    #[test]
    fn pytest_cases() {
        let ok = "collected 4 items\n\ntests/test_a.py ....\n\n===== 4 passed in 0.12s =====\n";
        assert_eq!(out("pytest", ok, ""), Some(true));
        assert_eq!(out("pytest -q", "....\n4 passed in 0.10s\n", ""), Some(true));
        let bad = "===== FAILURES =====\n___ test_x ___\n===== 1 failed, 3 passed in 0.2s =====\n";
        assert_eq!(out("python -m pytest", bad, ""), Some(false));
        let err = "==== 1 error in 0.05s ====\n";
        assert_eq!(out("pytest", err, ""), Some(false));
    }

    #[test]
    fn unittest_cases() {
        let ok = "..\n------------------\nRan 2 tests in 0.001s\n\nOK\n";
        assert_eq!(out("python -m unittest", "", ok), Some(true));
        let bad = "Ran 2 tests in 0.001s\n\nFAILED (failures=1)\n";
        assert_eq!(out("python -m unittest", "", bad), Some(false));
    }

    #[test]
    fn jest_vitest_cases() {
        let ok = "PASS src/a.test.js\n\nTest Suites: 1 passed, 1 total\nTests:       5 passed, 5 total\n";
        assert_eq!(out("npx jest", ok, ""), Some(true));
        let bad = "FAIL src/a.test.js\n\nTests:       1 failed, 4 passed, 5 total\n";
        assert_eq!(out("npm test", bad, ""), Some(false));
        let vok = " Test Files  2 passed (2)\n      Tests  7 passed (7)\n";
        assert_eq!(out("npx vitest run", vok, ""), Some(true));
        let vbad = " Test Files  1 failed | 1 passed (2)\n";
        assert_eq!(out("vitest run", vbad, ""), Some(false));
    }

    #[test]
    fn go_cases() {
        let ok = "ok  \tgithub.com/x/y\t0.012s\n";
        assert_eq!(out("go test ./...", ok, ""), Some(true));
        assert_eq!(out("go test", "PASS\n", ""), Some(true));
        let bad = "--- FAIL: TestA (0.00s)\nFAIL\ngithub.com/x/y\t0.01s\nFAIL\tgithub.com/x/y\t0.01s\n";
        assert_eq!(out("go test ./...", bad, ""), Some(false));
        assert_eq!(out("go test", "FAIL\n", ""), Some(false));
    }

    #[test]
    fn pio_and_dotnet() {
        let ok = "test/test_main.cpp:12: test_a [PASSED]\n1 test cases: 1 succeeded in 00:00:01.2\n";
        assert_eq!(out("pio test -e native", ok, ""), Some(true));
        let bad = "test/test_main.cpp:12: test_a [FAILED]\n1 test cases: 1 failed, 0 succeeded\n";
        assert_eq!(out("pio test", bad, ""), Some(false));
        let counts = "5 test cases: 3 failed, 2 succeeded in 00:00:03\n";
        assert_eq!(out("pio test", counts, ""), Some(false));
        let dok = "Passed!  - Failed:     0, Passed:    12, Skipped:     0, Total:    12\n";
        assert_eq!(out("dotnet test", dok, ""), Some(true));
        let dbad = "Failed!  - Failed:     1, Passed:    11, Skipped:     0, Total:    12\n";
        assert_eq!(out("dotnet test", dbad, ""), Some(false));
    }

    #[test]
    fn conservative_none() {
        assert_eq!(out("echo hi", "ok\n", ""), None);
        assert_eq!(out("cargo build", "test result: ok", ""), None);
        assert_eq!(test_outcome("cargo test", "test result: ok. 1 passed", "", true), None);
        assert_eq!(out("cargo test", "", ""), None);
        assert_eq!(out("npm test", "starting...\n", ""), None);
        assert_eq!(out("cargo test", "running 0 tests\n", ""), None);
    }

    #[test]
    fn only_tail_matters() {
        let old_fail = "test result: FAILED. 0 passed; 1 failed\n";
        let filler = "x".repeat(20_000);
        let tail = "\ntest result: ok. 3 passed; 0 failed\n";
        let so = format!("{old_fail}{filler}{tail}");
        assert_eq!(out("cargo test", &so, ""), Some(true));
        let multi = "\u{e9}".repeat(10_000);
        assert_eq!(out("cargo test", &multi, ""), None);
    }

    // PostToolUseFailure: `Exit code N` and the interleaved output.
    #[test]
    fn failures() {
        let cargo = "Exit code 101\nrunning 2 tests\ntest b ... FAILED\n\ntest result: FAILED. 1 passed; 1 failed\n";
        assert_eq!(failure_outcome("cargo test", cargo, false), Some(false));
        let pio = "Exit code 1\ntest/test_director/test_main.cpp:340: test_fuzz [FAILED]\n";
        assert_eq!(failure_outcome("pio test -e native", pio, false), Some(false));
        // A chain that failed after the tests passed, a missing tool, a
        // timeout: no verdict.
        let later = "Exit code 1\ntest result: ok. 3 passed; 0 failed\nerror: unused import\n";
        assert_eq!(failure_outcome("cargo test && cargo clippy", later, false), None);
        assert_eq!(failure_outcome("pytest", "Exit code 127\npytest: command not found", false), None);
        assert_eq!(failure_outcome("cargo test", "Command timed out after 2m 0s", false), None);
        assert_eq!(failure_outcome("cargo test", cargo, true), None);
        assert_eq!(failure_outcome("cargo build", cargo, false), None);
    }
}
