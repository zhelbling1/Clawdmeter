//! The daemon runtime: drives [`clawdmeter_core::Engine`] with real I/O
//! (the `claude` CLI, events.log, attention files, the BLE link).
//!
//! It runs on its own thread with a current-thread tokio runtime, so the GUI
//! event loop never shares a reactor with it. The UI talks to it through a
//! [`DaemonHandle`]: commands in, a [`Status`] snapshot out.

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use clawdmeter_ble::{
    should_wake, AddressCache, Bluetooth, DeviceEvent, DeviceEvents, DeviceLink, LinkError, LinkOptions, Reconnect,
    Sighting, MAX_WRITE,
};
use clawdmeter_core::attention::AttentionInbox;
use clawdmeter_core::backoff;
use clawdmeter_core::engine::PollPlan;
use clawdmeter_core::events::EventTail;
use clawdmeter_core::platform::AppearanceWatch;
use clawdmeter_core::probe;
use clawdmeter_core::usage;
use clawdmeter_core::{unix_now, Engine, EngineStatus, HostClock, Paths, Settings, WriteKind};
use clawdmeter_flash::link::{self as usb_link, LinkEvent, PortProbe, SerialLink};
use tokio::sync::{mpsc, watch};
use tokio::task::JoinHandle;

/// Loop tick: events reach the device within about this long.
const TICK: Duration = Duration::from_millis(500);
/// Config re-read interval (s).
const SETTINGS_EVERY: i64 = 5;
/// Connection check interval (s).
const LINK_CHECK_EVERY: i64 = 5;
/// How often to look for a board on USB while there's no USB link (s).
const USB_SCAN_EVERY: i64 = 10;
/// How long each USB port gets to answer `info` during a scan.
const USB_PROBE: Duration = Duration::from_millis(1500);
/// Device name shown while the data goes over USB.
const USB_NAME: &str = "Clawdmeter (USB)";

/// The USB serial link is on unless `CLAWDMETER_USB=0`.
fn usb_enabled() -> bool {
    std::env::var("CLAWDMETER_USB").map_or(true, |v| v.trim() != "0")
}

/// Don't ask a port again for this long (s) after its firmware answered
/// without the USB link, or it is another board than the paired one.
const USB_RETRY_NO_LINK: i64 = 300;
/// The same after no answer at all, or a port that couldn't be opened (s):
/// short, since a board that was just plugged in is often still booting.
const USB_RETRY_SILENT: i64 = 20;

/// What one USB scan found.
struct UsbScan {
    /// The opened link, if a board took it.
    link: Option<SerialLink>,
    /// Ports asked and turned down, with when to ask them again.
    retry: Vec<(String, i64)>,
}

