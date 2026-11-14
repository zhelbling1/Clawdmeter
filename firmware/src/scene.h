#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <lvgl.h>
#include "scene_data.h"

// The scenery behind Clawd on the Clawd page (stage.h): the office while
// Claude works, outside while he plays. Pixel art made of flat rectangles,
// authored in tools/scenes/ and generated into scene_office.h and
// scene_outdoor.h (const, in flash).
//
// The art is 320x172 (SCENE_W x SCENE_H). On a bigger panel it's drawn at a
// whole or half-step scale (layout_scene in layout.h: 1x, 1.5x, 2x, ...;
// the art sits on a 2 px grid, so half steps land on whole pixels), centred,
// and the static shapes touching the art's edges bleed out to the panel's,
// so the room or the sky fills the whole glass instead of a strip.
//
// One full-screen object, created before the sprite so it sits behind him,
// draws the current scene in LV_EVENT_DRAW_MAIN: no LVGL object per shape.
// The scene re-colours by the local time of day (day, dusk 06-08 and 18-21,
// night 21-06), and its animations (drifting clouds, cycling frames, the wall
// clock, the LED countdown's colon) invalidate only the boxes that changed,
// at most ~10 Hz each.
//
// Switching scenes can run a venetian-blind wipe: slats close over the
// screen (on top of Clawd too), the scene swaps while it's covered, and the
// slats open on the new one. The covered callback runs at that moment, so
// the stage can move him to his desk unseen.

enum SceneId { SCENE_NONE, SCENE_OFFICE, SCENE_OUTDOOR };

// Runs once the screen is covered (or at once without a wipe), with the
// scene now showing underneath.
typedef void (*SceneCoveredCb)(SceneId shown);

// Create the scenery on `scr`, a w x h px screen, with the art's top-left at
// (x0, y0) and drawn at scale2 / 2 (scale2 >= 2; layout_scene says where).
// Call before creating anything that should be in front of it.
bool    scene_open(lv_obj_t* scr, int w, int h, int x0, int y0, int scale2);
// Scene px to screen px, for the stage (the same mapping the scenery uses).
int     scene_x(int x);
int     scene_y(int y);
void    scene_close(void);
void    scene_on_covered(SceneCoveredCb cb);
// Show `id`, with the wipe when `animate`. During a wipe the latest call wins.
void    scene_set(SceneId id, bool animate);
SceneId scene_target(void);              // shown, or where a wipe is heading
bool    scene_busy(void);                // a wipe is running
bool    scene_transition_covered(void);  // ...and has the screen covered
// Per loop while open. minute_of_day: local wall-clock minute 0..1439, or
// -1 when unknown (day colours, the clock at 10:10).
void    scene_tick(uint32_t now, int minute_of_day);
// The office's live wall: the LED countdown shows `countdown_mins` left in
// the 5-hour window as H:MM (-1 = unknown or no window: "-:--"); the poster
// shows the weekly % used now (`week_used`, 0..100) in its pace colour with
// a verdict, and charts the week so far from `week`'s history (burndown.h;
// NULL = none: one straight line from the window's start) with the average
// rate projected to the reset. `week_left_mins` = minutes to the weekly
// reset; either < 0 = unknown ("--%", no chart). Cheap to call per loop:
// only what changed is redrawn.
struct Burndown;
void    scene_set_live(int countdown_mins, const Burndown* week, int week_used, int week_left_mins);
// The office desk: Clawd's body-left x (screen px) when he sits at his laptop.
int     scene_anchor_desk_x(void);
// An anchor of the scene showing, in px. False when it has none.
bool    scene_anchor(SceneAnchorId id, lv_area_t* out);
