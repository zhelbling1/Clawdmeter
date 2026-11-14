// anim_sets: the performer's scene lists and the cycle the next / previous
// animation buttons step through.
//   pio test -d firmware -e native -f test_anim_sets
#include <unity.h>
#include <string.h>
#include "anim_sets.h"
#include "clawd_anim.h"

void setUp(void) {}
void tearDown(void) {}

static bool in_cycle(const char* name) {
    for (int i = 0; i < anim_cycle_count(); i++)
        if (strcmp(anim_cycle_name(i), name) == 0) return true;
    return false;
}

static int tier(int i) {
    const char* name = anim_cycle_name(i);
    if (!clawd_anim_fan(anim_cycle_anim(i))) return 0;
    return strncmp(name, "tank ", 5) == 0 ? 2 : 1;
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
    TEST_ASSERT_EQUAL_INT(41, n);                 // 17 official, 12 fan, 12 clawd-tank
    for (int i = 0; i < n; i++) {
        TEST_ASSERT_TRUE(anim_cycle_anim(i) >= 0);
        for (int j = 0; j < i; j++) TEST_ASSERT_NOT_EQUAL(anim_cycle_anim(j), anim_cycle_anim(i));
        if (i) TEST_ASSERT_TRUE_MESSAGE(tier(i - 1) <= tier(i), anim_cycle_name(i));
    }
    TEST_ASSERT_EQUAL_STRING("magnifier", anim_cycle_name(0));
    TEST_ASSERT_EQUAL_STRING("walking", anim_cycle_name(1));
    TEST_ASSERT_EQUAL_STRING("crab walking", anim_cycle_name(5));   // the normal row after idle's five
    TEST_ASSERT_EQUAL_STRING("eating", anim_cycle_name(17));        // the first fan-made one
    TEST_ASSERT_EQUAL_STRING("tank idle", anim_cycle_name(29));     // the first clawd-tank clip
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

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_every_scene_is_in_the_cycle);
    RUN_TEST(test_cycle_order);
    RUN_TEST(test_step_wraps);
    return UNITY_END();
}