/// One scan (blocking): ask each Espressif port that isn't waiting out a
/// retry, and open the first board whose firmware has the USB link and is the
/// paired one (`paired`: the cached BLE address; `None` = any). While it
/// probes, `usb-held` says so, so a window that wants the port waits; a
/// window claim stops the scan.
fn scan_usb(paths: Paths, skip: HashMap<String, i64>, paired: Option<String>, now: i64) -> UsbScan {
    let held = crate::ipc::usb_held_file(&paths);
    let _ = std::fs::write(&held, "scanning");
    let mut found = UsbScan { link: None, retry: Vec::new() };
    for p in clawdmeter_flash::device::list_ports() {
        if skip.get(&p.path).is_some_and(|&t| t > now) {
            continue;
        }
        if crate::ipc::usb_claimed(&paths, unix_now()) {
            break;
        }
        match usb_link::probe_port(&p.path, USB_PROBE) {
            PortProbe::Usb(info) if !usb_link::same_board(&info, paired.as_deref()) => {
                log::info!(
                    "USB {}: board {} isn't the paired one ({}); leaving it to Bluetooth",
                    p.path,
                    info.mac,
                    paired.as_deref().unwrap_or("?")
                );
                found.retry.push((p.path, now + USB_RETRY_NO_LINK));
            }
            PortProbe::Usb(info) => {
                if crate::ipc::usb_claimed(&paths, unix_now()) {
                    break;
                }
                match SerialLink::open(&p.path, Some(held.clone())) {
                    Ok(l) => {
                        log::info!("USB link on {} ({} firmware {})", p.path, info.env, info.ver);
                        found.link = Some(l);
                        break;
                    }
                    Err(e) => {
                        log::info!("USB link on {}: {e}", p.path);
                        found.retry.push((p.path, now + USB_RETRY_SILENT));
                    }
                }
            }
            PortProbe::NoUsb(info) => {
                log::info!(
                    "USB {}: {} firmware {} has no USB data link (update the firmware to use it)",
                    p.path,
                    info.env,
                    info.ver
                );
                found.retry.push((p.path, now + USB_RETRY_NO_LINK));
            }
            PortProbe::Silent => found.retry.push((p.path, now + USB_RETRY_SILENT)),
            PortProbe::Failed(e) => {
                log::debug!("USB {}: {e}", p.path);
                found.retry.push((p.path, now + USB_RETRY_SILENT));
            }
        }
    }
    // An open link keeps `usb-held` (the port's name) until it closes.
    if found.link.is_none() {
        let _ = std::fs::remove_file(&held);
    }
    found
}

/// Close a USB link off the runtime thread (joining waits up to one poll).
fn close_usb(l: SerialLink) {
    tokio::task::spawn_blocking(move || l.close());
}

/// Whether the Bluetooth data link may run: the setting is on and the first
/// USB scan is over (USB first; `first_usb_scan_done` also covers USB being
/// off or the window holding the port), and either no USB link is open or
/// this computer can't type the board's key presses from USB
/// (`usb_keys_typed`, Windows only so far). Closing the link while USB is up
/// would, on BlueZ, also drop the board's HID keyboard connection: where the
/// app can't type USB keys, the link stays up for the buttons (nothing is
/// written to it while USB carries the data).
pub fn ble_allowed(setting_on: bool, usb_link_open: bool, first_usb_scan_done: bool, usb_keys_typed: bool) -> bool {
    setting_on && first_usb_scan_done && (!usb_link_open || !usb_keys_typed)
}

/// This computer types the board's key presses when they come over USB
/// (crate::keys: SendInput on Windows; a stub elsewhere).
const USB_KEYS_TYPED: bool = cfg!(windows);

/// Requests from the UI.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Command {
    /// Poll `/usage` now.
    RefreshNow,
    /// Drop the link and look for the device again (e.g. after pairing).
    Reconnect,
    /// Forget the cached device address, then look again (after swapping boards).
    Forget,
    /// Mute the alert chimes (device and this computer) for this run,
    /// whatever the config says.
    SetChimesMuted(bool),
    /// Re-read the config now (the window saved it), not at the next
    /// periodic re-read.
    ReloadSettings,
    /// Stop the daemon thread.
    Shutdown,
}

/// The BLE side, for the tray's status dot.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum LinkState {
    /// Not tried yet (or Bluetooth is waiting for the USB scan).
    #[default]
    Starting,
    /// Bluetooth is off in the settings and no board is open on USB.
    UsbSearching,
    /// No adapter, or Bluetooth is off.
    NoAdapter(String),
    /// No paired device found; retrying.
    Searching,
    /// Connecting to a known device.
    Connecting,
    /// Connected.
    Connected {
        /// Cache key (address).
        key: String,
        /// Device name.
        name: Option<String>,
    },
}

/// Everything the tray needs, updated every tick.
#[derive(Debug, Clone, Default)]
pub struct Status {
    /// BLE link.
    pub link: LinkState,
    /// Usage / hooks / attention.
    pub engine: EngineStatus,
    /// Unix seconds of the last successful device write.
    pub last_write_at: Option<i64>,
    /// `claude` CLI path in use (None = not found).
    pub claude: Option<PathBuf>,
}

