// key_route.h on the board: BLE HID or a line on the USB serial link.
// Everything runs on the loop task (the button handlers and loop()).
#include "key_route.h"
#include "ble.h"
#include "serial_link.h"

#include <Arduino.h>
#include <string.h>

// 14 bytes of static RAM: the last keyboard report sent over USB, when, and
// the route of each kind's held keys (KEY_ROUTE_NONE = all up).
static uint8_t  kb_last[8];
static uint32_t kb_sent_ms = 0;
static KeyRoute kb_route = KEY_ROUTE_NONE;
static KeyRoute cc_route = KEY_ROUTE_NONE;

// One write per line, so log output from other tasks can't split it.
static void usb_line(const char* line, size_t len) {
    if (len) Serial.write((const uint8_t*)line, len);
}

static void usb_keyboard(const uint8_t report[8]) {
    char line[KEY_ROUTE_LINE_MAX];
    usb_line(line, key_route_format_kb(report, line, sizeof(line)));
    memcpy(kb_last, report, sizeof(kb_last));
    kb_sent_ms = millis();
}

void key_route_keyboard(const uint8_t report[8]) {
    KeyRoute r = key_route_pick(kb_route, ble_hid_keyboard_ready(), serial_link_active());
    if (r == KEY_ROUTE_BLE) ble_keyboard_report(report);
    else if (r == KEY_ROUTE_USB) usb_keyboard(report);
    kb_route = key_route_report_down(report) ? r : KEY_ROUTE_NONE;
}

void key_route_consumer_press(uint16_t usage) {
    KeyRoute r = key_route_pick(cc_route, ble_hid_consumer_ready(), serial_link_active());
    if (r == KEY_ROUTE_BLE) {
        ble_consumer_press(usage);
    } else if (r == KEY_ROUTE_USB) {
        char line[KEY_ROUTE_LINE_MAX];
        usb_line(line, key_route_format_cc(usage, line, sizeof(line)));
    }
    cc_route = usage ? r : KEY_ROUTE_NONE;
}

void key_route_consumer_release(void) {
    key_route_consumer_press(0);
}

void key_route_tick(void) {
    if (kb_route == KEY_ROUTE_USB && millis() - kb_sent_ms >= KEY_ROUTE_KEEPALIVE_MS) usb_keyboard(kb_last);
}
