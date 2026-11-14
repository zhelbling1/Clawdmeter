#pragma once
#include <stdint.h>

// The performer's animation sets (performer.cpp plays them) and the cycle the
// "next / previous animation" buttons step through (the director's `browse`
// beat). Pure: no Arduino or LVGL, so the native tests see the real lists.
// The tables are const (flash); the cycle is a small index cache.

// Mood groups 0..3 (idle, normal, active, heavy). Names in the first four
// slots of each group are the official scenes; the rest are the Book
// (official, unlisted) and the fan-made ones in research/clawd-fan/:
// rizowski's baking/eating, TB1982's drawings and the clawd-tank clips
// ("tank ..."). Shows only ever draw from the active and heavy groups
// (clawd_show_group's floor) and calm dips from CALM_NAMES, so the idle and
// normal rows list scenes for reference, not for shows. Unused slots are
// NULL.
#define GROUP_COUNT 4
#define GROUP_MAX   16
extern const char* const GROUP_NAMES[GROUP_COUNT][GROUP_MAX];

// The screensaver's calm dips: gentle scenes only (lurking is a corner act
// and pointing is his "noticing" gesture).
#define CALM_COUNT 10
extern const char* const CALM_NAMES[CALM_COUNT];

// What the performer draws from: a group's names (or CALM_NAMES when `calm`)
// followed by the originals of that mood (builds with CLAWD_ORIGINALS: this
// fork's pop-culture scenes, research/clawd-fan/originals/), "active" ones in
// group 2, "heavy" ones in group 3 and "calm" ones in the calm dips. *n is the
// count. Without CLAWD_ORIGINALS it is the table itself, NULL slots included
// (skip them, as clawd_pick_no_repeat does). Out-of-range groups give group 0.
const char* const* anim_pool(int group, bool calm, int* n);

// The cycle: every scene in GROUP_NAMES and CALM_NAMES that the animation
// header has, plus every original, once each: official first, then the
// originals, then the fan-made ones, then the clawd-tank clips (fan-made,
// "tank ..."), each part in the order the tables list them (idle, normal,
// active, heavy, calm; originals in header order).
int         anim_cycle_count(void);
int         anim_cycle_anim(int i);      // clawd_anim index, -1 out of range
const char* anim_cycle_name(int i);      // NULL out of range

// The cursor after a press: `step` +1 (next) or -1 (previous), wrapping.
// cursor < 0 is "nothing played yet": next starts at the first, previous at
// the last. -1 when count is 0.
int anim_cycle_step(int cursor, int count, int step);
