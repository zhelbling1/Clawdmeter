#pragma once
#include <stdbool.h>
#include <stdint.h>

// Pet mode: a tap on the header (the title, or Clawd in his seat) and he
// ducks out; the face comes up (the director's B_PET beat) and it's yours to
// pet. It is THE Clawd, the same face as the screensaver's: no second one.
//
// Boop it (tap), stroke it (rub sideways), it watches your finger; shake the
// board and it gets dizzy, tilt it and the eyes roll that way (boards with an
// accelerometer, imu_hal_accel). It sweats at 90 % usage, watches a thinking
// dot while Claude works, gets bored, sleepy at night, stretches in the
// morning, sneezes, hiccups and yawns; a test run passing gets a "yay!", one
// failing a look around for the bug. Mood and gag timing are pet_mood.h
// (pure, test_pet_mood); this drives the face (face.h) and the props
// (pet_props.h) from them. Adapted from matejkrajcovic111-ctrl/Clawdmeter.

void pet_init(void);                 // after face_init()
void pet_enter(void);                // the face is up and settled (director)
void pet_leave(void);                // props off, eyes back (director, before the drop)
bool pet_active(void);
void pet_tick(uint32_t now);         // every frame while active (director)
bool pet_done(uint32_t now);         // left alone long enough, or the panel slept: back to the meters

// The touch as main.cpp latched it this loop. While active: the eyes follow
// a finger, a sideways rub is a stroke, a short tap is a boop.
void pet_touch(bool pressed, int x, int y);
void pet_celebrate(void);            // tests passed or a fresh window: "yay!"
void pet_bug(void);                  // tests failed: it looks around for the bug
void pet_set_usage(float max_pct);   // the meters' highest %, <0 unknown
