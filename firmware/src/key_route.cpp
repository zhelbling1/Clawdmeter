// The pure half of key_route.h: the routing rule and the serial lines.
#include "key_route.h"

#include <stdio.h>

KeyRoute key_route_pick(KeyRoute held, bool ble_subscribed, bool usb_active) {
    if (held != KEY_ROUTE_NONE) return held;
    if (ble_subscribed) return KEY_ROUTE_BLE;
    if (usb_active) return KEY_ROUTE_USB;
    return KEY_ROUTE_NONE;
}

bool key_route_report_down(const uint8_t report[8]) {
    for (int i = 0; i < 8; i++) {
        if (i != 1 && report[i]) return true;
    }
    return false;
}

static size_t fitted(int len, size_t n) {
    return (len > 0 && (size_t)len < n) ? (size_t)len : 0;
}

size_t key_route_format_kb(const uint8_t r[8], char* out, size_t n) {
    return fitted(snprintf(out, n, "{\"kb\":\"%02x%02x%02x%02x%02x%02x%02x\"}\n",
                           r[0], r[2], r[3], r[4], r[5], r[6], r[7]), n);
}

size_t key_route_format_cc(uint16_t usage, char* out, size_t n) {
    return fitted(snprintf(out, n, "{\"cc\":%u}\n", (unsigned)usage), n);
}
