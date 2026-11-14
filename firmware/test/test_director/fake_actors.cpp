// Timed stand-ins for the director's actors. Each follows the real module's
// contract (mascot.h, performer.h, face.h) closely enough that the
// director's sequencing runs unchanged; the durations are round numbers in
// the right range. Visibility is conservative: a walk counts as on screen
// until it ends.
#include "fake_world.h"
#include "mascot.h"
#include "performer.h"
#include "face.h"
#include "pet.h"
#include "party.h"
#include "savers.h"
#include "ui.h"
#include "idle.h"
#include "minimal_mode.h"
#include "hal/board_caps.h"
#include "usage_rate.h"
#include "signals.h"
#include "clawd_anim.h"
#include <Arduino.h>

uint32_t   fake_now_ms = 1000;
bool       fake_serial_echo = false;
FakeSerial Serial;
FakeWorld  world = { true, 0, false, true, true, true };

// The only BoardCaps field the director reads.
const BoardCaps& board_caps(void) {
    static BoardCaps caps;
    caps.has_touch = world.has_touch;
    return caps;
}

static uint32_t now(void) { return fake_now_ms; }
static bool done(uint32_t until) { return (int32_t)(now() - until) >= 0; }
static uint32_t scaled(uint32_t ms, uint16_t pct) { return ms * 100 / (pct ? pct : 100); }

// ─── Corner + full-size sprite (mascot.h) ───────────────────────────────────
enum MMode { M_SEATED, M_ACT, M_WALK, M_AWAY, M_LURK, M_BIG_IN, M_BIG_ACT, M_BIG_OUT, M_HELD, M_SEAT_ATTN };
enum MAfter { A_SEAT, A_AWAY, A_LURK, A_BIG };
static MMode    m_mode = M_SEATED;
static MAfter   m_after = A_SEAT;
static uint32_t m_until = 0;
static uint32_t m_seated_since = 0;
static bool     m_autonomy = false, m_minimal = false, m_attn = false;
static bool     m_stay_away = false, m_to_seat = true, m_act_auto = false;
static uint32_t m_rng = 12345;

static uint32_t m_rand(void) { m_rng ^= m_rng << 13; m_rng ^= m_rng >> 17; m_rng ^= m_rng << 5; return m_rng; }

static void m_seat(void) { m_mode = M_SEATED; m_seated_since = now(); }
static void m_walk(MAfter then, uint16_t spd) {
    m_mode = M_WALK; m_after = then; m_until = now() + scaled(1500, spd);
}
static void m_big_enter(void) {
    if (!world.has_big) { m_mode = M_AWAY; return; }
    m_mode = M_BIG_IN; m_until = now() + 750;
}

lv_obj_t* mascot_create(lv_obj_t*, int, int, int) { return NULL; }
bool mascot_seated(void)  { return m_mode == M_SEATED; }
bool mascot_away(void)    { return m_mode == M_AWAY; }
bool mascot_busy(void)    { return m_mode != M_SEATED && m_mode != M_AWAY && m_mode != M_HELD; }
bool mascot_acting(void)  { return m_mode == M_ACT; }
bool mascot_free(void)    { return !m_minimal && (m_mode == M_SEATED || (m_mode == M_ACT && m_act_auto)); }
bool mascot_out(void) {
    return !m_minimal && (m_mode == M_LURK || m_mode == M_AWAY || (m_mode == M_WALK && m_after != A_BIG));
}
bool mascot_in_attention(void) {
    return m_attn || m_mode == M_BIG_IN || m_mode == M_BIG_ACT || m_mode == M_BIG_OUT ||
           m_mode == M_HELD || m_mode == M_SEAT_ATTN || (m_mode == M_WALK && m_after == A_BIG);
}
void mascot_set_working(bool on) { (void)on; }
void mascot_autonomy(bool on) { m_autonomy = on; if (on && m_mode == M_SEATED) m_seated_since = now(); }

const char* fake_last_act = NULL;

