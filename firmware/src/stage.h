#pragma once
#include <stdbool.h>
#include <lvgl.h>

struct Burndown;

// The Clawd page (pages.h): Clawd alone in a landscape scene, large, playing.
// He walks or scuttles about, waves, dances, jumps and plays with his ball or
// skateboard, all from the official animations; while Claude is working he
// sits at his laptop and types until the work stops.
//
// He's somewhere you can tell apart at a glance (scene.h): in the office
// while Claude works, outside while he plays, both lit by the local time of
// day. Work starting brings the blinds down outside and up again on him at
// his desk, laptop opening; when the work stops he finishes typing, closes
// the laptop, stands up, and the blinds take him back outside, where he
// jumps for joy. Each scene holds at least SCENE_DWELL_MS (3 s), so a flicker
// of work doesn't flap between them.
//
// Moods are drawn around him, never into the sprite (the frames are the
// official art), so they ride on whatever he's doing:
//   alert  a shaking speech bubble by his head with the alert text and sound
//          waves: he's yelling for you (dismissed as on the meters)
//   angry  an anger mark popping by his head and steam rising: usage is
//          burning fast or the session is nearly spent
//
// He is the only Clawd on screen: the page is its own LVGL screen, so the
// meters (and the corner Clawd on them) aren't drawn while it's up, and the
// director holds its own actors off while the page has him
// (director_page_open, clawd_director.h).
//
// RAM: nothing big. He is drawn straight from the official frames (const, in
// flash) as runs of flat rectangles in LV_EVENT_DRAW_MAIN, with no sprite
// buffer, and the scenery is const data in flash drawn by one LVGL object.
// That's what lets the page run at 1.5x on a 480x480 panel without PSRAM.

struct StageCues {
    bool        working;      // Claude is working (director_claude_working)
    bool        alert;        // an alert is up (director_alert_active)
    const char* alert_text;   // its message
    bool        angry;        // usage burning (pages.cpp decides)
    int         minute_of_day; // local wall-clock minute 0..1439, -1 unknown
    // The office wall (scene_set_live): the LED countdown and the weekly poster.
    int             session_left_mins; // until the 5-hour window resets, -1 unknown / none
    const Burndown* week;              // this week's history (burndown.h), NULL = none
    int             week_used;         // weekly % used now (`w`, 0..100), -1 unknown / none
    int             week_left_mins;    // until the weekly reset (`wr` run on), -1 unknown
};

// Build the page on `scr` (w x h px) with the scene's art at (x0, y0) drawn at
// scale2 / 2 (layout_scene), already in the scene `cues` call for (NULL:
// picked on the first tick). False when LVGL can't create its objects.
bool stage_open(lv_obj_t* scr, int w, int h, int x0, int y0, int scale2, const StageCues* cues);
void stage_close(void);
void stage_tick(const StageCues* cues);   // per loop while open
// Redraw his frame (a new TH_CLAWD: clawd_anim_recolor already repainted the art).
void stage_repaint(void);
