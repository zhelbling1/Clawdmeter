#include "pet_props.h"
#include "theme.h"
#include "layout.h"
#include "hal/board_caps.h"
#include <Arduino.h>
#include <lvgl.h>
#include <string.h>

LV_FONT_DECLARE(font_styrene_28);

// Timings (ms). Each prop is a phase 0..1000 of its own cycle, derived from
// millis(); nothing is stored per frame but the time it started.
#define Z_CYCLE    2400
#define Z_STAGGER  650
#define N_Z        3
#define SWEAT_MS   1000
#define SWEAT_GAP  600
#define ORBIT_MS   2000
#define FRAME_MS   33

#define COL_INK    lv_color_hex(0x141413)    // the pill's text
#define COL_PILL   lv_color_hex(0xFAF9F5)    // ivory
#define COL_DROP   lv_color_hex(0x8FD3FF)

static lv_obj_t* obj = NULL;
static int mind = 480;
static int S(int v) { return v * mind / 480; }

struct Prop { bool on; int x, y; uint32_t t0; };
static Prop sweat, zzz, dot, pill;
static int  orbit_r = 0;
static int  dot_x = 0, dot_y = 0;
static char pill_text[16];
static int  pill_w = 0, pill_h = 0;
static uint32_t pill_ms = 0;
static uint32_t last_frame = 0;
// What was drawn last frame, per prop, to repaint where it left.
static lv_area_t drawn[4];
static bool      drawn_valid[4];

static lv_opa_t env(int v, int in, int out) {   // in over the first `in` permille, out over the last `out`
    int a = 255;
    if (v < in) a = 255 * v / in;
    else if (v > 1000 - out) a = 255 * (1000 - v) / out;
    return (lv_opa_t)(a < 0 ? 0 : a > 255 ? 255 : a);
}

// ---- where each prop is at `now` (also used for invalidation) ----
static bool sweat_box(uint32_t now, lv_area_t* a, lv_opa_t* opa) {
    if (!sweat.on) return false;
    const uint32_t t = (now - sweat.t0) % (SWEAT_MS + SWEAT_GAP);
    if (t >= SWEAT_MS) return false;
    const int v = (int)(t * 1000 / SWEAT_MS);
    const int w = S(18) > 2 ? S(18) : 2, h = S(26) > 2 ? S(26) : 2;
    const int y = sweat.y - h / 2 + S(70) * v / 1000;
    *a = { sweat.x - w / 2, y, sweat.x + w / 2, y + h };
    *opa = env(v, 120, 450);
    return true;
}

static bool z_pos(uint32_t now, int i, int* x, int* y, lv_opa_t* opa) {
    const int32_t t = (int32_t)(now - zzz.t0) - i * Z_STAGGER;
    if (t < 0) return false;
    const int v = (int)((uint32_t)t % Z_CYCLE * 1000 / Z_CYCLE);
    const int reach = 1000 + i * 250;      // later letters drift further: z, z, Z
    *x = zzz.x + S(46) * reach / 1000 * v / 1000;
    *y = zzz.y - S(64) * reach / 1000 * v / 1000;
    *opa = env(v, 180, 400);
    return true;
}

static void zzz_box(lv_area_t* a) {   // everywhere the letters can be
    const int g = S(36);
    *a = { zzz.x - g, zzz.y - S(64) * 3 / 2 - g, zzz.x + S(46) * 3 / 2 + g, zzz.y + g };
}

static void dot_place(uint32_t now) {
    const int deg = (int)((now - dot.t0) % ORBIT_MS * 360 / ORBIT_MS);
    dot_x = dot.x + (int)((int64_t)lv_trigo_cos(deg) * orbit_r / 32768);
    dot_y = dot.y + (int)((int64_t)lv_trigo_sin(deg) * orbit_r / 32768);
}

static bool pill_state(uint32_t now, int* dy, lv_opa_t* opa) {
    if (!pill.on) return false;
    const uint32_t t = now - pill.t0;
    if (t >= pill_ms) return false;
    // Pop: hops up past its spot and settles in 220 ms, then fades.
    int d = 0;
    if (t < 140)      d = S(18) - S(24) * (int)t / 140;
    else if (t < 220) d = -S(6) + S(6) * ((int)t - 140) / 80;
    int a = 255;
    if (t < 120) a = 255 * (int)t / 120;
    if (t + 300 > pill_ms) a = 255 * (int)(pill_ms - t) / 300;
    *dy = d;
    *opa = (lv_opa_t)(a < 0 ? 0 : a > 255 ? 255 : a);
    return true;
}

static void pill_box(lv_area_t* a) {   // the pill through its whole hop
    *a = { pill.x - pill_w / 2 - 2, pill.y - pill_h / 2 - S(8), pill.x + pill_w / 2 + 2, pill.y + pill_h / 2 + S(20) };
}

