#include "party.h"
#include "theme.h"
#include "idle.h"
#include "hal/board_caps.h"
#include <Arduino.h>
#include <lvgl.h>
#include <math.h>

// Confetti: NP particles launched from the bottom centre and both bottom
// corners, under gravity and drag, spinning; a rotated rectangle is drawn as
// a thick line along its long axis, a round one as a circle. Glow: nested
// hollow rectangles, each band fainter, eased in and out per pulse.
#define NP           60
#define CONF_MS      2500
#define FADE_MS      500
#define PULSE_MS     1200
#define FRAME_MS     33          // ~30 fps
#define GLOW_BANDS   6
#define GLOW_MAX_OPA 150

struct Particle {
    float   x, y, vx, vy, ang, spin;
    uint8_t w, h, col, kind;     // kind: 0 strip, 1 square, 2 round
};

static lv_obj_t* obj = NULL;
static int W = 480, H = 480;
static float scale = 1.0f;
static Particle ps[NP];
static bool conf_on = false, glow_on = false, shown = false;
static uint32_t conf_t0 = 0, glow_t0 = 0, last_ms = 0, rng_s = 2463534242u;
static int glow_pulses = 0;
static uint32_t glow_rgb = 0;
static uint8_t conf_opa = 255, glow_opa = 0;
static lv_area_t dirty;          // the particles' bounding box as last drawn
static bool dirty_valid = false;

static uint32_t rnd(void) { rng_s ^= rng_s << 13; rng_s ^= rng_s >> 17; rng_s ^= rng_s << 5; return rng_s; }
static float rndf(float a, float b) { return a + (rnd() & 0xFFFF) * (b - a) / 65535.0f; }

// Clawd orange, the palette's accent, green and amber, and its text colour.
static lv_color_t palette(int i) {
    switch (i) {
        case 0:  return theme_color(TH_CLAWD);
        case 1:  return theme_color(TH_AMBER);
        case 2:  return theme_color(TH_GREEN);
        case 3:  return lv_color_hex(0x4AA3FF);
        default: return theme_color(TH_TEXT);
    }
}

static int glow_band_w(void) {
    const int bw = W * 6 / 100 / GLOW_BANDS;
    return bw > 0 ? bw : 1;
}

static void draw_cb(lv_event_t* e) {
    lv_layer_t* layer = lv_event_get_layer(e);

    if (glow_on && glow_opa) {
        const int bw = glow_band_w();
        lv_draw_rect_dsc_t d;
        lv_draw_rect_dsc_init(&d);
        d.bg_opa = LV_OPA_TRANSP;
        d.border_color = lv_color_hex(glow_rgb);
        d.border_width = bw;
        // Round panels: the bands follow the circle.
        d.radius = board_caps().round_panel ? LV_RADIUS_CIRCLE : 0;
        for (int k = 0; k < GLOW_BANDS; k++) {
            const int f = GLOW_BANDS - k;                       // outer band strongest
            d.border_opa = (lv_opa_t)((int)glow_opa * f * f / (GLOW_BANDS * GLOW_BANDS));
            lv_area_t a = { k * bw, k * bw, W - 1 - k * bw, H - 1 - k * bw };
            lv_draw_rect(layer, &d, &a);
        }
    }

    if (conf_on) {
        lv_draw_rect_dsc_t r;
        lv_draw_rect_dsc_init(&r);
        r.bg_opa = conf_opa;
        r.radius = LV_RADIUS_CIRCLE;
        lv_draw_line_dsc_t l;
        lv_draw_line_dsc_init(&l);
        l.opa = conf_opa;
        const lv_area_t clip = layer->_clip_area;
        for (int i = 0; i < NP; i++) {
            const Particle& p = ps[i];
            if (p.y > H + 16 || p.x < -16 || p.x > W + 16) continue;
            // Only what touches the strip being drawn: LVGL renders in strips
            // and every queued shape costs a draw task.
            const int m = p.w + 2;
            if ((int)p.y + m < clip.y1 || (int)p.y - m > clip.y2) continue;
            const lv_color_t c = palette(p.col);
            if (p.kind == 2) {
                r.bg_color = c;
                lv_area_t a = { (int)p.x - p.w / 2, (int)p.y - p.w / 2,
                                (int)p.x + p.w / 2, (int)p.y + p.w / 2 };
                lv_draw_rect(layer, &r, &a);
            } else {
                const float ca = cosf(p.ang), sa = sinf(p.ang), hl = p.w * 0.5f;
                l.color = c;
                l.width = p.h;
                l.p1.x = p.x - ca * hl; l.p1.y = p.y - sa * hl;
                l.p2.x = p.x + ca * hl; l.p2.y = p.y + sa * hl;
                lv_draw_line(layer, &l);
            }
        }
    }
}

static void spawn(void) {
    for (int i = 0; i < NP; i++) {
        Particle& p = ps[i];
        const int src = i % 3;                    // 0 centre, 1 left corner, 2 right corner
        float base;                               // launch angle from +x, up is negative
        if (src == 0)      { p.x = W * 0.5f; base = -1.5708f; }
        else if (src == 1) { p.x = 0;        base = -1.0f; }
        else               { p.x = (float)W; base = -2.14f; }
        p.y = (float)H;
        const float a = base + rndf(-0.4f, 0.4f);
        const float sp = rndf(520, 950) * scale;
        p.vx = cosf(a) * sp;
        p.vy = sinf(a) * sp;
        p.ang = rndf(0, 6.28f);
        p.spin = rndf(-9, 9);
        p.col = rnd() % 5;
        const uint32_t k = rnd() % 10;
        p.kind = k < 2 ? 2 : (k < 6 ? 1 : 0);
        const float s = scale > 0.5f ? scale : 0.5f;
        if (p.kind == 0)      { p.w = (uint8_t)(rndf(12, 18) * s); p.h = (uint8_t)(rndf(5, 8) * s); }
        else if (p.kind == 1) { p.w = p.h = (uint8_t)(rndf(8, 12) * s); }
        else                  { p.w = (uint8_t)(rndf(7, 11) * s); p.h = p.w; }
        if (p.h < 2) p.h = 2;
    }
}

