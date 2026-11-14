#include "savers.h"
#include "theme.h"
#include "idle.h"
#include "hal/board_caps.h"
#include <Arduino.h>
#include <lvgl.h>
#include <math.h>
#include <string.h>

LV_FONT_DECLARE(font_mono_18);

#define PEAK_OPA 178            // ~70 % of full
#define PI_F     3.14159265f

static lv_obj_t* obj = NULL;
static int W = 480, H = 480;
static float scale = 1.0f, CX = 240, CY = 240, RAD = 240;
static bool round_panel = false;
static int kind_cur = -1;
static uint32_t last_ms = 0, rng_s = 2463534242u;

static uint32_t rnd(void) { rng_s ^= rng_s << 13; rng_s ^= rng_s >> 17; rng_s ^= rng_s << 5; return rng_s; }
static float rndf(float a, float b) { return a + (rnd() & 0xFFFF) * (b - a) / 65535.0f; }

// Clawd's orange and its lighter shimmer, from the live palette.
static lv_color_t c_orange(void) { return theme_color(TH_CLAWD); }
static lv_color_t c_shimmer(void) { return lv_color_mix(theme_color(TH_CLAWD), lv_color_white(), 170); }
static const uint32_t C_BLUE = 0x4AA3FF;

static const char* const NAMES[SAVER_COUNT] = { "starfield", "code rain", "constellation" };
// Every effect frame repaints the whole screen (the stars and the dots are
// everywhere). Without PSRAM LVGL renders it in small partial strips and the
// flush is the cost, so those boards run the effects at about 12 fps.
#ifdef BOARD_HAS_PSRAM
static const uint16_t FRAME_MS[SAVER_COUNT] = { 33, 50, 50 };
#else
static const uint16_t FRAME_MS[SAVER_COUNT] = { 80, 80, 80 };
#endif

// One effect at a time: their particles share one block.
#define NSTAR   90
#define NSTREAM 26
#define MAXLEN  20
#define NDOT    40
struct Star { float x, y, z; uint8_t tint; };
struct RainStream { int16_t col, len; float head, speed; char ch[MAXLEN][2]; };
struct Dot { float x, y, vx, vy; uint8_t blue; };
static union {
    Star       stars[NSTAR];
    RainStream st[NSTREAM];
    Dot        dots[NDOT];
} fx;

