//! Types the board's buttons on this computer when they come over the USB
//! link instead of Bluetooth (`docs/protocol.md`, "USB serial link"): the
//! ESP32-C6's USB port can't be a USB keyboard, so with no Bluetooth host
//! subscribed the firmware sends each keyboard report (`{"kb":…}`) and media
//! key (`{"cc":…}`) as a line on the serial link, and this module injects
//! them.
//!
//! [`KeyState`] is the pure part: it diffs successive reports into key-down
//! and key-up events (modifiers down before keys, keys up before modifiers),
//! repeats the last key pressed while it stays down (injected input gets no
//! auto-repeat, and Claude Code's Space push-to-talk sees a held key only
//! through the terminal's repeats), and lets go of everything when no update
//! comes for [`STUCK_AFTER`] (the firmware resends a held report every
//! second, so silence means the link or a release got lost).
//!
//! [`KeyInjector`] runs it on its own thread, so the daemon's runtime never
//! waits on it. Windows injects with `SendInput` (virtual-key codes, with the
//! scan code alongside); other systems don't type yet and log that once.

use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::time::{Duration, Instant};

use clawdmeter_flash::link::{KeyboardReport, LinkEvent};

/// With anything held, no update for this long lets go of it all. The
/// firmware resends a held report every second.
pub const STUCK_AFTER: Duration = Duration::from_secs(3);

/// One key, in the board's terms.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Key {
    /// A HID keyboard usage (0x04 A … 0x73 F24).
    Usage(u8),
    /// A modifier bit of the report: 0 Left Ctrl, 1 Left Shift, 2 Left Alt,
    /// 3 Left GUI, 4–7 the same on the right.
    Modifier(u8),
    /// A HID consumer usage (media keys).
    Consumer(u16),
}

/// What to inject.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyAction {
    /// Key down (again, for a typematic repeat).
    Down(Key),
    /// Key up.
    Up(Key),
}

/// Typematic timing: how long a key is held before it repeats, then how
/// often.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Typematic {
    /// Hold before the first repeat.
    pub delay: Duration,
    /// Between repeats.
    pub interval: Duration,
}

impl Default for Typematic {
    /// Windows' defaults: 500 ms, then about 30 a second.
    fn default() -> Self {
        Typematic::from_windows(1, 31)
    }
}

impl Typematic {
    /// From Windows' `SPI_GETKEYBOARDDELAY` (0–3: 250 ms steps from 250 ms)
    /// and `SPI_GETKEYBOARDSPEED` (0–31: about 2.5 to 30 repeats a second).
    pub fn from_windows(delay: u32, speed: u32) -> Self {
        let delay = Duration::from_millis(250 * (u64::from(delay.min(3)) + 1));
        let rate = 2.5 + f64::from(speed.min(31)) * (27.5 / 31.0);
        Typematic { delay, interval: Duration::from_secs_f64(1.0 / rate) }
    }
}

/// The key being repeated and when it repeats next.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Repeat {
    usage: u8,
    next: Instant,
    interval: Duration,
}

/// What the board holds, as last injected.
#[derive(Debug, Default)]
pub struct KeyState {
    report: KeyboardReport,
    consumer: u16,
    repeat: Option<Repeat>,
    last_update: Option<Instant>,
}

/// The keys of a report, without zeros and repeats.
fn keys_of(r: &KeyboardReport) -> impl Iterator<Item = u8> + '_ {
    r.keys.iter().enumerate().filter(|&(i, &k)| k != 0 && !r.keys[..i].contains(&k)).map(|(_, &k)| k)
}

impl KeyState {
    /// Something is held.
    pub fn holding(&self) -> bool {
        !self.report.is_empty() || self.consumer != 0
    }

