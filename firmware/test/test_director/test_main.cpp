// The director against timed stand-ins for its actors (fake_actors.cpp):
// whatever the situation does, there is never more than one Clawd on screen
// (corner sprite, full-size sprite, performer, face). Pet mode drives that
// same face and only while it's up; an effect screensaver runs only with no
// Clawd on screen at all.
//   pio test -d firmware -e native -f test_director
#include <unity.h>
#include "fake_world.h"
#include "../../src/clawd_director.cpp"

static const uint32_t TICK_MS = 10;

// The first frame that broke the rule, if any.
static bool     broke = false;
static uint32_t broke_at = 0;
static char     broke_what[160];

static void check_one_clawd(void) {
    const OnScreen s = fake_on_screen();
    if (broke) return;
    // The Clawd page (pages.cpp) shows him while the director says it has him.
    const bool page = director_on_page();
    const int  clawds = fake_clawds(s) + (int)page;
    const char* what = clawds > 1                              ? "two Clawds"
                     : fake_saver_active() && clawds           ? "a Clawd under the effect screensaver"
                     : fake_pet_active() && !s.face            ? "pet mode without the face"
                     : fake_pet_active() && beat != B_PET      ? "pet mode outside its beat"
                     : fake_saver_active() && beat != B_SCREENSAVER ? "an effect screensaver outside its beat"
                                                               : NULL;
    if (!what) return;
    broke = true;
    broke_at = fake_now_ms;
    snprintf(broke_what, sizeof(broke_what), "%s: beat %s:%u corner %d big %d performer %d face %d page %d",
             what, director_beat_name(), step, s.corner, s.big, s.performer, s.face, page);
}

// Which beats a run went through, so a fuzz pass can't be vacuous.
static const int BEAT_COUNT = sizeof(BEAT_NAMES) / sizeof(BEAT_NAMES[0]);
static bool seen[BEAT_COUNT];

static void run_for(uint32_t ms) {
    for (uint32_t t = 0; t < ms; t += TICK_MS) {
        fake_now_ms += TICK_MS;
        fake_actors_tick();
        director_tick();
        // The page module closes the page when a tap asked for the meters.
        if (director_on_page() && director_take_page_exit()) director_page_closed();
        seen[beat] = true;
        check_one_clawd();
    }
}

// Without the performer nothing performs, so nothing runs home.
static void assert_every_beat_seen(bool has_performer) {
    for (int b = 0; b < BEAT_COUNT; b++)
        if (has_performer || b != B_RUN_HOME) TEST_ASSERT_TRUE_MESSAGE(seen[b], BEAT_NAMES[b]);
}

static void assert_one_clawd(void) {
    if (!broke) return;
    char msg[200];
    snprintf(msg, sizeof(msg), "at %lu ms: %s", (unsigned long)broke_at, broke_what);
    TEST_FAIL_MESSAGE(msg);
}

static UsageData live_payload(void) {
    UsageData d;
    memset(&d, 0, sizeof(d));
    d.valid = true;
    d.ok = true;
    d.session_pct = 10;
    d.session_reset_mins = 120;
    d.activity = -1;
    d.sessions = -1;
    return d;
}

static void send(const UsageData& d, const SignalsUpdate& sig) { director_on_payload(&d, &sig); }

static SignalsUpdate no_signal(void) {
    SignalsUpdate s;
    memset(&s, 0, sizeof(s));
    return s;
}

static void fresh_director(void);
static int fuzz_attn_s = CLAWD_ATTN_ANIM_DEFAULT_S;

void setUp(void) {
    broke = false;
    world = { true, 0, false, true, false, true };
}
void tearDown(void) {}

// The screensaver rests, then dips into a calm scene. The face must be off
// screen before the performer appears, and he must be gone before it rises.
static void test_screensaver_calm_dip_keeps_one_clawd(void) {
    fresh_director();
    run_for(15 * 1000 + 2000);                    // quiet: the screensaver starts
    TEST_ASSERT_EQUAL_STRING("screensaver", director_beat_name());
    run_for(60 * 1000);                           // rest, dip, rest, dip, ...
    assert_one_clawd();
}