// ---------------------------------------------------------------- starfield
static void star_respawn(Star& s, bool anywhere) {
    const float a = rndf(0, 2 * PI_F), r = sqrtf(rndf(0.02f, 1.0f));
    s.x = cosf(a) * r; s.y = sinf(a) * r;
    s.z = anywhere ? rndf(0.08f, 1.0f) : rndf(0.85f, 1.0f);
    s.tint = rnd() % 3 ? 0 : 1;      // 0 near-white, 1 shimmer
}
static void stars_init(void) { for (int i = 0; i < NSTAR; i++) star_respawn(fx.stars[i], true); }
static void stars_step(float dt) {
    for (int i = 0; i < NSTAR; i++) {
        Star& s = fx.stars[i];
        s.z -= (0.22f + 0.5f * (1.0f - s.z)) * dt;      // speeding up toward the viewer
        const float inv = 1.0f / s.z;
        if (s.z < 0.04f || fabsf(s.x * inv) > 2.3f || fabsf(s.y * inv) > 2.3f) star_respawn(s, false);
    }
}
static void stars_draw(lv_layer_t* layer) {
    lv_draw_line_dsc_t l; lv_draw_line_dsc_init(&l);
    lv_draw_rect_dsc_t r; lv_draw_rect_dsc_init(&r);
    r.radius = LV_RADIUS_CIRCLE;
    const float f = RAD * 0.5f;
    const lv_color_t warm = lv_color_mix(c_orange(), lv_color_white(), 40), shim = c_shimmer();
    const lv_area_t clip = layer->_clip_area;
    for (int i = 0; i < NSTAR; i++) {
        const Star& s = fx.stars[i];
        const float inv = 1.0f / s.z;
        const float x = CX + s.x * inv * f, y = CY + s.y * inv * f;
        const float zp = s.z + 0.03f + 0.10f * (1.0f - s.z);   // a short trail behind it
        const float ip = 1.0f / zp;
        const float px = CX + s.x * ip * f, py = CY + s.y * ip * f;
        if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
        // Only the stars in the strip being drawn (as rain_draw does): LVGL
        // renders in strips, and queueing all of them for every strip can
        // run its draw-task pool dry.
        const float ty = y < py ? y : py, by = y < py ? py : y;
        const float lx = x < px ? x : px, rx = x < px ? px : x;
        if (by + 4 < clip.y1 || ty - 4 > clip.y2 || rx + 4 < clip.x1 || lx - 4 > clip.x2) continue;
        const float b = 1.0f - s.z;
        const int opa = 30 + (int)(b * (PEAK_OPA - 30));
        const lv_color_t c = s.tint ? shim : warm;
        const float dx = x - px, dy = y - py;
        int sw = (b > 0.6f ? 3 : (b > 0.3f ? 2 : 1));
        if (scale < 0.7f && sw > 1) sw--;
        if (dx * dx + dy * dy < 4.0f) {
            r.bg_color = c; r.bg_opa = opa;
            const int rr = sw > 1 ? 1 : 0;
            lv_area_t a = { (int)x - rr, (int)y - rr, (int)x + rr, (int)y + rr };
            lv_draw_rect(layer, &r, &a);
        } else {
            l.color = c; l.opa = opa; l.width = sw;
            l.p1.x = px; l.p1.y = py; l.p2.x = x; l.p2.y = y;
            lv_draw_line(layer, &l);
        }
    }
}

// ---------------------------------------------------------------- code rain
static int rain_cw = 11, rain_ch = 20, rain_cols = 40;
static const lv_font_t* rain_font;

static char rand_char(void) { return (char)(33 + rnd() % 94); }

