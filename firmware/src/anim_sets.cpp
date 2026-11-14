#include "anim_sets.h"
#include "clawd_anim.h"
#include <string.h>

// "tank …" are the clawd-tank fan clips (research/clawd-fan/clawd-tank/):
// Clawd at work (typing, thinking, debugging) and having fun with it in the
// Active set, heavy lifting in the Heavy set, resting in the Idle set.
const char* const GROUP_NAMES[GROUP_COUNT][GROUP_MAX] = {
    { "magnifier", "walking", "pointing", "lurking",          // idle / sleepy
      "book", "eating", "idle blossom", "idle hearts", "fm listening", "space",
      "tank idle", "tank sleeping" },
    { "crab walking", "waving", "trumpet", "basketball" },    // normal pace
    { "laptop", "dancing", "skateboard", "soccer",            // active
      "work out", "surfing", "hanabi", "jumping blossom", "swim summer",
      "tank typing", "tank thinking", "tank debugger",
      "tank grooving", "tank conducting", "tank juggling", "tank wizard" },
    { "racing car", "cloud", "sailing scene", "jumping happy", // heavy burn
      "baking", "this is fine",
      "tank carrying", "tank builder", "tank building" },
};

const char* const CALM_NAMES[CALM_COUNT] = {
    "magnifier", "walking", "book", "eating", "idle blossom", "idle hearts",
    "fm listening", "space", "tank idle", "tank sleeping",
};

// ─── The cycle ───────────────────────────────────────────────────────────────
// Built once, on first use: indices into the animation table (under 256).
#define FLAT_COUNT (GROUP_COUNT * GROUP_MAX + CALM_COUNT)
#define CYCLE_MAX  64
static uint8_t cycle[CYCLE_MAX];
static int     cycle_n = -1;

static const char* flat(int i) {
    return i < GROUP_COUNT * GROUP_MAX ? GROUP_NAMES[i / GROUP_MAX][i % GROUP_MAX]
                                       : CALM_NAMES[i - GROUP_COUNT * GROUP_MAX];
}

// 0 official, 1 fan-made, 2 a clawd-tank clip.
static int tier(int anim, const char* name) {
    if (!clawd_anim_fan(anim)) return 0;
    return strncmp(name, "tank ", 5) == 0 ? 2 : 1;
}

static void build(void) {
    if (cycle_n >= 0) return;
    cycle_n = 0;
    for (int t = 0; t < 3; t++) {
        for (int i = 0; i < FLAT_COUNT; i++) {
            const char* name = flat(i);
            const int a = clawd_anim_index(name);
            if (a < 0 || a > 255 || tier(a, name) != t) continue;
            bool seen = false;
            for (int j = 0; j < cycle_n && !seen; j++) seen = cycle[j] == a;
            if (!seen && cycle_n < CYCLE_MAX) cycle[cycle_n++] = (uint8_t)a;
        }
    }
}

int anim_cycle_count(void) {
    build();
    return cycle_n;
}

int anim_cycle_anim(int i) {
    build();
    return i >= 0 && i < cycle_n ? cycle[i] : -1;
}

const char* anim_cycle_name(int i) {
    const ClawdAnim* a = clawd_anim_at(anim_cycle_anim(i));
    return a ? a->name : NULL;
}

int anim_cycle_step(int cursor, int count, int step) {
    if (count <= 0) return -1;
    if (cursor < 0 || cursor >= count) return step < 0 ? count - 1 : 0;
    return ((cursor + (step < 0 ? -1 : 1)) % count + count) % count;
}
