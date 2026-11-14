//! The USB serial data link: the same JSON payloads the app writes to the
//! BLE RX characteristic, one per line on the board's USB serial port
//! (`docs/protocol.md`, "USB serial link"). Only firmware whose `info` reply
//! has `"usb":1` reads them.
//!
//! The port is owned by one background thread: it writes queued payloads
//! and reads the board's output, picking the link's replies
//! (`{"dismiss":true}`, `{"ready":true}` after a reboot, `{"err":true}`) out
//! of the log lines around them. [`SerialLink`] is the handle; dropping it
//! closes the port.
//!
//! The board's buttons also come up this link when no Bluetooth host takes
//! them: `{"kb":"MMK1K2K3K4K5K6"}` (a keyboard report in hex) and
//! `{"cc":<usage>}` (a media key, `0` = released). The reader thread hands
//! those straight to a key sink ([`SerialLink::forward_keys`]), not through
//! the daemon's tick.

use std::collections::VecDeque;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use crate::device::{self, DeviceError, FirmwareInfo};

/// Read timeout: how often the thread looks at the write queue and the stop flag.
const POLL: Duration = Duration::from_millis(50);
/// Writes that time out this many times in a row mean the board stopped reading.
const MAX_WRITE_TIMEOUTS: u32 = 3;
/// A line longer than this without a newline is noise (a screenshot dump): dropped.
const MAX_LINE: usize = 16 * 1024;
/// With nothing else to send, ping this often. Well inside the firmware's
/// `SERIAL_LINK_FRESH_MS` (150 s), so one lost ping doesn't drop the link.
const KEEPALIVE: Duration = Duration::from_secs(30);
/// The keepalive command (the firmware answers nothing).
const PING: &[u8] = b"\nping\n";

/// A HID boot keyboard report without its reserved byte: the modifier bits
/// (Ctrl, Shift, Alt, GUI left, then the same right) and up to six key
/// usages (0 = none). All zero means every key is up.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct KeyboardReport {
    /// Modifier bits: 0 Left Ctrl, 1 Left Shift, 2 Left Alt, 3 Left GUI, 4-7 right.
    pub modifiers: u8,
    /// HID keyboard usages down, 0 = empty slot.
    pub keys: [u8; 6],
}

impl KeyboardReport {
    /// Nothing held.
    pub fn is_empty(&self) -> bool {
        self.modifiers == 0 && self.keys == [0; 6]
    }

    /// `MMK1K2K3K4K5K6`: 14 hex digits, either case.
    fn from_hex(s: &str) -> Option<Self> {
        if s.len() != 14 || !s.bytes().all(|c| c.is_ascii_hexdigit()) {
            return None;
        }
        let byte = |i: usize| u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).ok();
        let mut keys = [0u8; 6];
        for (i, k) in keys.iter_mut().enumerate() {
            *k = byte(i + 1)?;
        }
        Some(KeyboardReport { modifiers: byte(0)?, keys })
    }
}

/// What the board said on the link.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkEvent {
    /// A tap or the timeout ended the alert on the device.
    Dismissed,
    /// The firmware (re)started (`{"ready":true}`): it has no data.
    Rebooted,
    /// The firmware couldn't parse a payload (`{"err":true}`).
    Rejected,
    /// A button's keys (`{"kb":"…"}`): the whole keyboard state, sent on
    /// every change and again every second while anything is held.
    Keyboard(KeyboardReport),
    /// A media key down (`{"cc":<usage>}`, a HID consumer usage), or `0`:
    /// released.
    Consumer(u16),
}

impl LinkEvent {
    /// A key event (for the key sink), not a link reply.
    pub fn is_key(&self) -> bool {
        matches!(self, LinkEvent::Keyboard(_) | LinkEvent::Consumer(_))
    }
}

