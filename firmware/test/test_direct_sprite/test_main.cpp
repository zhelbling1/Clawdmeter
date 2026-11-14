// Host unit test for the pure part of direct_sprite.h: which cells a directly
// drawn sprite hands back to LVGL and which it paints, frame to frame, and
// how its shared blit buffer is sized and split. Ported from
// Faith012/Clawdmeter (https://github.com/Faith012/Clawdmeter).
//   pio test -d firmware -e native -f test_direct_sprite

#include "direct_sprite.h"
#include <unity.h>
#include <string.h>

void setUp(void) {}
void tearDown(void) {}

struct Runs {
    int n;
    int r[16], c0[16], c1[16];
};
struct Log { Runs back, paint; };

static void on_back(void* ctx, int r, int c0, int c1) {
    Runs& x = ((Log*)ctx)->back;
    x.r[x.n] = r; x.c0[x.n] = c0; x.c1[x.n] = c1; x.n++;
}
static void on_paint(void* ctx, int r, int c0, int c1) {
    Runs& x = ((Log*)ctx)->paint;
    x.r[x.n] = r; x.c0[x.n] = c0; x.c1[x.n] = c1; x.n++;
}

static Log diff(const char* drawn, const char* next, int cols, int rows, bool all = false) {
    uint8_t d[64], n[64];
    for (int i = 0; i < cols * rows; i++) { d[i] = drawn[i] - '0'; n[i] = next[i] - '0'; }
    Log log;
    memset(&log, 0, sizeof(log));
    direct_sprite_diff(d, n, cols, rows, all, on_back, on_paint, &log);
    return log;
}

static void first_frame_paints_its_coloured_runs(void) {
    Log l = diff("000000"
                 "000000",
                 "011010"
                 "000330", 6, 2);
    TEST_ASSERT_EQUAL_INT(0, l.back.n);
    TEST_ASSERT_EQUAL_INT(3, l.paint.n);
    TEST_ASSERT_TRUE(l.paint.r[0] == 0 && l.paint.c0[0] == 1 && l.paint.c1[0] == 3);
    TEST_ASSERT_TRUE(l.paint.r[1] == 0 && l.paint.c0[1] == 4 && l.paint.c1[1] == 5);
    TEST_ASSERT_TRUE(l.paint.r[2] == 1 && l.paint.c0[2] == 3 && l.paint.c1[2] == 5);
}

static void a_step_right_hands_back_the_trailing_cell(void) {
    Log l = diff("0220", "0022", 4, 1);
    TEST_ASSERT_EQUAL_INT(1, l.back.n);
    TEST_ASSERT_TRUE(l.back.c0[0] == 1 && l.back.c1[0] == 2);    // left behind
    TEST_ASSERT_EQUAL_INT(1, l.paint.n);
    TEST_ASSERT_TRUE(l.paint.c0[0] == 3 && l.paint.c1[0] == 4);  // only the new cell
}

static void unchanged_cells_are_left_alone(void) {
    Log l = diff("1234", "1234", 4, 1);
    TEST_ASSERT_EQUAL_INT(0, l.back.n);
    TEST_ASSERT_EQUAL_INT(0, l.paint.n);
}

static void a_new_palette_repaints_every_coloured_cell(void) {
    Log l = diff("1204", "1204", 4, 1, true);
    TEST_ASSERT_EQUAL_INT(0, l.back.n);
    TEST_ASSERT_EQUAL_INT(2, l.paint.n);
    TEST_ASSERT_TRUE(l.paint.c0[0] == 0 && l.paint.c1[0] == 2);
    TEST_ASSERT_TRUE(l.paint.c0[1] == 3 && l.paint.c1[1] == 4);
}

static void erasing_hands_back_everything(void) {
    Log l = diff("1100"
                 "0111",
                 "0000"
                 "0000", 4, 2);
    TEST_ASSERT_EQUAL_INT(0, l.paint.n);
    TEST_ASSERT_EQUAL_INT(2, l.back.n);
    TEST_ASSERT_TRUE(l.back.r[0] == 0 && l.back.c0[0] == 0 && l.back.c1[0] == 2);
    TEST_ASSERT_TRUE(l.back.r[1] == 1 && l.back.c0[1] == 1 && l.back.c1[1] == 4);
}

// On a 480 panel: the performer (60 cells of 8 px) fits the cap in one
// piece; the attention Clawd (40 cells of 12 px) is capped and goes out in
// two; a cell bigger than the cap still gets a one-cell strip.
static void the_strip_is_one_row_capped(void) {
    const size_t cap = DIRECT_SPRITE_STRIP_MAX_PX;
    TEST_ASSERT_EQUAL_UINT32(60 * 8 * 8, direct_sprite_strip_px(60, 8, cap));
    TEST_ASSERT_EQUAL_UINT32(cap, direct_sprite_strip_px(40, 12, cap));
    TEST_ASSERT_EQUAL_UINT32(80 * 80, direct_sprite_strip_px(6, 80, cap));
    TEST_ASSERT_EQUAL_UINT32(10 * 4 * 4, direct_sprite_strip_px(10, 4, cap));
}

static void a_capped_row_goes_out_in_pieces(void) {
    const size_t cap = DIRECT_SPRITE_STRIP_MAX_PX;
    TEST_ASSERT_EQUAL_INT(60, direct_sprite_cells_per_blit(direct_sprite_strip_px(60, 8, cap), 8));
    const int per = direct_sprite_cells_per_blit(direct_sprite_strip_px(40, 12, cap), 12);
    TEST_ASSERT_EQUAL_INT(26, per);                  // 3840 / 144
    TEST_ASSERT_TRUE((40 + per - 1) / per == 2);     // a whole row: two writes
    TEST_ASSERT_TRUE((size_t)per * 12 * 12 <= cap);
    TEST_ASSERT_EQUAL_INT(1, direct_sprite_cells_per_blit(80 * 80, 80));
    TEST_ASSERT_EQUAL_INT(1, direct_sprite_cells_per_blit(10, 8));   // never zero
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(first_frame_paints_its_coloured_runs);
    RUN_TEST(a_step_right_hands_back_the_trailing_cell);
    RUN_TEST(unchanged_cells_are_left_alone);
    RUN_TEST(a_new_palette_repaints_every_coloured_cell);
    RUN_TEST(erasing_hands_back_everything);
    RUN_TEST(the_strip_is_one_row_capped);
    RUN_TEST(a_capped_row_goes_out_in_pieces);
    return UNITY_END();
}
