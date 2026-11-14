#pragma once
#include <stdbool.h>
#include "data.h"

// The pages the PWR button flips between:
//
//   meters  the dashboard with the corner Clawd (ui.h)
//   clawd   Clawd alone, large, in a scene: outside playing, in the office
//           at his laptop while Claude works, lit by the local time
//           (stage.h, scene.h)
//
// The Clawd page is there on every panel the scene fits at 1x or more
// (layout_scene: 480x480 draws it at 1.5x), in the panel's own orientation,
// and not in minimal mode. Elsewhere the meters are the only page and
// nothing here changes anything.
//
// One Clawd: the page is its own LVGL screen, and it opens only once the
// director has handed him over (director_page_open): the corner Clawd is put
// away and nothing on the meters moves until the page closes. A tap on the
// page (with no alert up) is "show me the meters"; an alert while it's up
// has him yelling from the page, and a tap dismisses it.

enum Page { PAGE_METERS, PAGE_CLAWD, PAGE_COUNT };

void pages_init(void);          // after ui_init() and director_init()
bool pages_enabled(void);
Page pages_current(void);
void pages_show(Page p);
// The button's next page (meters <-> Clawd). With the face up or a show on,
// it's "show me the meters" first (press again for the page).
void pages_next(void);
void pages_update(const UsageData* d);   // every parsed payload, after ui_update()
// QA (`mood <n>` serial command): force Clawd's moods on his page, bit 1 =
// angry, bit 2 = yelling; 0 = back to the real cues.
void pages_debug_mood(int bits);
// QA (`tod <minute>`): the Clawd page's local time, 0..1439; -1 = the real
// clock (the app's `t`). Returns the minute that took effect.
int pages_debug_tod(int minute);
// QA (`work <0|1|-1>`): force Claude working (1) or not (0) on the Clawd
// page; -1 = the real cue. Returns the value that took effect.
int pages_debug_work(int working);
void pages_tick(void);