/// Handle held by the UI.
#[derive(Debug)]
pub struct DaemonHandle {
    /// Send commands.
    pub commands: mpsc::UnboundedSender<Command>,
    /// Watch status.
    pub status: watch::Receiver<Status>,
    thread: Option<std::thread::JoinHandle<()>>,
}

impl DaemonHandle {
    /// Ask the daemon to stop and wait for it.
    pub fn shutdown(mut self) {
        let _ = self.commands.send(Command::Shutdown);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

/// Start the daemon on a background thread.
pub fn spawn(paths: Paths) -> DaemonHandle {
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();
    let (st_tx, st_rx) = watch::channel(Status::default());
    let thread = std::thread::Builder::new()
        .name("clawdmeter-daemon".into())
        .spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().expect("tokio runtime");
            rt.block_on(run(paths, cmd_rx, st_tx));
        })
        .expect("spawn daemon thread");
    DaemonHandle { commands: cmd_tx, status: st_rx, thread: Some(thread) }
}

/// Re-read the config into the engine, keeping a tray mute and finding
/// `claude` again when its path changed (or it wasn't found). An unreadable
/// file keeps the settings in use.
fn reload_settings(paths: &Paths, engine: &mut Engine, claude: &mut Option<PathBuf>, chimes_muted: bool) {
    let Ok(mut s) = Settings::load(paths) else { return };
    if chimes_muted {
        s.alert_chime = false;
        s.desktop_chime = false;
    }
    if s.claude_path != engine.settings().claude_path || claude.is_none() {
        *claude = usage::find_claude(s.claude_path.as_deref(), &paths.home);
    }
    engine.update_settings(s);
    engine.set_claude_found(claude.is_some());
}

type PollResults = Vec<(PathBuf, probe::Polled)>;
type ConnectResult = Result<(DeviceLink, DeviceEvents), LinkError>;

/// Read each account of a poll plan: the probe, `/usage`, or a reading known
/// without a call. The probe runs from `cwd` (the state dir).
fn poll_all(claude: Option<PathBuf>, plan: PollPlan, home: PathBuf, cwd: PathBuf) -> PollResults {
    let now = chrono::Utc::now();
    plan.accounts
        .into_iter()
        .zip(plan.plans)
        .map(|(d, p)| {
            let r = probe::poll(claude.as_deref(), &d, &home, &cwd, &p, now);
            (d, r)
        })
        .collect()
}