// Seeded fuzz: activity, prompts, stops, usage moving, fresh windows,
// alerts and clears, taps, buttons, the link dropping, and the QA beats, at
// random moments over a long stretch.
static uint32_t fz = 0xC1A3D;
static uint32_t fz_next(void) { fz ^= fz << 13; fz ^= fz >> 17; fz ^= fz << 5; return fz; }
static uint32_t fz_range(uint32_t lo, uint32_t hi) { return lo + fz_next() % (hi - lo + 1); }

// director_init() is for boot; between runs, also drop what a run left
// pending (this file includes the director, so its statics are in reach).
static void fresh_director(void) {
    attention_on = false;
    resume_screensaver = false;
    react_anim = NULL;
    joy_pending = false;
    saver_turn = 0;
    fake_party_reset();
    ClawdTuning fast;
    clawd_tuning_fast(&fast);
    clawd_tuning_set_base(&fast);
    clawd_set_liveliness(CLAWD_LIVELINESS_DEFAULT);
    clawd_set_attn_anim(fuzz_attn_s);
    director_init();
    // Hooks installed: one activity reading is enough for signals to know.
    signals_clear();
    UsageData d = live_payload();
    d.activity = 0;
    signals_ingest_at(&d, fake_now_ms);
}

static int fuzz_level = CLAWD_LIVELINESS_DEFAULT;

// has_performer defaults to has_big (PSRAM, or no full-size Clawd at all).
static void fuzz(uint32_t seed, uint32_t total_ms, bool has_big, int has_performer = -1) {
    fz = seed;
    world.has_big = has_big;
    world.has_performer = has_performer < 0 ? has_big : has_performer != 0;
    fresh_director();
    director_set_liveliness(fuzz_level);
    float pct = 10;
    uint32_t es = 0;
    for (uint32_t t = 0; t < total_ms && !broke;) {
        const uint32_t gap = fz_range(50, 6000);
        run_for(gap);
        t += gap;
        UsageData d = live_payload();
        SignalsUpdate sig = no_signal();
        switch (fz_next() % 18) {
        case 0: case 1:  world.activity = (int)fz_range(0, 3); break;
        case 2:          world.activity = 3; break;
        case 3: case 4:  sig.event_fired = true; sig.event = "psbtf"[fz_next() % 5]; sig.event_seq = ++es; break;
        case 5:          pct += 1; d.session_pct = pct; break;
        case 6:          sig.session_reset = true; pct = 0; d.session_pct = pct; break;
        case 7:          director_alert("needs you"); continue;
        case 8:          director_alert_clear(); continue;
        case 9:          director_tap((int)fz_range(0, 479), (int)fz_range(0, 479)); continue;
        case 10:         director_tap((int)fz_range(0, 479), (int)fz_range(0, FAKE_HEADER_H - 1)); continue;   // the header
        case 11:         (void)director_button(true); continue;
        case 12:         world.meters_live = fz_next() % 4 != 0; continue;
        case 13: {
            static const char* const BEATS[] = { "show", "screensaver", "lurk", "peek", "joy", "home",
                                                 "pet", "pass", "fail", "screensaver 2" };
            director_debug(BEATS[fz_next() % 10]);
            continue;
        }
        case 14:         director_set_liveliness((int)fz_range(1, 5)); continue;
        case 15:         (void)director_page_open(); continue;     // PWR: the Clawd page
        case 16:         director_page_closed(); continue;         // PWR again: the meters
        default:         break;                   // a quiet stretch
        }
        d.session_pct = pct;
        send(d, sig);
    }
    assert_one_clawd();
    // Left alone afterwards, nothing hangs: whatever was running finishes
    // and he ends up home or in the screensaver.
    director_page_closed();
    director_alert_clear();
    world.meters_live = true;
    world.activity = 0;
    run_for(3 * 60 * 1000);
    assert_one_clawd();
    const char* b = director_beat_name();
    char msg[64];
    snprintf(msg, sizeof(msg), "seed %lu stuck in %s", (unsigned long)seed, b);
    TEST_ASSERT_TRUE_MESSAGE(strcmp(b, "home") == 0 || strcmp(b, "screensaver") == 0, msg);
}

