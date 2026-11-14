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

#ifndef CLAWD_ORIGINALS   // set per env in platformio.ini
#define CLAWD_ORIGINALS 0
#endif

// Which pool an original of this mood joins; -1 for none. Slot GROUP_COUNT
// is the calm dips.
static int mood_slot(const char* mood) {
    if (!mood) return -1;
    if (strcmp(mood, "active") == 0) return 2;
    if (strcmp(mood, "heavy") == 0) return 3;
    if (strcmp(mood, "calm") == 0) return GROUP_COUNT;
    return -1;
}

// ─── The pools ───────────────────────────────────────────────────────────────
// Built once, on first use. Without the originals there is nothing to add, so
// the tables are the pools and no RAM is spent (the classic ESP32 boards are
// short of it).
#if CLAWD_ORIGINALS
#define ORIG_MAX 32
#define POOL_MAX (GROUP_MAX + ORIG_MAX)
static const char* pools[GROUP_COUNT + 1][POOL_MAX];
static int         pool_n[GROUP_COUNT + 1];
static bool        pools_built = false;

static void build_pools(void) {
    if (pools_built) return;
    pools_built = true;
    for (int s = 0; s <= GROUP_COUNT; s++) {
        const char* const* names = s < GROUP_COUNT ? GROUP_NAMES[s] : CALM_NAMES;
        const int count = s < GROUP_COUNT ? GROUP_MAX : CALM_COUNT;
        pool_n[s] = 0;
        for (int i = 0; i < count; i++)
            if (names[i]) pools[s][pool_n[s]++] = names[i];
    }
    for (int a = 0; a < clawd_anim_count(); a++) {
        const int s = mood_slot(clawd_anim_original_mood(a));
        if (s >= 0 && pool_n[s] < POOL_MAX) pools[s][pool_n[s]++] = clawd_anim_at(a)->name;
    }
}

const char* const* anim_pool(int group, bool calm, int* n) {
    build_pools();
    const int s = calm ? GROUP_COUNT : (group >= 0 && group < GROUP_COUNT ? group : 0);
    if (n) *n = pool_n[s];
    return pools[s];
}
#else
const char* const* anim_pool(int group, bool calm, int* n) {
    if (calm) {
        if (n) *n = CALM_COUNT;
        return CALM_NAMES;
    }
    if (n) *n = GROUP_MAX;
    return GROUP_NAMES[group >= 0 && group < GROUP_COUNT ? group : 0];
}
#endif

// ─── The cycle ───────────────────────────────────────────────────────────────
// Built once, on first use: indices into the animation table (under 256).
#define FLAT_COUNT (GROUP_COUNT * GROUP_MAX + CALM_COUNT)
#define CYCLE_MAX  (CLAWD_ORIGINALS ? 96 : 64)
static uint8_t cycle[CYCLE_MAX];
static int     cycle_n = -1;

static const char* flat(int i) {
    return i < GROUP_COUNT * GROUP_MAX ? GROUP_NAMES[i / GROUP_MAX][i % GROUP_MAX]
                                       : CALM_NAMES[i - GROUP_COUNT * GROUP_MAX];
}

// 0 official, 1 an original, 2 fan-made, 3 a clawd-tank clip.
static int tier(int anim, const char* name) {
    if (clawd_anim_original_mood(anim)) return 1;
    if (!clawd_anim_fan(anim)) return 0;
    return strncmp(name, "tank ", 5) == 0 ? 3 : 2;
}

static void add(int a) {
    if (a < 0 || a > 255) return;
    for (int j = 0; j < cycle_n; j++)
        if (cycle[j] == a) return;
    if (cycle_n < CYCLE_MAX) cycle[cycle_n++] = (uint8_t)a;
}

static void build(void) {
    if (cycle_n >= 0) return;
    cycle_n = 0;
    for (int t = 0; t < 4; t++) {
        if (t == 1) {   // the originals aren't in the tables: header order
            for (int a = 0; a < clawd_anim_count(); a++)
                if (mood_slot(clawd_anim_original_mood(a)) >= 0) add(a);
            continue;
        }
        for (int i = 0; i < FLAT_COUNT; i++) {
            const char* name = flat(i);
            const int a = clawd_anim_index(name);
            if (a >= 0 && tier(a, name) == t) add(a);
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
