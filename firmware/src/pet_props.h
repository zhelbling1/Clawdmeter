#pragma once
#include <stdbool.h>
#include <stdint.h>

// The little things around pet mode's face: a sweat drop, a rising "z z Z",
// a thinking dot orbiting above the eyes and a speech pill ("boop!"). Not
// creatures, just props on the face.
//
// All of them are drawn by one full-screen object on lv_layer_top() with an
// LVGL draw callback, animated from millis() in props_tick(): no LVGL object
// per prop and no layer buffers (a transformed or semi-transparent object
// needs one, which a board without PSRAM may not have to give). Only the
// boxes the props move in are redrawn, ~30 fps. Coordinates are screen
// pixels; sizes are authored for 480 px and scaled by the shorter side.

void props_init(void);                                  // once, after face_init()
void props_to_front(void);                              // above the face (it moved to the front as it rose)
void props_sweat(bool on, int x, int y);                // a drop slides down from (x, y), repeating
void props_zzz(bool on, int x, int y);                  // z z Z rise up and right from (x, y), looping
void props_thinking(bool on, int cx, int cy, int r);    // a dot orbits (cx, cy) at radius r
bool props_thinking_pos(int* x, int* y);                // the dot's centre; false when off
void props_bubble(const char* text, int x, int y, uint32_t ms);  // a pill centred at (x, y)
void props_tick(uint32_t now);
void props_hide_all(void);                              // everything off, hidden now