bool mascot_act(const char* name, uint8_t times, bool, uint16_t speed_pct, bool cut) {
    if (m_minimal) return false;
    if (!(m_mode == M_SEATED || (m_mode == M_ACT && (m_act_auto || cut)))) return false;
    fake_last_act = name;
    m_mode = M_ACT; m_act_auto = false;
    m_until = now() + scaled(1200 * (times ? times : 1), speed_pct);
    return true;
}

// The corner acts that fit a seat (mascot.cpp's CORNER_ANIMS without the
// walk; the fake has room for all of them).
static const char* const M_CYCLE[] = { "waving", "pointing", "dancing", "jumping happy", "trumpet",
                                       "magnifier", "laptop", "idle hearts", "tank idle" };
int mascot_cycle_count(void) { return (int)(sizeof(M_CYCLE) / sizeof(M_CYCLE[0])); }
const char* mascot_cycle_name(int i) { return i >= 0 && i < mascot_cycle_count() ? M_CYCLE[i] : NULL; }

void mascot_leave(uint16_t spd) {
    if (m_minimal || m_mode == M_AWAY) return;
    if (m_mode == M_LURK) { m_stay_away = true; return; }
    if (m_mode == M_WALK && m_after != A_SEAT) { if (m_after == A_LURK) m_after = A_AWAY; return; }
    m_walk(A_AWAY, spd);
}

void mascot_return(int, uint16_t spd) {
    if (m_mode == M_WALK && m_after != A_SEAT) { m_walk(A_SEAT, spd); return; }
    if (m_mode == M_LURK) { m_stay_away = false; return; }
    if (m_mode != M_AWAY) return;
    m_walk(A_SEAT, spd);
}

bool mascot_lurk(void) {
    if (m_minimal || !world.has_big || m_mode != M_SEATED) return false;
    m_walk(A_LURK, 100);
    return true;
}

bool mascot_hurry_home(void) {
    if (m_minimal) return false;
    switch (m_mode) {
    case M_SEATED: case M_ACT: return true;
    case M_LURK: m_stay_away = false; return true;
    case M_WALK:
        if (m_after == A_BIG) return false;
        if (m_after != A_SEAT) m_walk(A_SEAT, 250);
        return true;
    case M_AWAY: m_walk(A_SEAT, 250); return true;
    default: return false;
    }
}

void mascot_place_away(void) { m_stay_away = false; m_mode = M_AWAY; }
void mascot_reset(void) { m_attn = false; m_stay_away = false; m_seat(); }
void mascot_set_minimal(bool on) { m_minimal = on; mascot_reset(); }

void mascot_attention(bool on, bool to_seat) {
    if (on == m_attn) return;
    m_attn = on;
    m_to_seat = on || to_seat;
    if (m_minimal) { if (on) m_mode = M_HELD; else m_seat(); return; }
    if (!world.has_big) {
        if (on) {
            if (m_mode == M_SEATED || m_mode == M_ACT) m_mode = M_SEAT_ATTN;
            else mascot_return(-1, 150);
        } else if (m_mode == M_SEAT_ATTN) {
            m_seat();
        }
        return;
    }
    if (on) {
        if (m_mode == M_AWAY || m_mode == M_LURK) m_big_enter();
        else if (m_mode == M_BIG_OUT)             m_mode = M_BIG_IN;
        else                                      m_walk(A_BIG, 200);
    } else {
        if (m_mode == M_WALK && m_after == A_BIG) {
            if (m_to_seat) m_walk(A_SEAT, 200);
            else           m_after = A_AWAY;
        } else if (m_mode == M_BIG_IN || m_mode == M_BIG_ACT) {
            m_mode = M_BIG_OUT; m_until = now() + 750;
        }
    }
}