static void test_fuzz_one_clawd_with_full_size_sprite(void) {
    memset(seen, 0, sizeof(seen));
    for (uint32_t seed = 1; seed <= 40 && !broke; seed++) fuzz(seed * 2654435761u, 30 * 60 * 1000, true);
    assert_every_beat_seen(true);
}

static void test_fuzz_one_clawd_without_full_size_sprite(void) {
    memset(seen, 0, sizeof(seen));
    for (uint32_t seed = 1; seed <= 20 && !broke; seed++) fuzz(seed * 40503u, 30 * 60 * 1000, false);
    assert_every_beat_seen(false);
}

// No PSRAM, direct_performer: the performer's grid and the full-size
// sprite's are allocated separately, so one can be there without the other.
// Shows then play full size with a seated attention wave, or as corner acts
// with the big attention walk-on and lurk trips; still one Clawd.
static void test_fuzz_one_clawd_with_performer_but_no_full_size_sprite(void) {
    memset(seen, 0, sizeof(seen));
    for (uint32_t seed = 1; seed <= 15 && !broke; seed++) fuzz(seed * 31337u, 30 * 60 * 1000, false, 1);
    assert_every_beat_seen(true);
    assert_one_clawd();
}

static void test_fuzz_one_clawd_with_full_size_sprite_but_no_performer(void) {
    memset(seen, 0, sizeof(seen));
    for (uint32_t seed = 1; seed <= 15 && !broke; seed++) fuzz(seed * 65537u, 30 * 60 * 1000, true, 0);
    assert_every_beat_seen(false);
    assert_one_clawd();
}

// No-nonsense: everything that isn't a tap or an alert leaves him sitting
// still in his seat: busy stretches, prompts, stops, usage moving, a fresh
// window, a long quiet.
static void test_no_nonsense_sits_still_through_everything_but_taps(void) {
    fresh_director();
    director_set_liveliness(1);
    float pct = 10;
    uint32_t es = 0;
    world.activity = 3;
    bool moved = false;
    for (int i = 0; i < 400 && !moved; i++) {
        UsageData d = live_payload();
        SignalsUpdate sig = no_signal();
        if (i % 3 == 0) { sig.event_fired = true; sig.event = "psb"[(i / 3) % 3]; sig.event_seq = ++es; }
        if (i % 7 == 0) pct += 1;
        if (i == 200) { sig.session_reset = true; pct = 0; }
        d.session_pct = pct;
        send(d, sig);
        for (int t = 0; t < 500; t += TICK_MS) {    // 200 s in all, past every fast timer
            run_for(TICK_MS);
            if (!fake_corner_seated_still() || strcmp(director_beat_name(), "home") != 0) moved = true;
        }
    }
    TEST_ASSERT_FALSE_MESSAGE(moved, "he left his seat or a beat started");
    director_tap(300, 300);                          // a tap still gets the peek
    run_for(3000);
    TEST_ASSERT_EQUAL_STRING("peek", director_beat_name());
    director_set_liveliness(CLAWD_LIVELINESS_DEFAULT);
}

// Turning the slider down mid-show ends the show gracefully.
static void test_no_nonsense_ends_a_running_show(void) {
    fresh_director();
    TEST_ASSERT_TRUE(director_debug("show"));
    run_for(6000);
    director_set_liveliness(1);
    run_for(30 * 1000);
    assert_one_clawd();
    TEST_ASSERT_EQUAL_STRING("home", director_beat_name());
    TEST_ASSERT_TRUE(fake_corner_seated_still());
    director_set_liveliness(CLAWD_LIVELINESS_DEFAULT);
}

static void test_fuzz_one_clawd_at_every_liveliness(void) {
    for (fuzz_level = 1; fuzz_level <= 5 && !broke; fuzz_level++)
        for (uint32_t seed = 1; seed <= 6 && !broke; seed++) fuzz(seed * 97u + fuzz_level, 20 * 60 * 1000, true);
    fuzz_level = CLAWD_LIVELINESS_DEFAULT;
    assert_one_clawd();
}