static void show(void) {
    // Always on top: the face may have risen (moved to the front) since.
    lv_obj_move_foreground(obj);
    if (shown) return;
    shown = true;
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_HIDDEN);
}

void party_init(void) {
    if (obj) return;
    const BoardCaps& caps = board_caps();
    W = caps.width; H = caps.height;
    scale = (W < H ? W : H) / 480.0f;
    obj = lv_obj_create(lv_layer_top());
    lv_obj_remove_style_all(obj);
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, W, H);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(obj, draw_cb, LV_EVENT_DRAW_MAIN, NULL);
    rng_s ^= micros() | 1;
}

void party_confetti(void) {
    if (!obj) return;
    spawn();
    conf_on = true;
    conf_opa = 255;
    conf_t0 = last_ms = millis();
    dirty_valid = false;
    show();
    lv_obj_invalidate(obj);
}

void party_glow(uint32_t rgb, int pulses) {
    if (!obj || pulses <= 0) return;
    glow_rgb = rgb;
    glow_pulses = pulses;
    glow_on = true;
    glow_opa = 0;
    glow_t0 = millis();
    if (!conf_on) last_ms = glow_t0;
    show();
}

bool party_active(void) { return conf_on || glow_on; }

void party_stop(void) {
    if (!obj || !shown) return;
    conf_on = glow_on = false;
    dirty_valid = false;
    shown = false;
    lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);   // hiding repaints what was under it
}

// Only the four edge strips the glow covers.
static void inval_glow(void) {
    const int b = glow_band_w() * GLOW_BANDS + 1;
    lv_area_t a;
    a = { 0, 0, W - 1, b };                  lv_obj_invalidate_area(obj, &a);
    a = { 0, H - 1 - b, W - 1, H - 1 };      lv_obj_invalidate_area(obj, &a);
    a = { 0, b, b, H - 2 - b };              lv_obj_invalidate_area(obj, &a);
    a = { W - 1 - b, b, W - 1, H - 2 - b };  lv_obj_invalidate_area(obj, &a);
}

void party_tick(void) {
    if (!obj || !(conf_on || glow_on)) return;
    if (idle_is_asleep()) { party_stop(); return; }   // nobody's looking: don't burn frames on it
    const uint32_t now = millis();
    if (now - last_ms < FRAME_MS) return;
    float dt = (now - last_ms) / 1000.0f;
    if (dt > 0.1f) dt = 0.1f;
    last_ms = now;

    if (conf_on) {
        const uint32_t t = now - conf_t0;
        if (t >= CONF_MS) {
            conf_on = false;
            if (dirty_valid) lv_obj_invalidate_area(obj, &dirty);
            dirty_valid = false;
        } else {
            conf_opa = t > CONF_MS - FADE_MS ? (uint8_t)(255 * (CONF_MS - t) / FADE_MS) : 255;
            const float g = 950.0f * scale, drag = 1.0f - 0.7f * dt;
            lv_area_t u = dirty;
            const bool have = dirty_valid;
            int x1 = 1 << 30, y1 = 1 << 30, x2 = -(1 << 30), y2 = -(1 << 30);
            for (int i = 0; i < NP; i++) {
                Particle& p = ps[i];
                p.vy += g * dt;
                p.vx = p.vx * drag + rndf(-30, 30) * dt * 10.0f;   // a little flutter
                p.x += p.vx * dt; p.y += p.vy * dt; p.ang += p.spin * dt;
                if (p.y > H + 16 || p.x < -16 || p.x > W + 16) continue;
                const int m = p.w + 4;
                if ((int)p.x - m < x1) x1 = (int)p.x - m;
                if ((int)p.y - m < y1) y1 = (int)p.y - m;
                if ((int)p.x + m > x2) x2 = (int)p.x + m;
                if ((int)p.y + m > y2) y2 = (int)p.y + m;
            }
            if (x2 >= x1) {
                lv_area_t n = { x1 < 0 ? 0 : x1, y1 < 0 ? 0 : y1, x2 >= W ? W - 1 : x2, y2 >= H ? H - 1 : y2 };
                if (have) {            // old and new positions in one area
                    if (n.x1 < u.x1) u.x1 = n.x1;
                    if (n.y1 < u.y1) u.y1 = n.y1;
                    if (n.x2 > u.x2) u.x2 = n.x2;
                    if (n.y2 > u.y2) u.y2 = n.y2;
                } else {
                    u = n;
                }
                lv_obj_invalidate_area(obj, &u);
                dirty = n;
                dirty_valid = true;
            } else {
                if (have) lv_obj_invalidate_area(obj, &u);
                dirty_valid = false;
            }
        }
    }

    if (glow_on) {
        const uint32_t t = now - glow_t0;
        if (t >= (uint32_t)glow_pulses * PULSE_MS) {
            glow_on = false;
            glow_opa = 0;
        } else {
            const float ph = (float)(t % PULSE_MS) / PULSE_MS;   // sin^2 over each pulse
            const float s = sinf(ph * 3.14159265f);
            glow_opa = (uint8_t)(GLOW_MAX_OPA * s * s);
        }
        inval_glow();
    }

    if (!conf_on && !glow_on) {
        shown = false;
        lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);   // hiding repaints what was under it
    }
}
