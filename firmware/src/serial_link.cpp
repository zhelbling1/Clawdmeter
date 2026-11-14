// USB serial data link (serial_link.h). Everything runs on the loop task:
// check_serial_cmd() feeds lines and the loop takes them, so no locking.
#include "serial_link.h"

#include <Arduino.h>
#include <string.h>

#define SERIAL_LINK_BUF 512   // the BLE RX buffer's size: the app caps payloads at 500 B

// One buffer: main.cpp takes a payload and parses it in the same loop pass,
// before check_serial_cmd() can feed the next line (the classic ESP32
// boards have no static RAM to spare for a second copy).
static char     pending[SERIAL_LINK_BUF];
static bool     have_pending = false;
static bool     ever_received = false;
static uint32_t last_rx_ms = 0;

void serial_link_feed(const char* line) {
    size_t len = strlen(line);
    if (len >= sizeof(pending)) {
        serial_link_overflow();
        return;
    }
    memcpy(pending, line, len + 1);
    have_pending = true;
    ever_received = true;
    last_rx_ms = millis();
}

void serial_link_ping(void) {
    ever_received = true;
    last_rx_ms = millis();
}

void serial_link_overflow(void) {
    Serial.println("USB: payload too long, dropped");
    serial_link_send_ack(false);
}

bool serial_link_has_data(void) {
    return have_pending;
}

const char* serial_link_get_data(void) {
    have_pending = false;
    return pending;
}

bool serial_link_active(void) {
    return ever_received && (millis() - last_rx_ms) < SERIAL_LINK_FRESH_MS;
}

void serial_link_send_ack(bool ok) {
    Serial.println(ok ? "{\"ack\":true}" : "{\"err\":true}");
}

void serial_link_send_dismiss(void) {
    Serial.println("{\"dismiss\":true}");
    Serial.println("USB: alert dismissed on the device");
}