/// The link reply on one line of serial output, if it is one. Log lines,
/// acks and other commands' replies are `None`.
pub fn parse_line(line: &str) -> Option<LinkEvent> {
    let l = line.trim();
    let v: serde_json::Value = serde_json::from_str(&l[l.find('{')?..]).ok()?;
    let is_true = |k: &str| v.get(k) == Some(&serde_json::Value::Bool(true));
    if let Some(kb) = v.get("kb") {
        kb.as_str().and_then(KeyboardReport::from_hex).map(LinkEvent::Keyboard)
    } else if let Some(cc) = v.get("cc") {
        cc.as_u64().and_then(|u| u16::try_from(u).ok()).map(LinkEvent::Consumer)
    } else if is_true("dismiss") {
        Some(LinkEvent::Dismissed)
    } else if is_true("ready") {
        Some(LinkEvent::Rebooted)
    } else if is_true("err") {
        Some(LinkEvent::Rejected)
    } else {
        None
    }
}

/// Whether this firmware takes payloads over USB.
pub fn supports_usb(info: &FirmwareInfo) -> bool {
    info.usb >= 1
}

/// Whether the board on USB is the one paired over BLE: `paired` is the BLE
/// address the app connects to, `info` what the board on USB reports. With no
/// paired address (a USB-only setup) or no `mac` in the reply, any board is.
pub fn same_board(info: &FirmwareInfo, paired: Option<&str>) -> bool {
    let is_mac = |s: &str| s.len() == 17 && s.split(':').all(|p| p.len() == 2);
    match paired {
        Some(p) if is_mac(p) && is_mac(&info.mac) => p.eq_ignore_ascii_case(&info.mac),
        _ => true,
    }
}

/// One payload as it goes on the wire: the JSON on its own line. The leading
/// newline ends anything half-written before it (a write that timed out
/// part-way), which the firmware then drops as one bad line instead of
/// spoiling this payload too. A payload never holds a newline (the app
/// encodes compact JSON); any that slipped in would split it into two bad
/// lines, so they become spaces.
pub fn frame(payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(payload.len() + 2);
    out.push(b'\n');
    out.extend(payload.iter().map(|&b| if b == b'\n' || b == b'\r' { b' ' } else { b }));
    out.push(b'\n');
    out
}

/// What one port answered to `info`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PortProbe {
    /// Clawdmeter firmware with the USB link.
    Usb(FirmwareInfo),
    /// Clawdmeter firmware without it (older than the link).
    NoUsb(FirmwareInfo),
    /// No `info` reply: not Clawdmeter, still booting, or in the bootloader.
    Silent,
    /// The port couldn't be opened or read (busy, gone).
    Failed(String),
}

/// Ask the firmware on `port` who it is (blocking, up to `timeout`).
pub fn probe_port(port: &str, timeout: Duration) -> PortProbe {
    match device::probe_info(port, timeout) {
        Ok(Some(info)) if supports_usb(&info) => PortProbe::Usb(info),
        Ok(Some(info)) => PortProbe::NoUsb(info),
        Ok(None) => PortProbe::Silent,
        Err(e) => PortProbe::Failed(e.to_string()),
    }
}

/// Where the reader thread sends key events, once someone asked for them.
type KeySink = Arc<Mutex<Option<Sender<LinkEvent>>>>;

/// An open USB link.
pub struct SerialLink {
    port: String,
    writes: Option<Sender<Vec<u8>>>,
    events: Receiver<LinkEvent>,
    keys: KeySink,
    /// Link replies taken out of `events` by `forward_keys`, for `try_event`.
    held: Mutex<VecDeque<LinkEvent>>,
    alive: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl std::fmt::Debug for SerialLink {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SerialLink").field("port", &self.port).field("alive", &self.is_alive()).finish()
    }
}