static void stream_respawn(RainStream& s, bool initial) {
    s.len = 0;                       // out of the clash check below
    for (int tries = 0; tries < 8; tries++) {
        s.col = (int16_t)(rnd() % rain_cols);
        bool clash = false;
        for (int k = 0; k < NSTREAM; k++)
            if (fx.st[k].len && fx.st[k].col == s.col) clash = true;
        if (!clash) break;
    }
    s.len = (int16_t)(6 + (int)(rnd() % (MAXLEN - 6)));
    s.speed = rndf(5, 12);
    const int rows = H / rain_ch;
    s.head = initial ? rndf(-(float)rows, (float)rows) : -rndf(1, 30);
    for (int i = 0; i < MAXLEN; i++) { s.ch[i][0] = rand_char(); s.ch[i][1] = 0; }
}
static void rain_init(void) {
    rain_font = &font_mono_18;
    rain_cw = lv_font_get_glyph_width(rain_font, 'M', 0);
    if (rain_cw < 4) rain_cw = 11;
    rain_ch = lv_font_get_line_height(rain_font);
    if (rain_ch < 4) rain_ch = 20;
    rain_cols = W / rain_cw;
    if (rain_cols < 1) rain_cols = 1;
    for (int i = 0; i < NSTREAM; i++) fx.st[i].len = 0;
    for (int i = 0; i < NSTREAM; i++) stream_respawn(fx.st[i], true);
}
static void rain_step(float dt) {
    const int rows = H / rain_ch + 1;
    for (int i = 0; i < NSTREAM; i++) {
        RainStream& s = fx.st[i];
        const int before = (int)floorf(s.head);
        s.head += s.speed * dt;
        const int steps = (int)floorf(s.head) - before;
        for (int k = 0; k < steps && k < 3; k++) {
            memmove(&s.ch[1][0], &s.ch[0][0], (MAXLEN - 1) * 2);
            s.ch[0][0] = rand_char(); s.ch[0][1] = 0;
        }
        if (rnd() % 6 == 0) s.ch[1 + rnd() % (MAXLEN - 1)][0] = rand_char();   // the tail flickers
        if (s.head - s.len > rows) stream_respawn(s, false);
    }
}
static void rain_draw(lv_layer_t* layer) {
    lv_draw_label_dsc_t d; lv_draw_label_dsc_init(&d);
    d.font = rain_font; d.align = LV_TEXT_ALIGN_LEFT;
    const lv_color_t head = c_shimmer(), mid = c_orange(), dark = lv_color_mix(c_orange(), lv_color_black(), 90);
    const int x0 = (W - rain_cols * rain_cw) / 2;
    const float rr = RAD + rain_ch * 0.5f;
    const lv_area_t clip = layer->_clip_area;
    for (int i = 0; i < NSTREAM; i++) {
        const RainStream& s = fx.st[i];
        const int hr = (int)floorf(s.head);
        const int x = x0 + s.col * rain_cw;
        for (int k = 0; k < s.len; k++) {
            const int y = (hr - k) * rain_ch;
            if (y < -rain_ch || y >= H) continue;
            // Only the glyphs in the strip being drawn: LVGL renders in
            // strips, and queueing every glyph for every strip can run its
            // draw-task pool dry.
            if (y + rain_ch < clip.y1 || y > clip.y2 || x + rain_cw + 2 < clip.x1 || x > clip.x2) continue;
            if (round_panel) {
                const float dx = x + rain_cw * 0.5f - CX, dy = y + rain_ch * 0.5f - CY;
                if (dx * dx + dy * dy > rr * rr) continue;
            }
            const float t = (float)k / s.len;
            if (k == 0)      { d.color = head; d.opa = PEAK_OPA; }
            else if (k == 1) { d.color = lv_color_mix(head, mid, 90); d.opa = 160; }
            else {
                d.color = lv_color_mix(dark, mid, (uint8_t)(t * 255));
                d.opa = (lv_opa_t)(140 * (1.0f - t) + 22);
            }
            d.text = s.ch[k];        // stable until the next step, after this frame
            lv_area_t a = { x, y, x + rain_cw + 2, y + rain_ch };
            lv_draw_label(layer, &d, &a);
        }
    }
}

// ---------------------------------------------------------------- constellation
static void dots_init(void) {
    for (int i = 0; i < NDOT; i++) {
        Dot& d = fx.dots[i];
        d.x = rndf(0, (float)W); d.y = rndf(0, (float)H);
        const float a = rndf(0, 2 * PI_F), sp = rndf(6, 18) * scale;
        d.vx = cosf(a) * sp; d.vy = sinf(a) * sp;
        d.blue = (rnd() % 3) != 0;
    }
}
static void dots_step(float dt) {
    const float m = 10 * scale;
    for (int i = 0; i < NDOT; i++) {
        Dot& d = fx.dots[i];
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.x < -m) d.x += W + 2 * m; else if (d.x > W + m) d.x -= W + 2 * m;
        if (d.y < -m) d.y += H + 2 * m; else if (d.y > H + m) d.y -= H + 2 * m;
    }
}
static void dots_draw(lv_layer_t* layer) {
    lv_draw_line_dsc_t l; lv_draw_line_dsc_init(&l);
    l.width = 1;
    const float D = 90.0f * scale, D2 = D * D;
    const lv_color_t cb = lv_color_hex(C_BLUE), co = c_orange();
    const lv_area_t clip = layer->_clip_area;
    for (int i = 0; i < NDOT; i++)
        for (int j = i + 1; j < NDOT; j++) {
            const Dot& a = fx.dots[i];
            const Dot& b = fx.dots[j];
            const float dx = a.x - b.x, dy = a.y - b.y;
            const float q = dx * dx + dy * dy;
            if (q >= D2) continue;
            const float top = a.y < b.y ? a.y : b.y, bot = a.y < b.y ? b.y : a.y;
            if (bot < clip.y1 || top > clip.y2) continue;
            const float f = 1.0f - sqrtf(q) / D;
            l.opa = (lv_opa_t)(10 + 100 * f);
            l.color = a.blue == b.blue ? (a.blue ? cb : co) : lv_color_mix(cb, co, 128);
            l.p1.x = a.x; l.p1.y = a.y; l.p2.x = b.x; l.p2.y = b.y;
            lv_draw_line(layer, &l);
        }
    lv_draw_rect_dsc_t r; lv_draw_rect_dsc_init(&r);
    r.radius = LV_RADIUS_CIRCLE; r.bg_opa = 150;
    const int rr = scale < 0.7f ? 1 : 2;
    for (int i = 0; i < NDOT; i++) {
        const Dot& d = fx.dots[i];
        if (d.y + rr < clip.y1 || d.y - rr > clip.y2 || d.x + rr < clip.x1 || d.x - rr > clip.x2) continue;
        r.bg_color = d.blue ? cb : co;
        lv_area_t a = { (int)d.x - rr, (int)d.y - rr, (int)d.x + rr, (int)d.y + rr };
        lv_draw_rect(layer, &r, &a);
    }
}

