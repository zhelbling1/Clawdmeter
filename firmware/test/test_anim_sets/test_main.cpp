// anim_sets: the performer's scene lists and the cycle the next / previous
// animation buttons step through.
//   pio test -d firmware -e native -f test_anim_sets
#include <unity.h>
#include <string.h>
#include "anim_sets.h"
#include "clawd_anim.h"
#include "clawd_policy.h"
#ifndef CLAWD_ORIGINALS   // the native env sets it (platformio.ini)
#define CLAWD_ORIGINALS 0
#endif

void setUp(void) {}
void tearDown(void) {}

static bool in_cycle(const char* name) {
    for (int i = 0; i < anim_cycle_count(); i++)
        if (strcmp(anim_cycle_name(i), name) == 0) return true;
    return false;
}

// 0 official, 1 an original, 2 fan-made, 3 a clawd-tank clip.
static int tier(int i) {
    const char* name = anim_cycle_name(i);
    if (clawd_anim_original_mood(anim_cycle_anim(i))) return 1;
    if (!clawd_anim_fan(anim_cycle_anim(i))) return 0;
    return strncmp(name, "tank ", 5) == 0 ? 3 : 2;
}

static int originals(void) {
    int n = 0;
    for (int a = 0; a < clawd_anim_count(); a++) n += clawd_anim_original_mood(a) != NULL;
    return n;
}

static bool in_pool(int group, bool calm, const char* name) {
    int n = 0;
    const char* const* p = anim_pool(group, calm, &n);
    for (int i = 0; i < n; i++)
        if (strcmp(p[i], name) == 0) return true;
    return false;
}

// Every listed scene exists in the animation header and is in the cycle.
static void test_every_scene_is_in_the_cycle(void) {
    for (int g = 0; g < GROUP_COUNT; g++)
        for (int i = 0; i < GROUP_MAX; i++) {
            const char* n = GROUP_NAMES[g][i];
            if (!n) continue;
            TEST_ASSERT_TRUE_MESSAGE(clawd_anim(n) != NULL, n);
            TEST_ASSERT_TRUE_MESSAGE(in_cycle(n), n);
        }
    for (int i = 0; i < CALM_COUNT; i++) TEST_ASSERT_TRUE_MESSAGE(in_cycle(CALM_NAMES[i]), CALM_NAMES[i]);
}

// Once each, official first, then fan-made, then the clawd-tank clips, each
// part in table order.
static void test_cycle_order(void) {
    const int n = anim_cycle_count();
    const int o = originals();
    TEST_ASSERT_EQUAL_INT(41 + o, n);             // 17 official, the originals, 12 fan, 12 clawd-tank
    for (int i = 0; i < n; i++) {
        TEST_ASSERT_TRUE(anim_cycle_anim(i) >= 0);
        for (int j = 0; j < i; j++) TEST_ASSERT_NOT_EQUAL(anim_cycle_anim(j), anim_cycle_anim(i));
        if (i) TEST_ASSERT_TRUE_MESSAGE(tier(i - 1) <= tier(i), anim_cycle_name(i));
    }
    TEST_ASSERT_EQUAL_STRING("magnifier", anim_cycle_name(0));
    TEST_ASSERT_EQUAL_STRING("walking", anim_cycle_name(1));
    TEST_ASSERT_EQUAL_STRING("crab walking", anim_cycle_name(5));   // the normal row after idle's five
    if (o) TEST_ASSERT_EQUAL_INT(1, tier(17));                        // the first original
    TEST_ASSERT_EQUAL_STRING("eating", anim_cycle_name(17 + o));    // the first fan-made one
    TEST_ASSERT_EQUAL_STRING("tank idle", anim_cycle_name(29 + o)); // the first clawd-tank clip
    TEST_ASSERT_EQUAL_STRING("tank building", anim_cycle_name(n - 1));
    TEST_ASSERT_FALSE(in_cycle("tank low battery"));                // not listed: the low-battery dip
    TEST_ASSERT_EQUAL_INT(-1, anim_cycle_anim(n));
    TEST_ASSERT_NULL(anim_cycle_name(-1));
}

