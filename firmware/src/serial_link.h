#pragma once
// USB serial data link: the same JSON payloads the app writes to BLE RX, sent
// one per line over the USB serial port instead (docs/protocol.md, "USB
// serial link"). main.cpp's serial reader hands every line that starts with
// `{` to serial_link_feed(); the loop takes it like a BLE payload.
//
// Replies go out on the same port as single JSON lines among the log output:
// `{"ack":true}` / `{"err":true}` per payload and `{"dismiss":true}` when the
// user ends an alert on the device.

#include <stdbool.h>
#include <stdint.h>

// How long after the last payload or `ping` the link counts as up. The app
// pings every 30 s while it holds the port, data or not.
#define SERIAL_LINK_FRESH_MS 150000UL

// A complete line starting with `{` (NUL-terminated, no newline).
void serial_link_feed(const char* line);
// A line that didn't fit the serial buffer: answered with `{"err":true}`.
void serial_link_overflow(void);
// `ping`: the app is there (keeps the link up while it has nothing to send).
void serial_link_ping(void);
bool serial_link_has_data(void);
// The latest payload; valid until the next serial_link_feed() (the next
// loop pass's check_serial_cmd), so parse it right away.
const char* serial_link_get_data(void);
// A payload arrived within SERIAL_LINK_FRESH_MS.
bool serial_link_active(void);
void serial_link_send_ack(bool ok);
void serial_link_send_dismiss(void);