// Attention animation Off: the alert is up (message, dismissing tap, the
// app hears about it) but he never points or waves; he sits in his seat,
// including when the alert cut a show short and he had to come back.
static void attention_off(bool has_big) {
    world.has_big = world.has_performer = has_big;
    fuzz_attn_s = 0;
    fresh_director();
    world.activity = 3;
    TEST_ASSERT_TRUE(director_debug("show"));
    run_for(has_big ? 9000 : 1500);              // mid-performance (or mid corner act)
    director_alert("needs you");
    bool animated = false;
    for (int t = 0; t < 15000; t += TICK_MS) {   // under the sim's 20 s alert
        run_for(TICK_MS);
        if (fake_attention_animating()) animated = true;
    }
    TEST_ASSERT_FALSE_MESSAGE(animated, "he pointed or waved with the animation off");
    TEST_ASSERT_EQUAL_STRING("attention", director_beat_name());
    TEST_ASSERT_TRUE(attention_on);
    TEST_ASSERT_TRUE(fake_corner_seated_still());
    director_tap(200, 200);                      // the alert itself still works
    TEST_ASSERT_TRUE(director_take_dismissed());
    run_for(5000);
    TEST_ASSERT_EQUAL_STRING("home", director_beat_name());
    assert_one_clawd();
    fuzz_attn_s = CLAWD_ATTN_ANIM_DEFAULT_S;
}
// Without a touchscreen BOOT is the dismiss gesture: it ends an alert (and
// tells the app) instead of doing its normal job; with nothing to dismiss, or
// with a touchscreen, the press is left to its normal role.
static void test_boot_dismisses_alert_without_touch(void) {
    world.has_big = world.has_performer = true;
    world.has_touch = false;
    fresh_director();
    TEST_ASSERT_FALSE_MESSAGE(director_button(true), "nothing to dismiss");
    director_alert("needs you");
    run_for(1000);
    TEST_ASSERT_TRUE(attention_on);
    TEST_ASSERT_FALSE_MESSAGE(director_button(false), "a secondary button is not the dismiss gesture");
    TEST_ASSERT_TRUE(attention_on);
    TEST_ASSERT_TRUE_MESSAGE(director_button(true), "BOOT dismisses the alert");
    TEST_ASSERT_FALSE(attention_on);
    TEST_ASSERT_TRUE(director_take_dismissed());
    run_for(5000);
    TEST_ASSERT_EQUAL_STRING("home", director_beat_name());
    TEST_ASSERT_FALSE_MESSAGE(director_button(true), "back to push to talk");
    world.has_touch = true;
}

static void test_boot_leaves_alert_alone_with_touch(void) {
    world.has_big = world.has_performer = true;
    world.has_touch = true;
    fresh_director();
    director_alert("needs you");
    run_for(1000);
    TEST_ASSERT_FALSE(director_button(true));
    TEST_ASSERT_TRUE(attention_on);
}

static void test_attention_animation_off_with_full_size_sprite(void) { attention_off(true); }
static void test_attention_animation_off_without_full_size_sprite(void) { attention_off(false); }

// A short attention animation (10 s: 1.7 s of the sim's 20 s alert): he
// points and waves, then goes back to his seat while the alert stays up
// until its own timeout.
static void attention_short(bool has_big) {
    world.has_big = world.has_performer = has_big;
    fuzz_attn_s = 10;
    fresh_director();
    director_alert("needs you");
    run_for(1000);
    TEST_ASSERT_TRUE(fake_attention_animating());
    run_for(6000);                               // his part is over, and he's home
    TEST_ASSERT_FALSE(fake_attention_animating());
    TEST_ASSERT_TRUE(fake_corner_seated_still());
    TEST_ASSERT_TRUE(attention_on);
    TEST_ASSERT_EQUAL_STRING("attention", director_beat_name());
    run_for(8000);                               // 15 s in: still sitting, alert still up
    TEST_ASSERT_TRUE(fake_corner_seated_still());
    TEST_ASSERT_TRUE(attention_on);
    director_alert("needs you again");           // a new alert animates again
    run_for(1000);
    TEST_ASSERT_TRUE(fake_attention_animating());
    run_for(25 * 1000);                          // the alert times out (nobody came: the
    TEST_ASSERT_FALSE(attention_on);             // quiet time may have opened the screensaver)
    TEST_ASSERT_TRUE(director_take_dismissed());
    TEST_ASSERT_TRUE(strcmp(director_beat_name(), "attention") != 0);
    assert_one_clawd();
    fuzz_attn_s = CLAWD_ATTN_ANIM_DEFAULT_S;
}
static void test_short_attention_animation_with_full_size_sprite(void) { attention_short(true); }
static void test_short_attention_animation_without_full_size_sprite(void) { attention_short(false); }