void mascot_tick(void) {
    switch (m_mode) {
    case M_SEATED:
        if (m_attn && !world.has_big && !m_minimal) { m_mode = M_SEAT_ATTN; return; }
        if (!m_autonomy || m_minimal || now() - m_seated_since < 4000) return;
        if (world.has_big && m_rand() % 3 == 0) { m_walk(A_LURK, 100); return; }
        m_mode = M_ACT; m_act_auto = true; m_until = now() + 1200;
        return;
    case M_ACT:
        if (done(m_until)) m_seat();
        return;
    case M_WALK:
        if (!done(m_until)) return;
        if (m_after == A_SEAT) { m_seat(); return; }
        m_mode = M_AWAY;
        if (m_after == A_LURK) { m_mode = M_LURK; m_until = now() + 3000; }
        else if (m_after == A_BIG) m_big_enter();
        return;
    case M_LURK:
        if (!done(m_until)) return;
        if (m_stay_away) { m_stay_away = false; m_mode = M_AWAY; return; }
        m_walk(A_SEAT, 100);
        return;
    case M_BIG_IN:
        if (done(m_until)) m_mode = M_BIG_ACT;
        return;
    case M_BIG_OUT:
        if (!done(m_until)) return;
        if (!m_to_seat) { m_mode = M_AWAY; return; }
        m_walk(A_SEAT, 100);
        return;
    default:
        return;
    }
}


// ─── Performer (performer.h) ─────────────────────────────────────────────────
enum PState { P_OFF, P_STAND, P_WALK_IN, P_WALK_OUT, P_SCENE };
static PState   p_state = P_OFF;
static uint32_t p_until = 0;

void performer_init(lv_obj_t*, int) {}
bool performer_available(void) { return world.has_performer; }
void performer_place_offstage(int) { p_state = P_OFF; }
void performer_walk_home(uint16_t spd) {
    if (p_state != P_OFF) { p_state = P_STAND; return; }
    p_state = P_WALK_IN; p_until = now() + scaled(2000, spd);
}
void performer_walk_off(int, uint16_t spd) { p_state = P_WALK_OUT; p_until = now() + scaled(2000, spd); }
void performer_run_off(int side, uint16_t from, uint16_t, uint32_t) { performer_walk_off(side, from); }
int fake_last_scene = -1;
int fake_scenes = 0;
void performer_perform(int idx, uint32_t loop_ms) {
    p_state = P_SCENE; p_until = now() + loop_ms + 2000;
    fake_last_scene = idx;
    fake_scenes++;
}
void performer_perform_group(int, uint32_t loop_ms, bool) { performer_perform(0, loop_ms); }
void performer_release(void) { if (p_state != P_OFF) p_state = P_STAND; }
bool performer_busy(void) { return p_state == P_WALK_IN || p_state == P_WALK_OUT || p_state == P_SCENE; }
bool performer_visible(void) { return p_state != P_OFF; }
void performer_tick(void) {
    if (!done(p_until)) return;
    if (p_state == P_WALK_IN || p_state == P_SCENE) p_state = P_STAND;
    else if (p_state == P_WALK_OUT) p_state = P_OFF;
}

// ─── Face (face.h) ───────────────────────────────────────────────────────────
enum FState { F_HIDDEN, F_RISING, F_UP, F_DROPPING };
static FState   f_state = F_HIDDEN;
static uint32_t f_until = 0, f_busy_until = 0;

void face_init(void) {}
void face_tick(void) {
    if (!done(f_until)) return;
    if (f_state == F_RISING) f_state = F_UP;
    else if (f_state == F_DROPPING) f_state = F_HIDDEN;
}
void face_rise(void) { f_state = F_RISING; f_until = now() + 860; }
void face_rise_toward(int) { face_rise(); }
void face_drop(void) { f_state = F_DROPPING; f_until = now() + 510; }
void face_hide_now(void) { f_state = F_HIDDEN; }
bool face_visible(void) { return f_state != F_HIDDEN; }
bool face_moving(void) { return f_state == F_RISING || f_state == F_DROPPING; }
bool face_busy(void) { return face_moving() || !done(f_busy_until); }
void face_blink(bool twice) { f_busy_until = now() + (twice ? 500 : 250); }
void face_set_resting(bool) {}
void face_look_at_x(int, uint32_t hold_ms) { f_busy_until = now() + hold_ms + 300; }