    /// A new keyboard report (the whole state). `typematic` times the repeat
    /// of a key it presses.
    pub fn on_report(&mut self, r: KeyboardReport, now: Instant, typematic: Typematic) -> Vec<KeyAction> {
        self.last_update = Some(now);
        let old = self.report;
        let mut out = Vec::new();
        // Keys up first, then modifiers up, then modifiers down, then keys
        // down: a chord's modifiers are in place before its key.
        out.extend(keys_of(&old).filter(|k| !r.keys.contains(k)).map(|k| KeyAction::Up(Key::Usage(k))));
        let (up, down) = (old.modifiers & !r.modifiers, r.modifiers & !old.modifiers);
        out.extend((0..8).filter(|b| up & (1 << b) != 0).map(|b| KeyAction::Up(Key::Modifier(b))));
        out.extend((0..8).filter(|b| down & (1 << b) != 0).map(|b| KeyAction::Down(Key::Modifier(b))));
        let pressed: Vec<u8> = keys_of(&r).filter(|k| !old.keys.contains(k)).collect();
        out.extend(pressed.iter().map(|&k| KeyAction::Down(Key::Usage(k))));
        // Like a keyboard: the last key pressed repeats, and only until it's
        // let go (an older key still down doesn't take over).
        if let Some(&k) = pressed.last() {
            self.repeat = Some(Repeat { usage: k, next: now + typematic.delay, interval: typematic.interval });
        } else if self.repeat.is_some_and(|rep| !r.keys.contains(&rep.usage)) {
            self.repeat = None;
        }
        self.report = r;
        out
    }

    /// A media key down, or `0`: released.
    pub fn on_consumer(&mut self, usage: u16, now: Instant) -> Vec<KeyAction> {
        self.last_update = Some(now);
        let mut out = Vec::new();
        if usage != self.consumer {
            if self.consumer != 0 {
                out.push(KeyAction::Up(Key::Consumer(self.consumer)));
            }
            if usage != 0 {
                out.push(KeyAction::Down(Key::Consumer(usage)));
            }
            self.consumer = usage;
        }
        out
    }

    /// Repeats that are due, or everything up if the board went quiet while
    /// holding keys.
    pub fn on_tick(&mut self, now: Instant) -> Vec<KeyAction> {
        if self.holding() && self.last_update.is_some_and(|t| now.duration_since(t) >= STUCK_AFTER) {
            log::warn!("keys: no word from the board for {} s with keys held; letting go", STUCK_AFTER.as_secs());
            return self.release_all();
        }
        let mut out = Vec::new();
        if let Some(rep) = &mut self.repeat {
            if now >= rep.next {
                out.push(KeyAction::Down(Key::Usage(rep.usage)));
                // Catch up without a burst after a stall: the next one is an
                // interval from now.
                rep.next = (rep.next + rep.interval).max(now + rep.interval / 2);
            }
        }
        out
    }

    /// Let go of everything held.
    pub fn release_all(&mut self) -> Vec<KeyAction> {
        let mut out = self.on_report(KeyboardReport::default(), Instant::now(), Typematic::default());
        out.extend(self.on_consumer(0, Instant::now()));
        self.repeat = None;
        self.last_update = None;
        out
    }

    /// When [`KeyState::on_tick`] has something to do next.
    pub fn next_deadline(&self) -> Option<Instant> {
        let stuck = self.holding().then(|| self.last_update.map(|t| t + STUCK_AFTER)).flatten();
        let repeat = self.repeat.map(|r| r.next);
        match (stuck, repeat) {
            (Some(a), Some(b)) => Some(a.min(b)),
            (a, b) => a.or(b),
        }
    }
}

/// A Windows key: virtual-key code, set-1 scan code, extended (E0) flag.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WinKey {
    /// `VK_*`.
    pub vk: u16,
    /// Scan code (without the E0 prefix).
    pub scan: u16,
    /// An E0 key (arrows, the navigation block, right Ctrl/Alt, Windows keys,
    /// media keys).
    pub ext: bool,
}

const fn wk(vk: u16, scan: u16) -> Option<WinKey> {
    Some(WinKey { vk, scan, ext: false })
}

const fn wx(vk: u16, scan: u16) -> Option<WinKey> {
    Some(WinKey { vk, scan, ext: true })
}

