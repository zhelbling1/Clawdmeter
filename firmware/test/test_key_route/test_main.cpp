// key_route: which link a button's keys take, and their USB serial lines.
//   pio test -d firmware -e native -f test_key_route
#include <unity.h>
#include <string.h>
#include "key_route.h"

void setUp(void) {}
void tearDown(void) {}

static void test_bluetooth_first_never_both(void) {
    // A fresh press: BLE if a host subscribed, else USB if the link is up.
    TEST_ASSERT_EQUAL(KEY_ROUTE_BLE, key_route_pick(KEY_ROUTE_NONE, true, true));
    TEST_ASSERT_EQUAL(KEY_ROUTE_BLE, key_route_pick(KEY_ROUTE_NONE, true, false));
    TEST_ASSERT_EQUAL(KEY_ROUTE_USB, key_route_pick(KEY_ROUTE_NONE, false, true));
    TEST_ASSERT_EQUAL(KEY_ROUTE_NONE, key_route_pick(KEY_ROUTE_NONE, false, false));
}

static void test_held_keys_keep_their_link(void) {
    // Space went down over USB, then a host subscribed: it comes up on USB.
    TEST_ASSERT_EQUAL(KEY_ROUTE_USB, key_route_pick(KEY_ROUTE_USB, true, true));
    // Down over BLE, then the host left: the release still goes to BLE
    // (which drops it; the host let go when the link went).
    TEST_ASSERT_EQUAL(KEY_ROUTE_BLE, key_route_pick(KEY_ROUTE_BLE, false, true));
    // Down over USB and the link went stale: the release still goes out.
    TEST_ASSERT_EQUAL(KEY_ROUTE_USB, key_route_pick(KEY_ROUTE_USB, false, false));
}

static void test_report_down(void) {
    uint8_t r[8] = {0};
    TEST_ASSERT_FALSE(key_route_report_down(r));
    r[1] = 0xFF;   // the reserved byte doesn't count
    TEST_ASSERT_FALSE(key_route_report_down(r));
    r[0] = 0x02;
    TEST_ASSERT_TRUE(key_route_report_down(r));
    r[0] = 0;
    r[7] = 0x2C;
    TEST_ASSERT_TRUE(key_route_report_down(r));
}

static void test_keyboard_line(void) {
    char line[KEY_ROUTE_LINE_MAX];
    const uint8_t shift_tab[8] = {0x02, 0, 0x2B, 0, 0, 0, 0, 0};
    TEST_ASSERT_EQUAL(24, key_route_format_kb(shift_tab, line, sizeof(line)));
    TEST_ASSERT_EQUAL_STRING("{\"kb\":\"022b0000000000\"}\n", line);
    const uint8_t up[8] = {0, 0x55, 0, 0, 0, 0, 0, 0};   // reserved byte left out
    key_route_format_kb(up, line, sizeof(line));
    TEST_ASSERT_EQUAL_STRING("{\"kb\":\"00000000000000\"}\n", line);
    const uint8_t full[8] = {0xFF, 0, 0x04, 0x05, 0x06, 0x07, 0x08, 0x73};
    key_route_format_kb(full, line, sizeof(line));
    TEST_ASSERT_EQUAL_STRING("{\"kb\":\"ff040506070873\"}\n", line);
    // Too small a buffer: nothing to send.
    TEST_ASSERT_EQUAL(0, key_route_format_kb(full, line, 24));
}

static void test_consumer_line(void) {
    char line[KEY_ROUTE_LINE_MAX];
    TEST_ASSERT_EQUAL(11, key_route_format_cc(0xCD, line, sizeof(line)));
    TEST_ASSERT_EQUAL_STRING("{\"cc\":205}\n", line);
    key_route_format_cc(0, line, sizeof(line));
    TEST_ASSERT_EQUAL_STRING("{\"cc\":0}\n", line);
    key_route_format_cc(0xFFFF, line, sizeof(line));
    TEST_ASSERT_EQUAL_STRING("{\"cc\":65535}\n", line);
    TEST_ASSERT_EQUAL(0, key_route_format_cc(0xCD, line, 4));
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_bluetooth_first_never_both);
    RUN_TEST(test_held_keys_keep_their_link);
    RUN_TEST(test_report_down);
    RUN_TEST(test_keyboard_line);
    RUN_TEST(test_consumer_line);
    return UNITY_END();
}
