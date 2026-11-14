#include "pages.h"
#include "stage.h"
#include "scene_data.h"
#include "layout.h"
#include "theme.h"
#include "clawd_director.h"
#include "usage_rate.h"
#include "burndown.h"
#include "minimal_mode.h"
#include "hal/board_caps.h"
#include <Arduino.h>
#include <Preferences.h>
#include <lvgl.h>
#include <stdio.h>

static bool        enabled = false;
static LayoutScene fit;
static int         debug_mood = 0;
static int         debug_tod = -1;       // forced minute of day, -1 = real
static int         debug_work = -1;      // forced working, -1 = real
static long        clock_epoch = 0;      // the app's local wall-clock epoch (s), 0 = none
static uint32_t    clock_ms = 0;         // millis() when it arrived
static Page        current = PAGE_METERS;
static lv_obj_t*   meters_scr = NULL;    // the meters' screen (ui.cpp builds on the default one)
static lv_obj_t*   clawd_scr = NULL;
// The office wall's live data: the countdowns run on from the last good
// payload, and this week's burndown history (burndown.h), kept in NVS.
static int         sr_at = -1, wr_at = -1;    // `sr` / `wr` in the last ok payload
static bool        spend_capped = false;      // Enterprise: no 5-hour or weekly window
static uint32_t    ok_ms = 0;                 // millis() when it arrived
static bool        have_last = false;
static float       session_pct = 0, weekly_pct = 0;
static Burndown    week;
static bool        week_live = false;         // a payload has placed it this boot

// ─── This week's burndown, in NVS ────────────────────────────────────────────
// Its own namespace: 168 bytes of history plus the window's reset minute,
// written at most once an hour (burndown_sample says when).
#define WEEK_NS "clawdweek"

static void week_load(void) {
    Preferences prefs;
    prefs.begin(WEEK_NS, false);
    const size_t n = prefs.getBytes("used", week.used, sizeof(week.used));
    week.reset_min = prefs.getInt("reset", 0);
    prefs.end();
    if (n != sizeof(week.used)) week.reset_min = 0;    // nothing saved yet: start empty
    burndown_sanitize(&week);
}

static void week_save(void) {
    Preferences prefs;
    prefs.begin(WEEK_NS, false);
    prefs.putBytes("used", week.used, sizeof(week.used));
    prefs.putInt("reset", week.reset_min);
    prefs.end();
}

// Minutes left of a countdown read `base` minutes at the last ok payload; -1
// when unknown or run out (the window is over until the next payload).
static int left_now(int base) {
    if (base < 0) return -1;
    const int v = base - (int)((millis() - ok_ms) / 60000UL);
    return v < 0 ? -1 : v;
}