/// HID keyboard usages 0x04–0x73 → Windows keys, by the key's US-layout
/// label (the app's key table is US-layout too). `None`: no Windows key.
const USAGES: [Option<WinKey>; 0x74 - 0x04] = [
    // 0x04–0x1D: A–Z.
    wk(0x41, 0x1E),
    wk(0x42, 0x30),
    wk(0x43, 0x2E),
    wk(0x44, 0x20),
    wk(0x45, 0x12),
    wk(0x46, 0x21),
    wk(0x47, 0x22),
    wk(0x48, 0x23),
    wk(0x49, 0x17),
    wk(0x4A, 0x24),
    wk(0x4B, 0x25),
    wk(0x4C, 0x26),
    wk(0x4D, 0x32),
    wk(0x4E, 0x31),
    wk(0x4F, 0x18),
    wk(0x50, 0x19),
    wk(0x51, 0x10),
    wk(0x52, 0x13),
    wk(0x53, 0x1F),
    wk(0x54, 0x14),
    wk(0x55, 0x16),
    wk(0x56, 0x2F),
    wk(0x57, 0x11),
    wk(0x58, 0x2D),
    wk(0x59, 0x15),
    wk(0x5A, 0x2C),
    // 0x1E–0x27: 1–9, 0.
    wk(0x31, 0x02),
    wk(0x32, 0x03),
    wk(0x33, 0x04),
    wk(0x34, 0x05),
    wk(0x35, 0x06),
    wk(0x36, 0x07),
    wk(0x37, 0x08),
    wk(0x38, 0x09),
    wk(0x39, 0x0A),
    wk(0x30, 0x0B),
    // 0x28 Enter, Esc, Backspace, Tab, Space.
    wk(0x0D, 0x1C),
    wk(0x1B, 0x01),
    wk(0x08, 0x0E),
    wk(0x09, 0x0F),
    wk(0x20, 0x39),
    // 0x2D - = [ ] \, 0x32 non-US #, ; ' ` , . /
    wk(0xBD, 0x0C),
    wk(0xBB, 0x0D),
    wk(0xDB, 0x1A),
    wk(0xDD, 0x1B),
    wk(0xDC, 0x2B),
    wk(0xDC, 0x2B),
    wk(0xBA, 0x27),
    wk(0xDE, 0x28),
    wk(0xC0, 0x29),
    wk(0xBC, 0x33),
    wk(0xBE, 0x34),
    wk(0xBF, 0x35),
    // 0x39 Caps Lock.
    wk(0x14, 0x3A),
    // 0x3A–0x45: F1–F12.
    wk(0x70, 0x3B),
    wk(0x71, 0x3C),
    wk(0x72, 0x3D),
    wk(0x73, 0x3E),
    wk(0x74, 0x3F),
    wk(0x75, 0x40),
    wk(0x76, 0x41),
    wk(0x77, 0x42),
    wk(0x78, 0x43),
    wk(0x79, 0x44),
    wk(0x7A, 0x57),
    wk(0x7B, 0x58),
    // 0x46 Print Screen, Scroll Lock, Pause.
    wx(0x2C, 0x37),
    wk(0x91, 0x46),
    wk(0x13, 0x45),
    // 0x49 Insert, Home, PgUp, Delete, End, PgDn, Right, Left, Down, Up.
    wx(0x2D, 0x52),
    wx(0x24, 0x47),
    wx(0x21, 0x49),
    wx(0x2E, 0x53),
    wx(0x23, 0x4F),
    wx(0x22, 0x51),
    wx(0x27, 0x4D),
    wx(0x25, 0x4B),
    wx(0x28, 0x50),
    wx(0x26, 0x48),
    // 0x53 Num Lock, keypad / * - + Enter.
    wx(0x90, 0x45),
    wx(0x6F, 0x35),
    wk(0x6A, 0x37),
    wk(0x6D, 0x4A),
    wk(0x6B, 0x4E),
    wx(0x0D, 0x1C),
    // 0x59–0x63: keypad 1–9, 0, `.`.
    wk(0x61, 0x4F),
    wk(0x62, 0x50),
    wk(0x63, 0x51),
    wk(0x64, 0x4B),
    wk(0x65, 0x4C),
    wk(0x66, 0x4D),
    wk(0x67, 0x47),
    wk(0x68, 0x48),
    wk(0x69, 0x49),
    wk(0x60, 0x52),
    wk(0x6E, 0x53),
    // 0x64 non-US \, Application (Menu), 0x66 Power, 0x67 keypad = (none).
    wk(0xE2, 0x56),
    wx(0x5D, 0x5D),
    None,
    None,
    // 0x68–0x73: F13–F24.
    wk(0x7C, 0x64),
    wk(0x7D, 0x65),
    wk(0x7E, 0x66),
    wk(0x7F, 0x67),
    wk(0x80, 0x68),
    wk(0x81, 0x69),
    wk(0x82, 0x6A),
    wk(0x83, 0x6B),
    wk(0x84, 0x6C),
    wk(0x85, 0x6D),
    wk(0x86, 0x6E),
    wk(0x87, 0x76),
];

