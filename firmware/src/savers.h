#pragma once
#include <stdbool.h>
#include <stdint.h>

// Effect screensavers, OLED-friendly: a starfield, a rain of code glyphs and
// drifting dots joined by faint lines ("constellation"). Mostly black, never
// brighter than ~70 %, everything moves, so nothing burns in. The director's
// screensaver takes turns between the resting face and these (one Clawd: he
// has walked off before an effect starts, and it's gone before he comes back).
//
// One hidden full-screen object with an LVGL draw callback; each effect's
// state is a fixed array of plain structs, and only one runs at a time, so
// they share one block (~1.5 KB). No pixel buffer, no per-particle LVGL
// objects: fine on boards without PSRAM. 20-30 fps while running, nothing
// while the panel sleeps. Adapted from matejkrajcovic111-ctrl/Clawdmeter.
// LVGL-free header (the director test links fakes against it).

#define SAVER_COUNT 3

void saver_init(void);             // once, after ui_init(): over the meters, under the overlays
void saver_start(int kind);        // 0 starfield, 1 code rain, 2 constellation; fresh state
void saver_stop(void);             // hidden now
bool saver_active(void);
int  saver_kind(void);             // -1 when off
const char* saver_name(int kind);
void saver_tick(void);             // every loop; nothing when off