// ---------------------------------------------------------------- glue
static void draw_cb(lv_event_t* e) {
    lv_layer_t* layer = lv_event_get_layer(e);
    switch (kind_cur) {
        case 0: stars_draw(layer); break;
        case 1: rain_draw(layer); break;
        case 2: dots_draw(layer); break;
        default: break;
    }
}

void saver_init(void) {
    if (obj) return;
    const BoardCaps& caps = board_caps();
    W = caps.width; H = caps.height;
    round_panel = caps.round_panel;
    scale = (W < H ? W : H) / 480.0f;
    CX = W * 0.5f; CY = H * 0.5f;
    RAD = (W < H ? W : H) * 0.5f;
    // On the screen, over the meters: the face, the party and the alerts'
    // overlays (lv_layer_top) stay above it.
    obj = lv_obj_create(lv_screen_active());
    lv_obj_remove_style_all(obj);
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, W, H);
    lv_obj_set_style_bg_color(obj, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(obj, draw_cb, LV_EVENT_DRAW_MAIN, NULL);
    rng_s ^= micros() | 1;
}

void saver_start(int kind) {
    if (!obj || kind < 0 || kind >= SAVER_COUNT) return;
    rng_s ^= micros() | 1;
    kind_cur = kind;
    switch (kind) {
        case 0: stars_init(); break;
        case 1: rain_init(); break;
        case 2: dots_init(); break;
    }
    last_ms = millis();
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(obj);
    lv_obj_invalidate(obj);
    Serial.printf("[%lu] saver: %s\n", (unsigned long)last_ms, NAMES[kind]);
}

void saver_stop(void) {
    if (!obj || kind_cur < 0) return;
    kind_cur = -1;
    lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);     // hiding repaints what was under it
}

bool saver_active(void) { return kind_cur >= 0; }
int saver_kind(void) { return kind_cur; }
const char* saver_name(int kind) { return (kind >= 0 && kind < SAVER_COUNT) ? NAMES[kind] : ""; }

void saver_tick(void) {
    if (!obj || kind_cur < 0) return;
    if (idle_is_asleep()) return;   // the panel is dark: no frames
    const uint32_t now = millis();
    if (now - last_ms < FRAME_MS[kind_cur]) return;
    float dt = (now - last_ms) / 1000.0f;
    if (dt > 0.2f) dt = 0.2f;
    last_ms = now;
    switch (kind_cur) {
        case 0: stars_step(dt); break;
        case 1: rain_step(dt); break;
        case 2: dots_step(dt); break;
    }
    lv_obj_invalidate(obj);
}