/// Modifier bits → left/right Ctrl, Shift, Alt, Windows.
const MODIFIERS: [WinKey; 8] = [
    WinKey { vk: 0xA2, scan: 0x1D, ext: false }, // VK_LCONTROL
    WinKey { vk: 0xA0, scan: 0x2A, ext: false }, // VK_LSHIFT
    WinKey { vk: 0xA4, scan: 0x38, ext: false }, // VK_LMENU
    WinKey { vk: 0x5B, scan: 0x5B, ext: true },  // VK_LWIN
    WinKey { vk: 0xA3, scan: 0x1D, ext: true },  // VK_RCONTROL
    WinKey { vk: 0xA1, scan: 0x36, ext: false }, // VK_RSHIFT
    WinKey { vk: 0xA5, scan: 0x38, ext: true },  // VK_RMENU
    WinKey { vk: 0x5C, scan: 0x5C, ext: true },  // VK_RWIN
];

/// The Windows key for one of the board's keys. Media keys: the six the app
/// offers (`clawdmeter_core::buttons::MediaKey`).
pub fn win_key(key: Key) -> Option<WinKey> {
    match key {
        Key::Usage(u) => USAGES.get(usize::from(u).checked_sub(0x04)?).copied().flatten(),
        Key::Modifier(b) => MODIFIERS.get(usize::from(b)).copied(),
        Key::Consumer(u) => match u {
            0xCD => wx(0xB3, 0x22), // VK_MEDIA_PLAY_PAUSE
            0xB6 => wx(0xB1, 0x10), // VK_MEDIA_PREV_TRACK
            0xB5 => wx(0xB0, 0x19), // VK_MEDIA_NEXT_TRACK
            0xEA => wx(0xAE, 0x2E), // VK_VOLUME_DOWN
            0xE9 => wx(0xAF, 0x30), // VK_VOLUME_UP
            0xE2 => wx(0xAD, 0x20), // VK_VOLUME_MUTE
            _ => None,
        },
    }
}

/// Puts key events into the system.
trait Backend {
    fn inject(&mut self, actions: &[KeyAction]);
    fn typematic(&self) -> Typematic;
}

#[cfg(windows)]
mod sys {
    use super::{win_key, Backend, KeyAction, Typematic};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SystemParametersInfoW, SPI_GETKEYBOARDDELAY, SPI_GETKEYBOARDSPEED,
    };

    /// `SendInput`.
    #[derive(Default)]
    pub struct Native {
        warned: bool,
    }

    impl Backend for Native {
        fn inject(&mut self, actions: &[KeyAction]) {
            let inputs: Vec<INPUT> = actions
                .iter()
                .filter_map(|a| {
                    let (key, up) = match *a {
                        KeyAction::Down(k) => (k, false),
                        KeyAction::Up(k) => (k, true),
                    };
                    let w = win_key(key)?;
                    let mut flags = 0;
                    if w.ext {
                        flags |= KEYEVENTF_EXTENDEDKEY;
                    }
                    if up {
                        flags |= KEYEVENTF_KEYUP;
                    }
                    Some(INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT { wVk: w.vk, wScan: w.scan, dwFlags: flags, time: 0, dwExtraInfo: 0 },
                        },
                    })
                })
                .collect();
            if inputs.is_empty() {
                return;
            }
            // SAFETY: `inputs` is a live slice of initialized INPUTs, and the
            // size passed is one INPUT's.
            let sent = unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32) };
            if (sent as usize) < inputs.len() && !self.warned {
                self.warned = true;
                log::warn!(
                    "keys: Windows took {sent} of {} key events (another program blocked the input)",
                    inputs.len()
                );
            }
        }

        fn typematic(&self) -> Typematic {
            let read = |action| {
                let mut v: u32 = 0;
                // SAFETY: both actions write one u32 (DWORD) to `pvparam`.
                let ok = unsafe { SystemParametersInfoW(action, 0, (&raw mut v).cast(), 0) };
                (ok != 0).then_some(v)
            };
            match (read(SPI_GETKEYBOARDDELAY), read(SPI_GETKEYBOARDSPEED)) {
                (Some(d), Some(s)) => Typematic::from_windows(d, s),
                _ => Typematic::default(),
            }
        }
    }
}