static void test_fuzz_one_clawd_at_every_attention_animation(void) {
    static const int SETTINGS[] = { 0, 10, 30 };
    for (int i = 0; i < 3 && !broke; i++) {
        fuzz_attn_s = SETTINGS[i];
        for (uint32_t seed = 1; seed <= 6 && !broke; seed++) {
            fuzz(seed * 7919u + i, 20 * 60 * 1000, true);
            fuzz(seed * 104729u + i, 20 * 60 * 1000, false);
        }
    }
    fuzz_attn_s = CLAWD_ATTN_ANIM_DEFAULT_S;
    assert_one_clawd();
}

// The Clawd page takes him from the meters: the corner Clawd is away while
// it's up, an alert stays on the page (a tap dismisses it), the next tap asks
// for the meters, and he walks back to his seat.
static void test_page_has_the_one_clawd(void) {
    fresh_director();
    world.has_big = false;
    run_for(500);
    TEST_ASSERT_TRUE(director_page_open());
    TEST_ASSERT_EQUAL_STRING("page", director_beat_name());
    TEST_ASSERT_TRUE(director_room() == ROOM_PAGE);
    run_for(30 * 1000);                           // quiet, busy: nothing starts behind it
    world.activity = 3;
    run_for(30 * 1000);
    TEST_ASSERT_EQUAL_STRING("page", director_beat_name());
    director_alert("needs you");
    run_for(1000);
    TEST_ASSERT_EQUAL_STRING("page", director_beat_name());
    TEST_ASSERT_TRUE(director_alert_active());
    TEST_ASSERT_EQUAL_STRING("needs you", director_alert_message());
    director_tap(100);                            // dismisses, stays on the page
    TEST_ASSERT_FALSE(director_alert_active());
    TEST_ASSERT_TRUE(director_take_dismissed());
    TEST_ASSERT_FALSE(director_take_page_exit());
    world.activity = 0;
    director_tap(100);                            // "show me the meters"
    TEST_ASSERT_TRUE(director_take_page_exit());
    director_page_closed();
    TEST_ASSERT_FALSE(director_on_page());
    TEST_ASSERT_EQUAL_STRING("corner", director_beat_name());   // walking back in
    run_for(5 * 1000);
    TEST_ASSERT_EQUAL_STRING("home", director_beat_name());
    assert_one_clawd();
}

// With the face up the page waits: the first press sends the face home.
static void test_page_waits_for_the_face(void) {
    fresh_director();
    run_for(500);
    TEST_ASSERT_TRUE(director_debug("peek"));
    for (int i = 0; i < 100 && !face_visible(); i++) run_for(100);
    TEST_ASSERT_TRUE(face_visible());
    TEST_ASSERT_FALSE(director_page_open());      // the face goes home instead
    TEST_ASSERT_EQUAL_STRING("face-home", director_beat_name());
    run_for(5000);
    TEST_ASSERT_TRUE(director_page_open());
    assert_one_clawd();
    director_page_closed();
}

// ─── Pet mode ────────────────────────────────────────────────────────────────
// A tap on the header: he ducks out, the face comes up and the pet has it;
// the header again, a button, an alert, being left alone or the link
// dropping each end it on the meters with him back in his seat.
static void enter_pet(void) {
    director_tap(240, 20);
    TEST_ASSERT_EQUAL_STRING("pet", director_beat_name());
    run_for(4000);
    TEST_ASSERT_TRUE_MESSAGE(fake_pet_active(), "the pet has the face");
    TEST_ASSERT_FALSE(fake_on_screen().corner);
}

