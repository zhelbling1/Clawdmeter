#pragma once
#include <stdint.h>
#include "data.h"
#include "signals.h"

// The director: one Clawd, on the meters, driven by the situation.
//
//   meters  home and default; every path ends here. The corner Clawd sits in
//           his seat and does small acts (mascot.h). He also performs here,
//           full size in front of them (performer.h): a treat after a busy
//           stretch, or a calm dip during the screensaver.
//   face    the #198 face resting on the glass (face.h): the screensaver,
//           the peek when you tap the meters, and pet mode when you tap the
//           header (pet.h). The screensaver also takes turns with effects
//           (savers.h) that have no Clawd at all.
//   page    the Clawd page (pages.h): he's on his own screen, in a scene,
//           and nothing on the meters moves until it closes (the PWR
//           button or a tap brings the meters back).
//
// Rules of continuity: only ever one Clawd (corner sprite, full-size sprite,
// performer or face); he enters and leaves through an edge; the screen never
// hard-cuts. A tap during a performance or on the face means "show me the
// meters"; on the meters themselves it's tapping the aquarium: he reacts.
//
// Beats (design system §09): notice, show, tap → meters, screensaver + wake,
// attention, fresh-window joy, long-turn wave, the tap-on-the-meters peek,
// pet mode, and a test run's fanfare or bug hunt (with party.h's confetti
// and edge glow, which aren't creatures). The lurk trip and idle acts are the corner's own secondary action.
// Minimal mode collapses all of it to a still Clawd. See
// docs/clawd-director.md.

enum DirectorRoom { ROOM_METERS, ROOM_FACE, ROOM_PAGE };

void director_init(void);          // after ui_init()
void director_tick(void);

// Per parsed payload, after signals_ingest().
void director_on_payload(const UsageData* d, const SignalsUpdate* sig);
void director_alert(const char* message);   // attention hook fired
void director_alert_clear(void);            // the session moved on
bool director_take_dismissed(void);         // an alert ended on the device since the last call

// Any touch press at screen (x, y) (wired internally to LVGL). On the meters
// it's tapping the aquarium: the face comes up, curious, for a while (a tap
// on it sends it back); on the header (ui_header_hit) with live meters it's
// pet mode, which a tap on the header ends again; anywhere else it means
// "show me the meters".
void director_tap(int x, int y);
// While on, the panel is the pairing control (the touch-hold re-pair on
// boards without a PWR button): a tap on the meters still counts as you
// being here and dismisses an alert, but Clawd doesn't peek, so the hint
// stays in view for the hold.
void director_set_pairing_touch(bool on);
// A physical button press: you're here. `main_button` is BOOT, or the PWR
// key on a board whose only button it is. On a board without a touchscreen
// that press first dismisses an active alert and returns true (the caller
// then skips the button's normal action, push to talk or brightness);
// otherwise false.
bool director_button(bool main_button);
// Apply a liveliness level (clawd_policy.h) now: the tuning changes, and
// what the new level rules out (a show, the screensaver, idle acts, a
// pending reaction) stops.
void director_set_liveliness(int level);

// How long Clawd's attention animation runs, in seconds (clawd_policy.h;
// 0 = off). The alert itself is unchanged.
void director_set_attn_anim(int seconds);

// Print every beat step with a timestamp (the sim turns it on with
// SIM_TRACE=1 for walkthrough timings). Beat changes always print.
void director_set_trace(bool on);

// The Clawd page (pages.h) takes Clawd. From the meters (home or a corner
// act) the corner Clawd is put away at once, since the page covers the
// meters, and returns true; until director_page_closed() no beat starts and
// an alert only runs its clock (the page shows him yelling, a tap dismisses
// it). With the face up or a performance on it's "show me the meters"
// first and false (press again); during attention, false.
bool director_page_open(void);
// The meters are back: he walks back to his seat, or the attention beat
// takes over if an alert is still up. Counts as you being here.
void director_page_closed(void);
// A tap on the page (with no alert up) or `clawd home` asked for the
// meters since the last call; the page module closes itself.
bool director_take_page_exit(void);
bool director_on_page(void);
// Claude is working (clawd_working: a turn open, or tools running), as of
// the last director_tick. The corner's laptop act and the page's office.
bool director_claude_working(void);
// An alert is up (until a tap, `x` or its timeout) and its message.
bool        director_alert_active(void);
const char* director_alert_message(void);

DirectorRoom director_room(void);
const char*  director_beat_name(void);

// QA hook for the `clawd <beat>` serial command: start a beat now so it can
// be captured with `screenshot` on hardware. beat = show | screensaver [n] |
// attention | joy | lurk | peek [x] | pet | pass | fail | confetti | home.
// Returns false for an unknown name, or for show / screensaver / lurk / peek
// / pet while another beat is still running (lurk also needs the full-size
// sprite, i.e. PSRAM). `peek` is a tap on the meters at x (default: three
// quarters across); `screensaver n` picks its style (0 the face, 1-3 an
// effect); `pass` / `fail` are a test run's verdict as the app sends it.
bool director_debug(const char* beat);