#[cfg(not(windows))]
mod sys {
    use super::{Backend, KeyAction, Typematic};

    /// Not typed on this system yet (macOS and Linux come later).
    #[derive(Default)]
    pub struct Native {
        warned: bool,
    }

    impl Backend for Native {
        fn inject(&mut self, actions: &[KeyAction]) {
            if !actions.is_empty() && !self.warned {
                self.warned = true;
                log::info!(
                    "keys: the board's buttons came over USB, but typing them is Windows-only so far; pair the board over Bluetooth for them"
                );
            }
        }

        fn typematic(&self) -> Typematic {
            Typematic::default()
        }
    }
}

/// The key thread's handle: send it the link's key events.
#[derive(Debug, Clone)]
pub struct KeyInjector {
    tx: Sender<LinkEvent>,
}

impl KeyInjector {
    /// Start the key thread. It ends (letting go of every key) once every
    /// sender is gone.
    pub fn spawn() -> Self {
        let (tx, rx) = mpsc::channel();
        let spawned = std::thread::Builder::new().name("clawdmeter-keys".into()).spawn(move || {
            let mut backend = sys::Native::default();
            run(rx, &mut backend);
        });
        if let Err(e) = spawned {
            log::warn!("keys: no key thread ({e}); the board's buttons won't type over USB");
        }
        KeyInjector { tx }
    }

    /// A sender for [`clawdmeter_flash::link::SerialLink::forward_keys`].
    pub fn sender(&self) -> Sender<LinkEvent> {
        self.tx.clone()
    }

    /// Pass on one event (anything but a key event is ignored).
    pub fn send(&self, ev: LinkEvent) {
        let _ = self.tx.send(ev);
    }
}

fn run(rx: Receiver<LinkEvent>, backend: &mut impl Backend) {
    let mut state = KeyState::default();
    let mut announced = false;
    loop {
        let ev = match state.next_deadline() {
            Some(at) => match rx.recv_timeout(at.saturating_duration_since(Instant::now())) {
                Ok(ev) => Some(ev),
                Err(RecvTimeoutError::Timeout) => None,
                Err(RecvTimeoutError::Disconnected) => break,
            },
            None => match rx.recv() {
                Ok(ev) => Some(ev),
                Err(_) => break,
            },
        };
        let now = Instant::now();
        let mut actions = match ev {
            Some(LinkEvent::Keyboard(r)) => state.on_report(r, now, backend.typematic()),
            Some(LinkEvent::Consumer(u)) => state.on_consumer(u, now),
            _ => Vec::new(),
        };
        if !announced && actions.iter().any(|a| matches!(a, KeyAction::Down(_))) {
            announced = true;
            log::info!(
                "keys: typing the board's buttons on this computer (they come over USB: no Bluetooth host has them)"
            );
        }
        actions.extend(state.on_tick(now));
        backend.inject(&actions);
    }
    backend.inject(&state.release_all());
}

#[cfg(test)]
mod tests {
    use super::*;
    use KeyAction::{Down, Up};

    fn report(modifiers: u8, keys: &[u8]) -> KeyboardReport {
        let mut r = KeyboardReport { modifiers, keys: [0; 6] };
        r.keys[..keys.len()].copy_from_slice(keys);
        r
    }

