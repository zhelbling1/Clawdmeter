#pragma once
// The director test's stand-ins for everything around the director: the
// actors (corner and full-size sprite, performer, face) as
// small timed state machines with the real modules' contracts, and the
// situation the director reads (meters live, activity). Hooks come from
// the real signals module.
#include <stdint.h>

struct FakeWorld {
    bool meters_live;
    int  activity;
    bool asleep;
    bool has_big;          // the full-size sprite: lurk trips, the attention walk-on
    bool has_touch;        // BoardCaps.has_touch
    bool has_performer;    // full-size shows and calm dips (performer_available)
    // With PSRAM both full-size actors are there; without it they're there
    // only on direct_performer boards, each on its own internal-RAM grid
    // (direct_sprite.h), so one can be set up and the other not.
};
extern FakeWorld world;

// Advance the actors that main.cpp ticks (performer, corner) to now.
void fake_actors_tick(void);

// Who is on screen right now. The one-Clawd rule: at most one at a time.
struct OnScreen {
    bool corner;           // the corner sprite (seated, acting or walking)
    bool big;              // the full-size sprite (lurk trip, attention)
    bool performer;        // the performer on the meters
    bool face;             // the face, any part of it
};
OnScreen fake_on_screen(void);
bool     fake_corner_seated_still(void);   // in his seat, not acting or walking
bool     fake_corner_acting(void);         // playing a commanded or idle act in his seat
extern const char* fake_last_act;          // the last act mascot_act accepted

// Pet mode, the party and the effect screensavers (pet.h, party.h, savers.h).
#define FAKE_HEADER_H 60                   // ui_header_hit: y above this
bool     fake_pet_active(void);
int      fake_pet_cheers(void);            // pet_celebrate calls
int      fake_pet_hunts(void);             // pet_bug calls
int      fake_confetti(void);              // party_confetti calls
int      fake_glows(void);                 // party_glow calls
uint32_t fake_glow_rgb(void);              // the last glow's colour
bool     fake_saver_active(void);
int      fake_saver_kind(void);
void     fake_party_reset(void);
bool     fake_attention_animating(void);   // any part of the attention animation on screen
int      fake_clawds(const OnScreen& s);