/// The daemon loop. Returns on [`Command::Shutdown`] or when every command
/// sender is dropped.
pub async fn run(paths: Paths, mut commands: mpsc::UnboundedReceiver<Command>, status: watch::Sender<Status>) {
    let settings = Settings::load(&paths).unwrap_or_else(|e| {
        log::warn!("config unreadable ({e}); using defaults");
        Settings::from_config(&Default::default(), &paths, None)
    });
    log::info!(
        "accounts: {}",
        settings.config_dirs.iter().map(|d| d.display().to_string()).collect::<Vec<_>>().join(", ")
    );
    let mut engine = Engine::new(settings);
    // Blocks the usage endpoint set survive restarts (a call during one
    // lengthens it).
    engine.restore_blocks(&backoff::load_blocks(&paths.usage_blocks_file()), unix_now());
    let mut saved_blocks = engine.blocks(unix_now());
    let host = HostClock { utc_offset_secs: 0, prefers_12h: clawdmeter_core::platform::prefers_12h() };
    // System's Dark or Light (and Solarized's) follows the OS.
    // The engine has Dark until the first answer (no write goes out before a
    // link and a poll anyway).
    let appearance = AppearanceWatch::spawn();
    let mut shown_appearance = None;
    let inbox = AttentionInbox::new(&paths.state_dir);
    let (mut tail, seed) = EventTail::open(paths.events_log());
    engine.seed_events(&seed);
    engine.set_hooks_installed(tail.exists());
    let cache = AddressCache::new(paths.ble_address_file());
    let link_opts = LinkOptions::default();

    let mut claude = usage::find_claude(engine.settings().claude_path.as_deref(), &paths.home);
    match &claude {
        Some(c) => log::info!("claude CLI: {}", c.display()),
        None => log::warn!(
            "claude CLI not found (set claude_path in {}); usage comes from the usage endpoint every 12 min",
            paths.config_file.display()
        ),
    }
    engine.set_claude_found(claude.is_some());

    let mut link: Option<DeviceLink> = None;
    let mut device_events: Option<DeviceEvents> = None;
    let mut connecting: Option<JoinHandle<ConnectResult>> = None;
    let mut polling: Option<JoinHandle<PollResults>> = None;
    let mut reconnect = Reconnect::default();
    // The Bluetooth handle and its watcher exist only while Bluetooth is
    // allowed (setting on, and the USB-first rules): with it off, or while a
    // USB link carries the data, nothing touches the adapter.
    let mut bt: Option<Bluetooth> = None;
    let mut wakeups: Option<clawdmeter_ble::Wakeups> = None;
    let mut last_settings = unix_now();
    let mut last_link_check = unix_now();
    let mut last_write_at = None;
    let mut chimes_muted = false;
    // The USB serial link (clawdmeter_flash::link): while it's open every
    // write goes over USB; BLE stays up beside it for the buttons.
    let usb_on = usb_enabled();
    let mut usb: Option<SerialLink> = None;
    let mut usb_scan: Option<JoinHandle<UsbScan>> = None;
    let mut last_usb_scan = i64::MIN / 2;
    // The first USB scan has finished: Bluetooth waits for it (USB first).
    let mut first_usb_scan_done = false;
    // Ports turned down by a scan, and when to ask them again.
    let mut usb_retry: HashMap<String, i64> = HashMap::new();
    // A held marker left by a crashed run would make the window wait.
    let _ = std::fs::remove_file(crate::ipc::usb_held_file(&paths));
    if !usb_on {
        log::info!("USB link off (CLAWDMETER_USB=0)");
    }
    if !engine.settings().bluetooth {
        log::info!("Bluetooth off in the settings; USB only");
    }
    let mut link_state = if engine.settings().bluetooth { LinkState::Starting } else { LinkState::UsbSearching };
    // USB keys: the board's buttons, when no Bluetooth host takes them,
    // typed here by their own thread (crate::keys).
    let keys = crate::keys::KeyInjector::spawn();
    let mut ticker = tokio::time::interval(TICK);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        ticker.tick().await;
        let now = unix_now();

        // ---- commands ----
        loop {
            match commands.try_recv() {
                Ok(Command::RefreshNow) => engine.request_refresh(now),
                Ok(cmd @ (Command::Reconnect | Command::Forget)) => {
                    if let Some(l) = link.take() {
                        l.close().await;
                    }
                    if cmd == Command::Forget {
                        if let Some(key) = cache.load() {
                            cache.invalidate(&key);
                        }
                    }
                    device_events = None;
                    link_state = LinkState::Searching;
                    reconnect.retry_in(now, 0);
                }
                Ok(Command::SetChimesMuted(m)) => {
                    chimes_muted = m;
                    if m {
                        let mut s = engine.settings().clone();
                        s.alert_chime = false;
                        s.desktop_chime = false;
                        engine.update_settings(s);
                    } else {
                        reload_settings(&paths, &mut engine, &mut claude, false);
                    }
                }
                Ok(Command::ReloadSettings) => {
                    // This tick's write check sees the new settings.
                    last_settings = now;
                    reload_settings(&paths, &mut engine, &mut claude, chimes_muted);
                }
                Ok(Command::Shutdown) | Err(mpsc::error::TryRecvError::Disconnected) => {
                    if let Some(l) = link.take() {
                        l.close().await;
                    }
                    if let Some(u) = usb.take() {
                        u.close();
                    }
                    log::info!("daemon stopped");
                    return;
                }
                Err(mpsc::error::TryRecvError::Empty) => break,
            }
        }

        // ---- config (re-read every SETTINGS_EVERY, and on ReloadSettings:
        // this catches hand edits and a `--daemon` with no tray) ----
        if now - last_settings >= SETTINGS_EVERY {
            last_settings = now;
            reload_settings(&paths, &mut engine, &mut claude, chimes_muted);
        }

        // ---- fast clock ----
        if let Some(a) = appearance.known().filter(|a| shown_appearance != Some(*a)) {
            log::info!("system appearance: {a:?}");
            shown_appearance = Some(a);
            engine.set_appearance(a);
        }
        for ev in tail.poll() {
            log::debug!("hook {:?} {}", ev.kind, ev.session);
            engine.on_hook_event(&ev, now);
        }
        engine.set_hooks_installed(tail.exists());
        let alert = inbox.take_alert(SystemTime::now());
        let clears = inbox.take_clears();
        if alert.is_some() || !clears.is_empty() {
            engine.on_attention(alert, &clears);
        }
        if engine.take_desktop_chime() {
            crate::chime::play();
        }
        if engine.expire_attention(SystemTime::now()) {
            log::info!("attention alert expired");
        }

        // ---- slow clock ----
        if let Some(rx) = device_events.as_mut() {
            while let Ok(ev) = rx.try_recv() {
                match ev {
                    DeviceEvent::Refresh => {
                        log::info!("refresh requested by device");
                        engine.request_refresh(now);
                    }
                    DeviceEvent::Dismissed => {
                        log::info!("attention alert dismissed on the device");
                        engine.on_device_dismissed();
                    }
                }
            }
        }
        if polling.as_ref().is_some_and(JoinHandle::is_finished) {
            if let Ok(results) = polling.take().expect("checked").await {
                for (d, r) in &results {
                    if let Err(e) = &r.result {
                        log::warn!("{}: {e}", d.display());
                    }
                }
                engine.on_poll_results(unix_now(), results);
                let blocks = engine.blocks(unix_now());
                if blocks != saved_blocks {
                    if let Err(e) = backoff::save_blocks(&paths.usage_blocks_file(), &blocks) {
                        log::warn!("couldn't save usage blocks: {e}");
                    }
                    saved_blocks = blocks;
                }
            }
        }
        if polling.is_none() {
            if let Some(plan) = engine.begin_poll(now) {
                log::debug!(
                    "polling ({:?}): {:?}",
                    plan.reason,
                    plan.accounts.iter().zip(&plan.plans).collect::<Vec<_>>()
                );
                let (c, home, cwd) = (claude.clone(), paths.home.clone(), paths.state_dir.clone());
                polling = Some(tokio::task::spawn_blocking(move || poll_all(c, plan, home, cwd)));
            }
        }

        // ---- USB link ----
        // Handing the board between links keeps the alert state
        // (`resend_all`); only a real BLE reconnect starts it over.
        let claimed = crate::ipc::usb_claimed(&paths, now);
        if claimed {
            // The window may be flashing: ask every port afresh afterwards.
            usb_retry.clear();
        }
        if let Some(u) = usb.take() {
            if !u.is_alive() || claimed {
                if claimed {
                    log::info!("USB {}: the window or a command needs the port; letting it go", u.port());
                } else {
                    log::info!("USB {}: link lost", u.port());
                }
                close_usb(u);
                // Back on BLE (if it's up). A dead link may have taken queued
                // writes with it, so a shown alert goes out again too.
                engine.resend_all(!claimed);
            } else {
                while let Some(ev) = u.try_event() {
                    match ev {
                        LinkEvent::Dismissed => {
                            log::info!("attention alert dismissed on the device (USB)");
                            engine.on_device_dismissed();
                        }
                        LinkEvent::Rebooted => {
                            log::info!("USB {}: the board restarted; sending everything again", u.port());
                            engine.resend_all(true);
                            engine.request_refresh(now);
                        }
                        LinkEvent::Rejected => engine.resend_all(true),
                        // USB keys: only before forward_keys took over.
                        LinkEvent::Keyboard(_) | LinkEvent::Consumer(_) => keys.send(ev),
                    }
                }
                usb = Some(u);
            }
        }
        if usb_scan.as_ref().is_some_and(JoinHandle::is_finished) {
            first_usb_scan_done = true;
            if let Ok(scan) = usb_scan.take().expect("checked").await {
                usb_retry.extend(scan.retry);
                if let Some(u) = scan.link {
                    if crate::ipc::usb_claimed(&paths, unix_now()) {
                        close_usb(u);
                    } else {
                        // USB keys: straight from the link's thread.
                        u.forward_keys(keys.sender());
                        usb = Some(u);
                        // The board may have restarted while nobody held its
                        // port (a flash, a replug), with its `{"ready":true}`
                        // unheard: a shown alert goes out again (silently).
                        engine.resend_all(true);
                    }
                }
            }
        }
        if usb_on && usb.is_none() && usb_scan.is_none() && !claimed && now - last_usb_scan >= USB_SCAN_EVERY {
            last_usb_scan = now;
            let (p, skip, paired) = (paths.clone(), usb_retry.clone(), cache.load());
            usb_scan = Some(tokio::task::spawn_blocking(move || scan_usb(p, skip, paired, now)));
        }

        // ---- link (Bluetooth) ----
        // USB first: the first scan has run (or USB is off, or the window
        // holds the port), and no USB link is open.
        let bluetooth_on = engine.settings().bluetooth;
        let ble_ok =
            ble_allowed(bluetooth_on, usb.is_some(), !usb_on || first_usb_scan_done || claimed, USB_KEYS_TYPED);
        if !ble_ok {
            if let Some(l) = link.take() {
                if bluetooth_on {
                    log::info!("USB link up; Bluetooth not needed");
                } else {
                    log::info!("Bluetooth off in the settings; closing the link");
                }
                l.close().await;
                device_events = None;
                // A prompt first try once Bluetooth may connect again.
                reconnect.retry_in(now, 0);
            }
            if !bluetooth_on {
                // Nothing of Bluetooth stays running (a connect in flight
                // finishes, and its link is closed below).
                if connecting.is_none() {
                    bt = None;
                }
                wakeups = None;
                link_state = LinkState::UsbSearching;
            } else if link_state != LinkState::Starting {
                link_state = LinkState::Starting;
            }
        } else if link_state == LinkState::UsbSearching {
            link_state = LinkState::Starting;
        }
        if ble_ok && bt.is_none() {
            let handle = Bluetooth::default();
            wakeups = Some(clawdmeter_ble::spawn_watcher(handle.clone()));
            bt = Some(handle);
        }
        if connecting.as_ref().is_some_and(JoinHandle::is_finished) {
            match connecting.take().expect("checked").await {
                Ok(Ok((l, _))) if !ble_ok => {
                    // USB came up (or Bluetooth went off) while it connected.
                    log::info!("Bluetooth not needed; closing the link");
                    l.close().await;
                }
                Ok(Err(_)) if !ble_ok => {}
                Ok(Ok((l, rx))) => {
                    log::info!("connected to {} ({})", l.name().unwrap_or("device"), l.key());
                    link_state = LinkState::Connected { key: l.key().to_owned(), name: l.name().map(str::to_owned) };
                    link = Some(l);
                    device_events = Some(rx);
                    reconnect.connected();
                    // Where the app can't type USB keys (not Windows), BLE
                    // stays up beside a USB link for the buttons only: the
                    // device's state (alert included) is unchanged, so
                    // there is nothing to start over or resend.
                    if usb.is_none() {
                        inbox.reset();
                        engine.on_connected();
                    }
                }
                Ok(Err(e)) => {
                    link_state = match &e {
                        LinkError::NoAdapter(s) => LinkState::NoAdapter(s.clone()),
                        _ => LinkState::Searching,
                    };
                    let wait = reconnect.failed(now);
                    if !matches!(e, LinkError::NotFound) || wait == 1 {
                        log::info!("{e}; retrying in {wait}s");
                    }
                }
                Err(e) => log::error!("connect task failed: {e}"),
            }
        }
        // The OS saw the device come back (BlueZ reconnected the bonded
        // device, or a scan saw it advertise): don't sit out the wait.
        while let Some(w) = wakeups.as_mut().and_then(|w| w.try_recv().ok()) {
            if !ble_ok || link.is_some() || !should_wake(&w, cache.load().as_deref()) {
                continue;
            }
            if connecting.is_none() && !reconnect.due(now) {
                let how = match w.sighting {
                    Sighting::Connected => "connected at the OS level",
                    Sighting::Advertising => "advertising",
                };
                log::info!("device {} {how}; reconnecting now", w.key);
            }
            reconnect.wake(now, connecting.is_some());
        }
        if let (true, Some(bt), None, true) = (ble_ok && link.is_none(), &bt, &connecting, reconnect.due(now)) {
            if link_state == LinkState::Starting {
                link_state = LinkState::Connecting;
            }
            let (bt, cache, opts) = (bt.clone(), cache.clone(), link_opts.clone());
            connecting = Some(tokio::spawn(async move {
                let adapter = bt.adapter().await?;
                DeviceLink::open(&adapter, &cache, &opts).await
            }));
        }
        if let Some(l) = &link {
            if now - last_link_check >= LINK_CHECK_EVERY {
                last_link_check = now;
                if !l.is_connected().await {
                    log::info!("device disconnected, reconnecting...");
                    link = None;
                    device_events = None;
                    link_state = LinkState::Searching;
                    reconnect.retry_in(now, 2);
                }
            }
        }

        // ---- write ----
        if usb.is_some() || link.is_some() {
            if let Some(w) = engine
                .next_write(now, HostClock { utc_offset_secs: clawdmeter_core::platform::utc_offset_secs(), ..host })
            {
                let bytes = w.payload.encode(MAX_WRITE);
                let label = match w.kind {
                    WriteKind::Poll => "Sending",
                    WriteKind::Heartbeat => "Heartbeat",
                    WriteKind::Attention => "Attention",
                    WriteKind::Event => "Event",
                    WriteKind::NoData => "No data",
                };
                let via = if usb.is_some() { " (USB)" } else { "" };
                log::info!("{label}{via}: {}", String::from_utf8_lossy(&bytes));
                if let Some(u) = &usb {
                    match u.write(&bytes) {
                        Ok(()) => {
                            engine.mark_written(now, &w);
                            last_write_at = Some(now);
                        }
                        // The next tick sees the dead link and falls back to BLE.
                        Err(e) => log::warn!("USB write failed: {e}"),
                    }
                } else if let Some(l) = &link {
                    match l.write(&bytes).await {
                        Ok(()) => {
                            engine.mark_written(now, &w);
                            last_write_at = Some(now);
                        }
                        Err(e) => {
                            log::warn!("write failed: {e}");
                            if !l.is_connected().await {
                                link = None;
                                device_events = None;
                                link_state = LinkState::Searching;
                                reconnect.retry_in(now, 2);
                            }
                        }
                    }
                }
            }
        }

        // While the data goes over USB, that's the link the user sees.
        let shown_link = match &usb {
            Some(u) => LinkState::Connected { key: format!("usb:{}", u.port()), name: Some(USB_NAME.to_owned()) },
            None => link_state.clone(),
        };
        let _ =
            status.send(Status { link: shown_link, engine: engine.status(now), last_write_at, claude: claude.clone() });
    }
}