    const T: Typematic = Typematic { delay: Duration::from_millis(500), interval: Duration::from_millis(33) };
    const SPACE: Key = Key::Usage(0x2C);
    const TAB: Key = Key::Usage(0x2B);
    const LSHIFT: Key = Key::Modifier(1);
    const LCTRL: Key = Key::Modifier(0);

    #[test]
    fn a_chord_goes_modifiers_first_and_comes_up_key_first() {
        let mut s = KeyState::default();
        let t0 = Instant::now();
        // The firmware's Shift+Tab tap: Shift, Shift+Tab, Shift, nothing.
        assert_eq!(s.on_report(report(0x02, &[]), t0, T), [Down(LSHIFT)]);
        assert_eq!(s.on_report(report(0x02, &[0x2B]), t0, T), [Down(TAB)]);
        assert_eq!(s.on_report(report(0x02, &[]), t0, T), [Up(TAB)]);
        assert_eq!(s.on_report(report(0, &[]), t0, T), [Up(LSHIFT)]);
        assert!(!s.holding());
        // All at once, both ways.
        assert_eq!(s.on_report(report(0x03, &[0x10]), t0, T), [Down(LCTRL), Down(LSHIFT), Down(Key::Usage(0x10))]);
        assert_eq!(s.on_report(report(0, &[]), t0, T), [Up(Key::Usage(0x10)), Up(LCTRL), Up(LSHIFT)]);
        // The same report again (the firmware's keepalive) changes nothing.
        assert_eq!(s.on_report(report(0, &[0x2C]), t0, T), [Down(SPACE)]);
        assert!(s.on_report(report(0, &[0x2C]), t0, T).is_empty());
        // A key moving slot isn't a new press; a duplicate is one key.
        assert!(s.on_report(report(0, &[0, 0x2C, 0x2C]), t0, T).is_empty());
        assert_eq!(s.on_report(report(0, &[]), t0, T), [Up(SPACE)]);
    }

    #[test]
    fn a_held_key_repeats_until_released() {
        let mut s = KeyState::default();
        let t0 = Instant::now();
        s.on_report(report(0, &[0x2C]), t0, T);
        assert_eq!(s.next_deadline(), Some(t0 + T.delay));
        assert!(s.on_tick(t0 + Duration::from_millis(499)).is_empty());
        assert_eq!(s.on_tick(t0 + T.delay), [Down(SPACE)]);
        assert_eq!(s.next_deadline(), Some(t0 + T.delay + T.interval));
        assert_eq!(s.on_tick(t0 + T.delay + T.interval), [Down(SPACE)]);
        // A keepalive mid-repeat doesn't restart the delay.
        s.on_report(report(0, &[0x2C]), t0 + Duration::from_millis(1000), T);
        assert!(s.next_deadline().unwrap() < t0 + Duration::from_millis(1000));
        // Released: no more repeats, nothing to wake for.
        assert_eq!(s.on_report(report(0, &[]), t0 + Duration::from_millis(1100), T), [Up(SPACE)]);
        assert!(s.on_tick(t0 + Duration::from_millis(2000)).is_empty());
        assert_eq!(s.next_deadline(), None);
    }

    #[test]
    fn only_the_last_key_pressed_repeats_and_modifiers_dont() {
        let mut s = KeyState::default();
        let t0 = Instant::now();
        // Ctrl alone: no repeat.
        s.on_report(report(0x01, &[]), t0, T);
        assert!(s.on_tick(t0 + Duration::from_secs(1)).is_empty());
        // Ctrl+Space hold: Space repeats (with Ctrl still down).
        s.on_report(report(0x01, &[0x2C]), t0, T);
        assert_eq!(s.on_tick(t0 + T.delay), [Down(SPACE)]);
        // Tab joins: Tab repeats now, after its own delay.
        let t1 = t0 + Duration::from_millis(600);
        s.on_report(report(0x01, &[0x2C, 0x2B]), t1, T);
        assert!(s.on_tick(t1 + Duration::from_millis(100)).is_empty());
        assert_eq!(s.on_tick(t1 + T.delay), [Down(TAB)]);
        // Tab up, Space still down: Space doesn't start again.
        s.on_report(report(0x01, &[0x2C]), t1 + Duration::from_millis(700), T);
        assert!(s.on_tick(t1 + Duration::from_millis(900)).is_empty());
    }