impl SerialLink {
    /// Open `port`. Like [`device::probe_info`], opening doesn't reset the
    /// board. While the link is open, `held` (if given) holds the port's
    /// name, so other processes can wait for the port to be free.
    pub fn open(port: &str, held: Option<PathBuf>) -> Result<Self, DeviceError> {
        let sp = serialport::new(port, 115_200).timeout(POLL).open().map_err(|e| DeviceError::from_open(port, e))?;
        if let Some(h) = &held {
            let _ = std::fs::write(h, port);
        }
        let (wtx, wrx) = mpsc::channel::<Vec<u8>>();
        let (etx, erx) = mpsc::channel();
        let keys: KeySink = Arc::default();
        let alive = Arc::new(AtomicBool::new(true));
        let stop = Arc::new(AtomicBool::new(false));
        let (a, s, k, name) = (alive.clone(), stop.clone(), keys.clone(), port.to_owned());
        let thread = std::thread::Builder::new()
            .name("clawdmeter-usb".into())
            .spawn(move || {
                let queue = etx.clone();
                let forwarded = run(sp, &name, wrx, etx, &k, &s);
                // Whatever the board held is up now: the sink never waits
                // for a release that can't come. With no sink yet, the
                // releases join the queue behind the presses, so a later
                // forward_keys hands over both in order (never a lone
                // key-down that repeats until the stuck-key guard).
                if forwarded {
                    let sink = k.lock().unwrap_or_else(|e| e.into_inner());
                    let tx = sink.as_ref().unwrap_or(&queue);
                    let _ = tx.send(LinkEvent::Keyboard(KeyboardReport::default()));
                    let _ = tx.send(LinkEvent::Consumer(0));
                }
                a.store(false, Ordering::SeqCst);
                if let Some(h) = held {
                    let _ = std::fs::remove_file(h);
                }
            })
            .map_err(|e| DeviceError::Serial(e.to_string()))?;
        Ok(SerialLink {
            port: port.to_owned(),
            writes: Some(wtx),
            events: erx,
            keys,
            held: Mutex::default(),
            alive,
            stop,
            thread: Some(thread),
        })
    }

    /// The port path.
    pub fn port(&self) -> &str {
        &self.port
    }

    /// The thread still has the port (no I/O error, not closed).
    pub fn is_alive(&self) -> bool {
        self.alive.load(Ordering::SeqCst)
    }

    /// Queue one payload. Fails once the link is down; a write that fails on
    /// the wire shows up as [`SerialLink::is_alive`] going false.
    pub fn write(&self, payload: &[u8]) -> Result<(), DeviceError> {
        if !self.is_alive() {
            return Err(DeviceError::Disconnected);
        }
        match &self.writes {
            Some(w) => w.send(frame(payload)).map_err(|_| DeviceError::Disconnected),
            None => Err(DeviceError::Disconnected),
        }
    }

    /// From now on, send the board's key events ([`LinkEvent::Keyboard`],
    /// [`LinkEvent::Consumer`]) to `sink` as they arrive, instead of queueing
    /// them for [`SerialLink::try_event`]. When the link ends, the sink gets
    /// an all-keys-up report and a consumer release (if any key event came).
    ///
    /// Key events already queued go to `sink` first, so it gets them all in
    /// order (the link thread queues and forwards under the same lock).
    pub fn forward_keys(&self, sink: Sender<LinkEvent>) {
        let mut guard = self.keys.lock().unwrap_or_else(|e| e.into_inner());
        let mut held = self.held.lock().unwrap_or_else(|e| e.into_inner());
        while let Ok(ev) = self.events.try_recv() {
            if ev.is_key() {
                let _ = sink.send(ev);
            } else {
                held.push_back(ev);
            }
        }
        *guard = Some(sink);
    }

    /// The next thing the board said, if any.
    pub fn try_event(&self) -> Option<LinkEvent> {
        if let Some(ev) = self.held.lock().unwrap_or_else(|e| e.into_inner()).pop_front() {
            return Some(ev);
        }
        self.events.try_recv().ok()
    }

    /// Close the port and wait for the thread (at most about one poll).
    pub fn close(mut self) {
        self.shut();
    }

