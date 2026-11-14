#pragma once
// Where the buttons' key presses go (docs/protocol.md, "USB serial link",
// Keys). Every keyboard report and consumer usage goes through here:
//
//   - a BLE host connected and subscribed to that HID report (encrypted
//     link): BLE HID, exactly as before;
//   - else the USB serial link is up (serial_link_active()): one JSON line
//     on Serial, `{"kb":"MMK1K2K3K4K5K6"}` (modifiers + six key usages in
//     hex, the boot report's reserved byte left out; all zero = every key
//     up) or `{"cc":<usage>}` (`{"cc":0}` = released); the desktop app types
//     them;
//   - else nowhere.
//
// Never both. A report sent while keys are held goes where the press went,
// so a key always comes up on the link it went down on. While a report with
// keys down sits on USB it is sent again every KEY_ROUTE_KEEPALIVE_MS: the
// app lets go of keys it hears nothing about for 3 s (a lost release line).

#include <stddef.h>
#include <stdint.h>

#define KEY_ROUTE_KEEPALIVE_MS 1000UL

enum KeyRoute : uint8_t {
    KEY_ROUTE_NONE = 0,
    KEY_ROUTE_BLE,
    KEY_ROUTE_USB,
};

// ---- Pure (key_route.cpp, native-tested) ----

// The link for a report. `held` is the route of the keys already down
// (KEY_ROUTE_NONE when nothing is): they keep it.
KeyRoute key_route_pick(KeyRoute held, bool ble_subscribed, bool usb_active);
// An 8-byte report [modifiers, 0, key1..key6] has a key or modifier down.
bool key_route_report_down(const uint8_t report[8]);
// The serial line for a report or a consumer usage, with its "\n". Returns
// the length, or 0 if `n` is too small (KEY_ROUTE_LINE_MAX always fits).
#define KEY_ROUTE_LINE_MAX 32
size_t key_route_format_kb(const uint8_t report[8], char* out, size_t n);
size_t key_route_format_cc(uint16_t usage, char* out, size_t n);

// ---- On the board (key_route_io.cpp) ----

void key_route_keyboard(const uint8_t report[8]);
void key_route_consumer_press(uint16_t usage);
void key_route_consumer_release(void);
// From loop(): the USB keepalive of a held report.
void key_route_tick(void);