    #[test]
    fn a_stall_doesnt_burst() {
        let mut s = KeyState::default();
        let t0 = Instant::now();
        s.on_report(report(0, &[0x2C]), t0, T);
        // The thread wakes late: one repeat, not a backlog.
        let late = t0 + Duration::from_millis(800);
        assert_eq!(s.on_tick(late), [Down(SPACE)]);
        assert!(s.on_tick(late).is_empty());
        assert!(s.next_deadline().unwrap() > late);
    }

    #[test]
    fn silence_lets_go_of_everything() {
        let mut s = KeyState::default();
        let t0 = Instant::now();
        s.on_report(report(0x02, &[0x2C]), t0, T);
        s.on_consumer(0xE9, t0);
        // Keepalives hold it.
        s.on_report(report(0x02, &[0x2C]), t0 + Duration::from_secs(2), T);
        assert!(!s.on_tick(t0 + Duration::from_secs(4)).contains(&Up(SPACE)));
        // Then nothing for STUCK_AFTER.
        let quiet = t0 + Duration::from_secs(2) + STUCK_AFTER;
        assert!(s.next_deadline().unwrap() <= quiet);
        assert_eq!(s.on_tick(quiet), [Up(SPACE), Up(LSHIFT), Up(Key::Consumer(0xE9))]);
        assert!(!s.holding());
        assert_eq!(s.next_deadline(), None);
        // Nothing held: silence is fine.
        assert!(s.on_tick(quiet + Duration::from_secs(60)).is_empty());
    }

    #[test]
    fn media_keys_press_and_release() {
        let mut s = KeyState::default();
        let t0 = Instant::now();
        assert_eq!(s.on_consumer(0xCD, t0), [Down(Key::Consumer(0xCD))]);
        assert!(s.on_consumer(0xCD, t0).is_empty());
        assert_eq!(s.on_consumer(0, t0), [Up(Key::Consumer(0xCD))]);
        assert!(s.on_consumer(0, t0).is_empty());
        // Another usage straight after one: the first comes up.
        s.on_consumer(0xEA, t0);
        assert_eq!(s.on_consumer(0xE9, t0), [Up(Key::Consumer(0xEA)), Down(Key::Consumer(0xE9))]);
        // No typematic for media keys (the firmware repeats volume itself).
        assert_eq!(s.next_deadline(), Some(t0 + STUCK_AFTER));
    }

    #[test]
    fn release_all_after_the_link_drops() {
        let mut s = KeyState::default();
        let t0 = Instant::now();
        s.on_report(report(0x01, &[0x10]), t0, T);
        assert_eq!(s.release_all(), [Up(Key::Usage(0x10)), Up(LCTRL)]);
        assert!(s.release_all().is_empty());
    }