static void test_step_wraps(void) {
    TEST_ASSERT_EQUAL_INT(0, anim_cycle_step(-1, 5, +1));   // first press: the first
    TEST_ASSERT_EQUAL_INT(4, anim_cycle_step(-1, 5, -1));   //   ... or the last
    TEST_ASSERT_EQUAL_INT(1, anim_cycle_step(0, 5, +1));
    TEST_ASSERT_EQUAL_INT(0, anim_cycle_step(4, 5, +1));
    TEST_ASSERT_EQUAL_INT(4, anim_cycle_step(0, 5, -1));
    TEST_ASSERT_EQUAL_INT(0, anim_cycle_step(9, 5, +1));    // a cursor from a longer list
    TEST_ASSERT_EQUAL_INT(-1, anim_cycle_step(0, 0, +1));
}

// The native env builds with CLAWD_ORIGINALS, so the originals are here.
static void test_originals_are_built_in(void) {
    TEST_ASSERT_TRUE(CLAWD_ORIGINALS);
    TEST_ASSERT_TRUE(originals() > 0);
    TEST_ASSERT_NULL(clawd_anim_original_mood(clawd_anim_index("dancing")));   // official
    TEST_ASSERT_NULL(clawd_anim_original_mood(clawd_anim_index("tank idle"))); // fan-made
    TEST_ASSERT_NULL(clawd_anim_original_mood(-1));
    TEST_ASSERT_NULL(clawd_anim_original_mood(clawd_anim_count()));
}

// Each pool is its table plus the originals of its mood, and nothing else.
static void test_pools(void) {
    for (int s = 0; s <= GROUP_COUNT; s++) {
        const bool calm = s == GROUP_COUNT;
        int n = 0;
        const char* const* p = anim_pool(s, calm, &n);
        TEST_ASSERT_TRUE(n <= CLAWD_PICK_MAX);   // every one a candidate
        int listed = 0;
        const char* const* names = calm ? CALM_NAMES : GROUP_NAMES[s];
        for (int i = 0; i < (calm ? CALM_COUNT : GROUP_MAX); i++)
            if (names[i]) TEST_ASSERT_EQUAL_STRING(names[i], p[listed++]);   // the table first, in order
        for (int i = listed; i < n; i++) {
            const char* mood = clawd_anim_original_mood(clawd_anim_index(p[i]));
            TEST_ASSERT_NOT_NULL_MESSAGE(mood, p[i]);
            TEST_ASSERT_EQUAL_STRING(calm ? "calm" : s == 2 ? "active" : "heavy", mood);
        }
        if (s < 2) TEST_ASSERT_EQUAL_INT(listed, n);   // idle and normal get none
    }
    for (int a = 0; a < clawd_anim_count(); a++) {
        const char* mood = clawd_anim_original_mood(a);
        if (!mood) continue;
        const char* name = clawd_anim_at(a)->name;
        TEST_ASSERT_TRUE_MESSAGE(in_pool(2, false, name) == (strcmp(mood, "active") == 0), name);
        TEST_ASSERT_TRUE_MESSAGE(in_pool(3, false, name) == (strcmp(mood, "heavy") == 0), name);
        TEST_ASSERT_TRUE_MESSAGE(in_pool(0, true, name) == (strcmp(mood, "calm") == 0), name);
        TEST_ASSERT_TRUE_MESSAGE(in_cycle(name), name);
    }
    int n0 = 0, nbad = 0;
    TEST_ASSERT_EQUAL_PTR(anim_pool(0, false, &n0), anim_pool(9, false, &nbad));   // out of range: group 0
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_every_scene_is_in_the_cycle);
    RUN_TEST(test_cycle_order);
    RUN_TEST(test_step_wraps);
    RUN_TEST(test_originals_are_built_in);
    RUN_TEST(test_pools);
    return UNITY_END();
}