static void assert_back_home(void) {
    TEST_ASSERT_FALSE(fake_pet_active());
    run_for(6000);
    TEST_ASSERT_EQUAL_STRING("home", director_beat_name());
    TEST_ASSERT_FALSE(fake_on_screen().face);
    TEST_ASSERT_TRUE(fake_on_screen().corner);
    assert_one_clawd();
}

static void test_pet_mode_is_the_one_clawd(void) {
    world.has_big = true;
    fresh_director();
    enter_pet();
    director_tap(240, 300);                       // a tap on the face is the pet's, not "show me the meters"
    run_for(1000);
    TEST_ASSERT_TRUE(fake_pet_active());
    director_tap(100, 10);                        // the header: back to the meters
    assert_back_home();

    enter_pet();
    TEST_ASSERT_FALSE(director_button(true));     // a button
    assert_back_home();

    enter_pet();
    director_alert("needs you");                  // an alert outranks it
    TEST_ASSERT_FALSE(fake_pet_active());
    run_for(3000);
    TEST_ASSERT_EQUAL_STRING("attention", director_beat_name());
    director_alert_clear();
    run_for(6000);
    assert_one_clawd();

    fresh_director();
    enter_pet();
    world.activity = 1;                           // Claude working: no screensaver once it's over
    run_for(22000);                               // left alone (the fake pet is done after 20 s)
    assert_back_home();
    world.activity = 0;

    enter_pet();
    world.meters_live = false;                    // the link drops: the hint, not the pet
    run_for(100);
    TEST_ASSERT_FALSE(fake_pet_active());
    run_for(6000);
    world.meters_live = true;
    director_tap(240, 20);                        // stale meters: a header tap is a peek
    run_for(10);
    assert_one_clawd();
}

static void test_header_tap_on_stale_meters_is_a_peek(void) {
    fresh_director();
    world.meters_live = false;
    director_tap(240, 20);
    TEST_ASSERT_EQUAL_STRING("peek", director_beat_name());
    world.meters_live = true;
}

// ─── Test runs ───────────────────────────────────────────────────────────────
static void test_event(char e, uint32_t* es) {
    UsageData d = live_payload();
    SignalsUpdate sig = no_signal();
    sig.event_fired = true;
    sig.event = e;
    sig.event_seq = ++*es;
    send(d, sig);
}

// On the meters: a pass is the green glow, confetti and his fanfare; a fail
// the red glow and the magnifier; in pet mode the face cheers or hunts; with
// the face down for the screensaver only the glow and the confetti show.
static void test_test_runs_party_and_hunt(void) {
    world.has_big = false;
    fresh_director();
    uint32_t es = 0;
    test_event('t', &es);
    TEST_ASSERT_EQUAL_INT(1, fake_glows());
    TEST_ASSERT_EQUAL_HEX32(theme_hex(TH_GREEN), fake_glow_rgb());
    TEST_ASSERT_EQUAL_INT(1, fake_confetti());
    TEST_ASSERT_EQUAL_STRING("trumpet", fake_last_act);
    TEST_ASSERT_TRUE(fake_corner_acting());
    run_for(5000);
    test_event('f', &es);
    TEST_ASSERT_EQUAL_HEX32(theme_hex(TH_RED), fake_glow_rgb());
    TEST_ASSERT_EQUAL_INT(1, fake_confetti());
    TEST_ASSERT_EQUAL_STRING("magnifier", fake_last_act);
    run_for(5000);
    fake_last_act = NULL;
    test_event('f', &es);                          // still failing, soon after: the glow only
    TEST_ASSERT_EQUAL_INT(3, fake_glows());
    TEST_ASSERT_NULL(fake_last_act);
    run_for(5000);

    enter_pet();
    test_event('t', &es);                          // fixed, in pet mode: the face cheers
    TEST_ASSERT_EQUAL_INT(1, fake_pet_cheers());
    TEST_ASSERT_EQUAL_INT(2, fake_confetti());
    TEST_ASSERT_TRUE(fake_pet_active());
    test_event('f', &es);
    TEST_ASSERT_EQUAL_INT(1, fake_pet_hunts());
    director_tap(0, 0);
    assert_back_home();

    director_set_liveliness(1);                    // No-nonsense: the glow, nothing else
    const int conf = fake_confetti(), glows = fake_glows();
    fake_last_act = NULL;
    test_event('t', &es);
    TEST_ASSERT_EQUAL_INT(conf, fake_confetti());
    TEST_ASSERT_EQUAL_INT(glows + 1, fake_glows());
    TEST_ASSERT_NULL(fake_last_act);
    director_set_liveliness(CLAWD_LIVELINESS_DEFAULT);
    assert_one_clawd();
}

