#pragma once
#include <stdbool.h>
#include <stdint.h>

// Party effects over everything: a confetti burst and a soft pulsing glow
// around the screen edge. Not a creature (the one-Clawd rule doesn't count
// them): the director throws them for a test run (green glow and confetti on
// a pass, a red glow on a fail) and a fresh 5-hour window (confetti).
//
// One full-screen object on lv_layer_top() with an LVGL draw callback: the
// particles are a fixed array of plain structs (60 x 24 B) and nothing is a
// per-particle LVGL object or a pixel buffer, so it runs on boards without
// PSRAM. It redraws only while something is going on, and only the
// particles' bounding box and the four edge strips. Adapted from
// matejkrajcovic111-ctrl/Clawdmeter. LVGL-free header (the director test
// links fakes against it).

void party_init(void);                     // once, after the face (draws above it)
void party_confetti(void);                 // a ~2.5 s burst up from the bottom, fades out
void party_glow(uint32_t rgb, int pulses); // edge pulses, ~1.2 s each (0xRRGGBB)
bool party_active(void);
void party_stop(void);                     // gone now (minimal mode)
void party_tick(void);                     // every loop; ~30 fps while active