// ─── Pages ───────────────────────────────────────────────────────────────────
void pages_init(void) {
    const BoardCaps& caps = board_caps();
    fit = layout_scene({ caps.width, caps.height, caps.round_panel }, SCENE_W, SCENE_H);
    enabled = fit.fits && !minimal_mode();
    Serial.printf("pages: Clawd page %s (scene x%d/2 at %d,%d)\n", enabled ? "on" : "off",
                  fit.scale2, fit.box.x, fit.box.y);
    if (!enabled) return;
    meters_scr = lv_screen_active();
    week_load();
    clawd_scr = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(clawd_scr, THEME_BG, 0);
    lv_obj_set_style_bg_opa(clawd_scr, LV_OPA_COVER, 0);
    lv_obj_clear_flag(clawd_scr, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(clawd_scr, LV_SCROLLBAR_MODE_OFF);
}

bool pages_enabled(void) { return enabled; }
Page pages_current(void) { return current; }

static void clawd_cues(StageCues* c);

void pages_show(Page p) {
    if (!enabled || (int)p < 0 || p >= PAGE_COUNT || p == current) return;
    const BoardCaps& caps = board_caps();
    if (p == PAGE_CLAWD) {
        if (!director_page_open()) return;      // the face or a show goes home first
        lv_screen_load(clawd_scr);
        StageCues c;
        clawd_cues(&c);
        if (!stage_open(clawd_scr, caps.width, caps.height, fit.box.x, fit.box.y, fit.scale2, &c)) {
            Serial.println("pages: no room for the Clawd page");
            lv_screen_load(meters_scr);
            director_page_closed();
            return;
        }
    } else {
        stage_close();
        lv_screen_load(meters_scr);
        director_page_closed();
    }
    current = p;
    lv_obj_invalidate(lv_screen_active());
    Serial.printf("page: %d\n", (int)p);
}

void pages_next(void) {
    if (!enabled) return;
    pages_show((Page)((current + 1) % PAGE_COUNT));
}

void pages_update(const UsageData* d) {
    if (!enabled) return;
    if (d->valid && d->ok) {       // like the meters' title clock (ui.cpp)
        have_last = true;
        session_pct = d->session_pct;
        weekly_pct = d->weekly_pct;
        clock_epoch = d->clock_epoch;
        clock_ms = millis();
        // Replays carry the app's own run-down countdowns, so they count here.
        // An account with no 5-hour limit has no session countdown.
        sr_at = d->weekly_only ? -1 : d->session_reset_mins;
        wr_at = d->weekly_reset_mins;
        spend_capped = d->enterprise;
        ok_ms = clock_ms;
    }
    // Only real samples go in the history (no data is never a value).
    if (d->valid && d->ok && !d->replay && !d->enterprise) {
        const int32_t now_min = d->clock_epoch > 0 ? (int32_t)(d->clock_epoch / 60) : 0;
        const int f = burndown_sample(&week, now_min, d->weekly_reset_mins, d->weekly_pct);
        if (now_min > 0 && d->weekly_reset_mins >= 0) week_live = true;
        if (f & BURNDOWN_SAVE) week_save();
    }
}

// Angry: usage burning this hour (the Heavy mood group) or the window
// nearly spent.
#define ANGRY_PCT 80.0f
static bool usage_angry(void) {
    if (usage_rate_group() >= 3) return true;
    return have_last && !spend_capped && session_pct >= ANGRY_PCT;
}

void pages_debug_mood(int bits) { debug_mood = bits; }
int pages_debug_tod(int minute) { return debug_tod = minute < 0 ? -1 : minute % 1440; }
int pages_debug_work(int working) { return debug_work = working < 0 ? -1 : (working != 0); }

// Local minute of day for the Clawd page's scenery, -1 when unknown.
static int minute_of_day(void) {
    if (debug_tod >= 0) return debug_tod;
    if (clock_epoch <= 0) return -1;
    const long s = clock_epoch + (long)((millis() - clock_ms) / 1000);
    return (int)(((s % 86400) + 86400) % 86400 / 60);
}

// What the Clawd page shows him doing, and where.
static void clawd_cues(StageCues* c) {
    c->working = debug_work >= 0 ? debug_work != 0 : director_claude_working();
    c->alert = director_alert_active() || (debug_mood & 2);
    c->alert_text = director_alert_active() ? director_alert_message() : "Claude needs you";
    c->angry = usage_angry() || (debug_mood & 1);
    c->minute_of_day = minute_of_day();
    c->session_left_mins = spend_capped ? -1 : left_now(sr_at);
    // The history only once a payload this boot has placed this window in it.
    c->week = week_live ? &week : NULL;
    const bool know = have_last && !spend_capped;
    float w = know ? weekly_pct : -1.0f;
    if (w > 100.0f) w = 100.0f;
    c->week_used = w >= 0.0f ? (int)(w + 0.5f) : -1;
    c->week_left_mins = know ? left_now(wr_at) : -1;
}

void pages_tick(void) {
    if (!enabled || current != PAGE_CLAWD) return;
    // A tap on the page (or `clawd home`) asked for the meters.
    if (director_take_page_exit() || !director_on_page()) {
        pages_show(PAGE_METERS);
        return;
    }
    StageCues c;
    clawd_cues(&c);
    stage_tick(&c);
}