    #[test]
    fn windows_keys() {
        let vk = |k| win_key(k).map(|w| w.vk);
        assert_eq!(vk(Key::Usage(0x04)), Some(0x41)); // A
        assert_eq!(vk(Key::Usage(0x1D)), Some(0x5A)); // Z
        assert_eq!(vk(Key::Usage(0x1E)), Some(0x31)); // 1
        assert_eq!(vk(Key::Usage(0x27)), Some(0x30)); // 0
        assert_eq!(vk(Key::Usage(0x28)), Some(0x0D)); // Enter
        assert_eq!(vk(Key::Usage(0x29)), Some(0x1B)); // Esc
        assert_eq!(vk(Key::Usage(0x2B)), Some(0x09)); // Tab
        assert_eq!(vk(Key::Usage(0x2C)), Some(0x20)); // Space
        assert_eq!(vk(Key::Usage(0x38)), Some(0xBF)); // /
        assert_eq!(vk(Key::Usage(0x3A)), Some(0x70)); // F1
        assert_eq!(vk(Key::Usage(0x45)), Some(0x7B)); // F12
        assert_eq!(vk(Key::Usage(0x4C)), Some(0x2E)); // Delete
        assert_eq!(vk(Key::Usage(0x52)), Some(0x26)); // Up
        assert_eq!(vk(Key::Usage(0x62)), Some(0x60)); // keypad 0
        assert_eq!(vk(Key::Usage(0x65)), Some(0x5D)); // Menu
        assert_eq!(vk(Key::Usage(0x68)), Some(0x7C)); // F13
        assert_eq!(vk(Key::Usage(0x73)), Some(0x87)); // F24
        assert_eq!(vk(Key::Usage(0x66)), None); // Power
        assert_eq!(vk(Key::Usage(0x03)), None);
        assert_eq!(vk(Key::Usage(0x74)), None);
        assert_eq!(vk(Key::Usage(0xFF)), None);
        assert_eq!(vk(Key::Modifier(0)), Some(0xA2)); // Left Ctrl
        assert_eq!(vk(Key::Modifier(1)), Some(0xA0)); // Left Shift
        assert_eq!(vk(Key::Modifier(2)), Some(0xA4)); // Left Alt
        assert_eq!(vk(Key::Modifier(3)), Some(0x5B)); // Left Windows
        assert_eq!(vk(Key::Modifier(8)), None);
        assert_eq!(vk(Key::Consumer(0xCD)), Some(0xB3));
        assert_eq!(vk(Key::Consumer(0xB6)), Some(0xB1));
        assert_eq!(vk(Key::Consumer(0xB5)), Some(0xB0));
        assert_eq!(vk(Key::Consumer(0xEA)), Some(0xAE));
        assert_eq!(vk(Key::Consumer(0xE9)), Some(0xAF));
        assert_eq!(vk(Key::Consumer(0xE2)), Some(0xAD));
        assert_eq!(vk(Key::Consumer(0x30)), None);
        // E0 keys carry the extended flag; the main block doesn't.
        assert!(win_key(Key::Usage(0x52)).unwrap().ext);
        assert!(win_key(Key::Modifier(3)).unwrap().ext);
        assert!(!win_key(Key::Usage(0x2C)).unwrap().ext);
        assert_eq!(win_key(Key::Usage(0x2C)).unwrap().scan, 0x39);
    }

    #[test]
    fn every_key_the_app_offers_types() {
        // Every usage up to F24 has a Windows key (the app's button key
        // table is a subset), but Power and keypad `=`.
        for u in (0x04..=0x73u8).filter(|u| ![0x66, 0x67].contains(u)) {
            assert!(win_key(Key::Usage(u)).is_some(), "usage {u:#04x}");
        }
    }

    #[test]
    fn typematic_from_the_control_panel() {
        let d = Typematic::default();
        assert_eq!(d.delay, Duration::from_millis(500));
        assert!((d.interval.as_secs_f64() - 1.0 / 30.0).abs() < 1e-6);
        let slow = Typematic::from_windows(3, 0);
        assert_eq!(slow.delay, Duration::from_millis(1000));
        assert!((slow.interval.as_secs_f64() - 0.4).abs() < 1e-6);
        // Out of range clamps.
        assert_eq!(Typematic::from_windows(9, 99), Typematic::from_windows(3, 31));
    }

    /// Records what it would inject.
    #[derive(Default)]
    struct Fake(Vec<KeyAction>);

    impl Backend for Fake {
        fn inject(&mut self, actions: &[KeyAction]) {
            self.0.extend_from_slice(actions);
        }
        fn typematic(&self) -> Typematic {
            T
        }
    }

    #[test]
    fn the_thread_lets_go_when_its_senders_are_gone() {
        let (tx, rx) = mpsc::channel();
        tx.send(LinkEvent::Keyboard(report(0, &[0x2C]))).unwrap();
        tx.send(LinkEvent::Dismissed).unwrap();
        drop(tx);
        let mut fake = Fake::default();
        run(rx, &mut fake);
        assert_eq!(fake.0, [Down(SPACE), Up(SPACE)]);
    }
}