/// One poll of every account, printed as the payload the device would get
/// (`clawdmeter --once`). No BLE.
pub fn once(paths: &Paths) -> i32 {
    let settings = match Settings::load(paths) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("config: {e}");
            return 1;
        }
    };
    let claude = usage::find_claude(settings.claude_path.as_deref(), &paths.home);
    let now = unix_now();
    let mut engine = Engine::new(settings.clone());
    engine.set_appearance(clawdmeter_core::platform::system_appearance().unwrap_or_default());
    engine.restore_blocks(&backoff::load_blocks(&paths.usage_blocks_file()), now);
    // A blocked account isn't asked: a call during a block lengthens it.
    let blocked = engine.blocks(now);
    for (d, b) in &blocked {
        println!("{}: {}", d.display(), usage::paused_message(b.until, clawdmeter_core::platform::utc_offset_secs()));
    }
    // Nothing is known yet, so the idle source for every account (no message).
    let accounts: Vec<PathBuf> = settings.config_dirs.iter().filter(|d| !blocked.contains_key(*d)).cloned().collect();
    let plan = PollPlan {
        reason: clawdmeter_core::cadence::PollReason::Startup,
        plans: vec![probe::Plan::Usage; accounts.len()],
        accounts,
    };
    let results = poll_all(claude, plan, paths.home.clone(), paths.state_dir.clone());
    let mut ok = false;
    for (d, r) in &results {
        match &r.result {
            Ok(r) if r.is_spend_only() => {
                ok = true;
                println!("{}: spend limit {}% used", d.display(), r.session_pct());
            }
            Ok(r) if r.no_session_limit() => {
                ok = true;
                println!("{}: no 5-hour limit, week {}%", d.display(), r.session_pct());
            }
            Ok(r) => {
                ok = true;
                println!(
                    "{}: session {}%{}, week {}%",
                    d.display(),
                    r.session_pct(),
                    if r.window_started() { "" } else { " (window not started)" },
                    r.week.as_ref().map_or(0, |w| w.pct)
                );
            }
            Err(e) => println!("{}: {e}", d.display()),
        }
    }
    engine.on_poll_results(now, results);
    if let Err(e) = backoff::save_blocks(&paths.usage_blocks_file(), &engine.blocks(unix_now())) {
        eprintln!("couldn't save usage blocks: {e}");
    }
    let host = HostClock {
        utc_offset_secs: clawdmeter_core::platform::utc_offset_secs(),
        prefers_12h: clawdmeter_core::platform::prefers_12h(),
    };
    if let Some(w) = engine.next_write(now, host) {
        println!("{}", String::from_utf8_lossy(&w.payload.encode(MAX_WRITE)));
    }
    if ok {
        0
    } else {
        1
    }
}

#[cfg(test)]
mod tests {
    use super::ble_allowed;

    #[test]
    fn bluetooth_waits_for_usb() {
        // (setting, usb open, first scan done, usb keys typed) -> allowed
        assert!(!ble_allowed(true, false, false, true), "USB first: wait for the first scan");
        assert!(ble_allowed(true, false, true, true), "no board on USB: Bluetooth may connect");
        assert!(!ble_allowed(true, true, true, true), "a USB link carries the data and the keys");
        assert!(!ble_allowed(true, true, false, true));
        for usb in [false, true] {
            for scanned in [false, true] {
                for typed in [false, true] {
                    assert!(!ble_allowed(false, usb, scanned, typed), "off means off");
                }
            }
        }
    }

    #[test]
    fn bluetooth_stays_for_the_buttons_where_usb_keys_cant_be_typed() {
        // Not Windows: closing the link would drop the board's HID keyboard
        // on BlueZ, so it stays up beside a USB link.
        assert!(ble_allowed(true, true, true, false));
        assert!(!ble_allowed(true, true, false, false), "still USB first at start-up");
    }
}