static void draw_cb(lv_event_t* e) {
    lv_layer_t* layer = lv_event_get_layer(e);
    const uint32_t now = millis();
    lv_area_t a;
    lv_opa_t opa;

    lv_draw_rect_dsc_t r;
    lv_draw_rect_dsc_init(&r);
    if (sweat_box(now, &a, &opa)) {
        r.bg_color = COL_DROP;
        r.bg_opa = opa;
        r.radius = S(9);
        lv_draw_rect(layer, &r, &a);
    }
    if (dot.on) {
        const int d = S(14) > 2 ? S(14) : 2;
        r.bg_color = theme_color(TH_EYE);
        r.bg_opa = LV_OPA_COVER;
        r.radius = LV_RADIUS_CIRCLE;
        a = { dot_x - d / 2, dot_y - d / 2, dot_x - d / 2 + d - 1, dot_y - d / 2 + d - 1 };
        lv_draw_rect(layer, &r, &a);
    }
    lv_draw_label_dsc_t l;
    lv_draw_label_dsc_init(&l);
    l.font = &font_styrene_28;
    if (zzz.on) {
        l.color = theme_color(TH_EYE);
        for (int i = 0; i < N_Z; i++) {
            int x, y;
            if (!z_pos(now, i, &x, &y, &opa)) continue;
            l.opa = opa;
            l.text = i == N_Z - 1 ? "Z" : "z";
            a = { x - S(14), y - S(18), x + S(20), y + S(18) };
            lv_draw_label(layer, &l, &a);
        }
    }
    int dy;
    if (pill_state(now, &dy, &opa)) {
        r.bg_color = COL_PILL;
        r.bg_opa = opa;
        r.radius = LV_RADIUS_CIRCLE;
        a = { pill.x - pill_w / 2, pill.y - pill_h / 2 + dy, pill.x + pill_w / 2, pill.y + pill_h / 2 + dy };
        lv_draw_rect(layer, &r, &a);
        l.color = COL_INK;
        l.opa = opa;
        l.text = pill_text;
        l.align = LV_TEXT_ALIGN_CENTER;
        const int th = lv_font_get_line_height(&font_styrene_28);
        lv_area_t ta = { a.x1, (a.y1 + a.y2) / 2 - th / 2, a.x2, (a.y1 + a.y2) / 2 + th / 2 };
        lv_draw_label(layer, &l, &ta);
    }
}

void props_init(void) {
    if (obj) return;
    const BoardCaps& c = board_caps();
    mind = c.width < c.height ? c.width : c.height;
    obj = lv_obj_create(lv_layer_top());
    lv_obj_remove_style_all(obj);
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, c.width, c.height);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(obj, draw_cb, LV_EVENT_DRAW_MAIN, NULL);
}

static bool any_on(void) { return sweat.on || zzz.on || dot.on || pill.on; }

static void show(void) {
    if (!obj) return;
    if (lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN)) {
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_HIDDEN);
        lv_obj_move_foreground(obj);
    }
}

void props_to_front(void) {
    if (obj) lv_obj_move_foreground(obj);
}

void props_sweat(bool on, int x, int y) {
    sweat = { on, x, y, (uint32_t)millis() };
    if (on) show();
}

void props_zzz(bool on, int x, int y) {
    zzz = { on, x, y, (uint32_t)millis() };
    if (on) show();
}

void props_thinking(bool on, int cx, int cy, int r) {
    dot = { on, cx, cy, (uint32_t)millis() };
    orbit_r = r;
    if (on) { dot_place(dot.t0); show(); }
}

bool props_thinking_pos(int* x, int* y) {
    if (!dot.on) return false;
    if (x) *x = dot_x;
    if (y) *y = dot_y;
    return true;
}

void props_bubble(const char* text, int x, int y, uint32_t ms) {
    if (!obj) return;
    if (pill.on) lv_obj_invalidate_area(obj, &drawn[3]);   // the last one, wherever it was
    strncpy(pill_text, text ? text : "", sizeof(pill_text) - 1);
    pill_text[sizeof(pill_text) - 1] = 0;
    pill_w = (int)layout_text_width(&font_styrene_28, pill_text) + 2 * S(22);
    pill_h = (int)lv_font_get_line_height(&font_styrene_28) + 2 * S(10);
    pill_ms = ms < 600 ? 600 : ms;
    pill = { true, x, y, (uint32_t)millis() };
    show();
}

void props_tick(uint32_t now) {
    if (!obj || lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN)) return;
    if (now - last_frame < FRAME_MS) return;
    last_frame = now;
    if (pill.on && now - pill.t0 >= pill_ms) pill.on = false;
    if (dot.on) dot_place(now);
    // Repaint each prop's box (and where it was last frame, for one that
    // just went off).
    lv_area_t box[4];
    bool on[4] = { sweat.on, zzz.on, dot.on, pill.on };
    if (on[0]) box[0] = { sweat.x - S(12), sweat.y - S(26), sweat.x + S(12), sweat.y + S(70) + S(26) };
    if (on[1]) zzz_box(&box[1]);
    if (on[2]) { const int g = S(14); box[2] = { dot.x - orbit_r - g, dot.y - orbit_r - g, dot.x + orbit_r + g, dot.y + orbit_r + g }; }
    if (on[3]) pill_box(&box[3]);
    for (int i = 0; i < 4; i++) {
        if (on[i]) { lv_obj_invalidate_area(obj, &box[i]); drawn[i] = box[i]; drawn_valid[i] = true; }
        else if (drawn_valid[i]) { lv_obj_invalidate_area(obj, &drawn[i]); drawn_valid[i] = false; }
    }
    if (!any_on()) lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
}

void props_hide_all(void) {
    sweat.on = zzz.on = dot.on = pill.on = false;
    for (int i = 0; i < 4; i++) drawn_valid[i] = false;
    if (obj) lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);   // hiding repaints what was under it
}