// ─── Effect screensavers ─────────────────────────────────────────────────────
// The screensaver takes turns: the face, then each effect. An effect starts
// only once he's off screen, changes now and then, and goes as he walks back.
static void test_screensaver_takes_turns_with_effects(void) {
    world.has_big = true;
    fresh_director();
    for (int turn = 0; turn <= SAVER_COUNT; turn++) {
        run_for(15 * 1000 + 3000);                 // quiet: the screensaver starts
        TEST_ASSERT_EQUAL_STRING("screensaver", director_beat_name());
        const OnScreen s = fake_on_screen();
        if (turn == 0) {
            TEST_ASSERT_TRUE(s.face);
            TEST_ASSERT_FALSE(fake_saver_active());
        } else {
            TEST_ASSERT_TRUE(fake_saver_active());
            TEST_ASSERT_EQUAL_INT(turn - 1, fake_saver_kind());
            TEST_ASSERT_EQUAL_INT(0, fake_clawds(s));
            if (turn == 1) {
                run_for(clawd_tuning().saver_switch_ms);   // it changes effect
                TEST_ASSERT_EQUAL_INT(1, fake_saver_kind());
            }
        }
        director_tap(240, 300);                    // you're back
        run_for(100);
        TEST_ASSERT_FALSE(fake_saver_active());
        run_for(6000);
        TEST_ASSERT_EQUAL_STRING("home", director_beat_name());
        assert_one_clawd();
    }
    TEST_ASSERT_TRUE(director_debug("screensaver 3"));   // QA: a given style
    run_for(3000);
    TEST_ASSERT_EQUAL_INT(2, fake_saver_kind());
    director_alert("needs you");                   // an alert takes it down
    TEST_ASSERT_FALSE(fake_saver_active());
    director_alert_clear();
    run_for(6000);
    assert_one_clawd();
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_screensaver_calm_dip_keeps_one_clawd);
    RUN_TEST(test_page_has_the_one_clawd);
    RUN_TEST(test_page_waits_for_the_face);
    RUN_TEST(test_fuzz_one_clawd_with_full_size_sprite);
    RUN_TEST(test_fuzz_one_clawd_without_full_size_sprite);
    RUN_TEST(test_fuzz_one_clawd_with_performer_but_no_full_size_sprite);
    RUN_TEST(test_fuzz_one_clawd_with_full_size_sprite_but_no_performer);
    RUN_TEST(test_no_nonsense_sits_still_through_everything_but_taps);
    RUN_TEST(test_no_nonsense_ends_a_running_show);
    RUN_TEST(test_fuzz_one_clawd_at_every_liveliness);
    RUN_TEST(test_boot_dismisses_alert_without_touch);
    RUN_TEST(test_boot_leaves_alert_alone_with_touch);
    RUN_TEST(test_attention_animation_off_with_full_size_sprite);
    RUN_TEST(test_attention_animation_off_without_full_size_sprite);
    RUN_TEST(test_short_attention_animation_with_full_size_sprite);
    RUN_TEST(test_short_attention_animation_without_full_size_sprite);
    RUN_TEST(test_fuzz_one_clawd_at_every_attention_animation);
    RUN_TEST(test_pet_mode_is_the_one_clawd);
    RUN_TEST(test_header_tap_on_stale_meters_is_a_peek);
    RUN_TEST(test_test_runs_party_and_hunt);
    RUN_TEST(test_screensaver_takes_turns_with_effects);
    return UNITY_END();
}