// ─── Pet mode (pet.h) ────────────────────────────────────────────────────────
// It drives the face while it's up; the director must have raised the face
// first (pet_enter on a hidden face would be a pet nobody sees).
static bool     pt_active = false;
static uint32_t pt_since = 0;
static int      pt_cheers = 0, pt_hunts = 0;
void pet_init(void) {}
void pet_enter(void) {
    if (!face_visible()) { fputs("pet_enter with the face down\n", stderr); abort(); }
    pt_active = true; pt_since = now();
}
void pet_leave(void) { pt_active = false; }
bool pet_active(void) { return pt_active; }
void pet_tick(uint32_t) {}
bool pet_done(uint32_t t) { return pt_active && ((uint32_t)(t - pt_since) >= 20000 || world.asleep); }
void pet_touch(bool, int, int) {}
void pet_celebrate(void) { if (pt_active) pt_cheers++; }
void pet_bug(void) { if (pt_active) pt_hunts++; }
void pet_set_usage(float) {}
bool fake_pet_active(void) { return pt_active; }
int  fake_pet_cheers(void) { return pt_cheers; }
int  fake_pet_hunts(void) { return pt_hunts; }

// ─── Party (party.h) ─────────────────────────────────────────────────────────
static int      py_confetti = 0, py_glows = 0;
static uint32_t py_rgb = 0;
void party_init(void) {}
void party_confetti(void) { py_confetti++; }
void party_glow(uint32_t rgb, int) { py_glows++; py_rgb = rgb; }
bool party_active(void) { return false; }
void party_stop(void) {}
void party_tick(void) {}
int  fake_confetti(void) { return py_confetti; }
int  fake_glows(void) { return py_glows; }
uint32_t fake_glow_rgb(void) { return py_rgb; }
void fake_party_reset(void) { py_confetti = py_glows = 0; py_rgb = 0; pt_cheers = pt_hunts = 0; fake_last_act = NULL; }

// ─── Effect screensavers (savers.h) ──────────────────────────────────────────
static int sv_kind = -1;
void saver_init(void) {}
void saver_start(int kind) { if (kind >= 0 && kind < SAVER_COUNT) sv_kind = kind; }
void saver_stop(void) { sv_kind = -1; }
bool saver_active(void) { return sv_kind >= 0; }
int  saver_kind(void) { return sv_kind; }
const char* saver_name(int) { return ""; }
void saver_tick(void) {}
bool fake_saver_active(void) { return sv_kind >= 0; }
int  fake_saver_kind(void) { return sv_kind; }

// ─── The situation ───────────────────────────────────────────────────────────
bool ui_meters_live(void) { return world.meters_live; }
bool ui_header_hit(int, int y) { return y >= 0 && y < FAKE_HEADER_H; }
int  ui_local_hour(void) { return -1; }
void ui_set_alert_text(const char*) {}
const char* fake_status_note = NULL;
void ui_set_status_note(const char* text) { fake_status_note = text; }
bool idle_is_asleep(void) { return world.asleep; }
bool minimal_mode(void) { return false; }
int  usage_rate_base_group(void) { return RATE_ACTIVE; }
int  signals_activity(void) { return world.activity; }
// clawd_anim_index is the real one (clawd_anim.cpp is in the native build).

void fake_actors_tick(void) {
    performer_tick();
    mascot_tick();
}

OnScreen fake_on_screen(void) {
    OnScreen s;
    s.corner = (m_mode == M_SEATED || m_mode == M_ACT || m_mode == M_WALK || m_mode == M_HELD ||
                m_mode == M_SEAT_ATTN);
    s.big = (m_mode == M_LURK || m_mode == M_BIG_IN || m_mode == M_BIG_ACT || m_mode == M_BIG_OUT);
    s.performer = performer_visible();
    s.face = face_visible();
    return s;
}

bool fake_corner_seated_still(void) { return m_mode == M_SEATED; }
bool fake_corner_acting(void) { return m_mode == M_ACT; }
bool fake_attention_animating(void) { return mascot_in_attention(); }

int fake_clawds(const OnScreen& s) {
    return (int)s.corner + (int)s.big + (int)s.performer + (int)s.face;
}