    fn shut(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        self.writes = None;
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

impl Drop for SerialLink {
    fn drop(&mut self) {
        self.shut();
    }
}

/// The link thread. True if it passed on any key event.
fn run(
    mut sp: Box<dyn serialport::SerialPort>,
    port: &str,
    writes: Receiver<Vec<u8>>,
    events: Sender<LinkEvent>,
    keys: &KeySink,
    stop: &AtomicBool,
) -> bool {
    let mut forwarded = false;
    let _ = sp.clear(serialport::ClearBuffer::Input);
    // A command half-typed by someone else ends here, so the first payload
    // starts on a fresh line.
    let _ = sp.write_all(b"\n");
    let mut acc: Vec<u8> = Vec::new();
    let mut buf = [0u8; 1024];
    let mut write_timeouts = 0;
    // Write one chunk; false when the link is done (a hard error, or the
    // board stopped reading).
    let mut send = |sp: &mut Box<dyn serialport::SerialPort>, bytes: &[u8]| -> bool {
        match sp.write_all(bytes).and_then(|()| sp.flush()) {
            Ok(()) => {
                write_timeouts = 0;
                true
            }
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {
                write_timeouts += 1;
                log::warn!("USB {port}: write timed out ({write_timeouts})");
                write_timeouts < MAX_WRITE_TIMEOUTS
            }
            Err(e) => {
                log::info!("USB {port}: write failed: {e}");
                false
            }
        }
    };
    let mut last_ping = Instant::now();
    while !stop.load(Ordering::SeqCst) {
        // The firmware counts the link as up only while it hears from us;
        // between payloads (stale data, logged out) a ping keeps it so.
        if last_ping.elapsed() >= KEEPALIVE {
            last_ping = Instant::now();
            if !send(&mut sp, PING) {
                return forwarded;
            }
        }
        loop {
            match writes.try_recv() {
                Ok(bytes) => {
                    if !send(&mut sp, &bytes) {
                        return forwarded;
                    }
                    last_ping = Instant::now();
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => return forwarded,
            }
        }
        match sp.read(&mut buf) {
            Ok(0) => {}
            Ok(n) => {
                acc.extend_from_slice(&buf[..n]);
                while let Some(i) = acc.iter().position(|&c| c == b'\n') {
                    let line: Vec<u8> = acc.drain(..=i).collect();
                    let text = String::from_utf8_lossy(&line);
                    if let Some(ev) = parse_line(&text) {
                        if ev == LinkEvent::Rejected {
                            log::warn!("USB {port}: the board rejected a payload");
                        }
                        forwarded |= ev.is_key();
                        // Under the sink's lock either way, so forward_keys
                        // sees every key event queued before it took over.
                        let sink = keys.lock().unwrap_or_else(|e| e.into_inner());
                        match sink.as_ref() {
                            Some(tx) if ev.is_key() => {
                                let _ = tx.send(ev);
                            }
                            _ => {
                                let _ = events.send(ev);
                            }
                        }
                    }
                }
                if acc.len() > MAX_LINE {
                    acc.clear();
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {}
            Err(e) => {
                log::info!("USB {port}: read failed: {e}");
                return forwarded;
            }
        }
    }
    forwarded
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_link_replies_out_of_the_log() {
        assert_eq!(parse_line("{\"dismiss\":true}\r\n"), Some(LinkEvent::Dismissed));
        assert_eq!(parse_line("{\"ready\":true}"), Some(LinkEvent::Rebooted));
        assert_eq!(parse_line("{\"err\":true}"), Some(LinkEvent::Rejected));
        assert_eq!(parse_line("{\"ack\":true}"), None);
        assert_eq!(parse_line("USB: alert dismissed on the device"), None);
        assert_eq!(parse_line("{\"env\":\"x\",\"ver\":\"1\",\"usb\":1}"), None);
        assert_eq!(parse_line("{\"dismiss\":false}"), None);
        assert_eq!(parse_line("{not json"), None);
    }

    #[test]
    fn reads_the_buttons_keys() {
        let kb = |modifiers, keys| Some(LinkEvent::Keyboard(KeyboardReport { modifiers, keys }));
        // Shift+Tab, then Space held, then everything up.
        assert_eq!(parse_line("{\"kb\":\"022b0000000000\"}\r\n"), kb(0x02, [0x2B, 0, 0, 0, 0, 0]));
        assert_eq!(parse_line("{\"kb\":\"002C0000000000\"}"), kb(0, [0x2C, 0, 0, 0, 0, 0]));
        assert_eq!(parse_line("{\"kb\":\"0f0405060708ff\"}"), kb(0x0F, [4, 5, 6, 7, 8, 0xFF]));
        let up = parse_line("{\"kb\":\"00000000000000\"}");
        assert_eq!(up, kb(0, [0; 6]));
        assert!(matches!(up, Some(LinkEvent::Keyboard(r)) if r.is_empty()));
        // A log line cut into the front of it still parses (the reader takes
        // the line from its first `{`).
        assert_eq!(parse_line("BLE: adv{\"kb\":\"002c0000000000\"}"), kb(0, [0x2C, 0, 0, 0, 0, 0]));
        // Media keys: a consumer usage down, then 0 = released.
        assert_eq!(parse_line("{\"cc\":205}"), Some(LinkEvent::Consumer(0xCD)));
        assert_eq!(parse_line("{\"cc\":0}"), Some(LinkEvent::Consumer(0)));
        // Malformed: wrong length, not hex, not a string, out of range.
        assert_eq!(parse_line("{\"kb\":\"002c00000000\"}"), None);
        assert_eq!(parse_line("{\"kb\":\"00 2c0000000000\"}"), None);
        assert_eq!(parse_line("{\"kb\":\"zz2c0000000000\"}"), None);
        assert_eq!(parse_line("{\"kb\":44}"), None);
        assert_eq!(parse_line("{\"cc\":70000}"), None);
        assert_eq!(parse_line("{\"cc\":-1}"), None);
        assert_eq!(parse_line("{\"cc\":\"205\"}"), None);
        assert!(LinkEvent::Consumer(0).is_key() && !LinkEvent::Dismissed.is_key());
    }

    #[test]
    fn a_payload_is_one_line() {
        assert_eq!(frame(b"{\"s\":5}"), b"\n{\"s\":5}\n");
        assert_eq!(frame(b"{\"m\":\"a\nb\"}"), b"\n{\"m\":\"a b\"}\n");
    }

    fn info(usb: u8, mac: &str) -> FirmwareInfo {
        FirmwareInfo {
            env: "e".into(),
            ver: "2.5.0".into(),
            rev: String::new(),
            link: "ble".into(),
            usb,
            mac: mac.into(),
        }
    }

    #[test]
    fn usb_only_for_the_paired_board() {
        let b = info(1, "AA:BB:CC:DD:EE:01");
        assert!(same_board(&b, Some("aa:bb:cc:dd:ee:01")));
        assert!(!same_board(&b, Some("AA:BB:CC:DD:EE:02")));
        // USB-only (nothing paired), a macOS UUID key, or no `mac`: any board.
        assert!(same_board(&b, None));
        assert!(same_board(&b, Some("6F0A8C2E-1B2C-4D5E-8F90-123456789ABC")));
        assert!(same_board(&info(1, ""), Some("AA:BB:CC:DD:EE:02")));
    }

    #[test]
    fn usb_needs_the_flag() {
        assert!(supports_usb(&info(1, "")));
        assert!(!supports_usb(&info(0, "")));
        let old: FirmwareInfo = serde_json::from_str("{\"env\":\"e\",\"ver\":\"2.4.0\",\"link\":\"ble\"}").unwrap();
        assert!(!supports_usb(&old));
        let new: FirmwareInfo =
            serde_json::from_str("{\"env\":\"e\",\"ver\":\"2.5.0\",\"link\":\"ble\",\"usb\":1}").unwrap();
        assert!(supports_usb(&new));
    }
}
