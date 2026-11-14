#!/usr/bin/env node
/**
 * "Do a barrel roll": made for this fork, AI-drawn with the originals kit.
 * References the 1997 space-shooter catchphrase: a pilot told to barrel
 * roll, and doing it. Generic aviator costume (leather flying cap, goggles,
 * a long red scarf, bomber jacket); no ships, no characters, no logos.
 *
 * Story: idle → poof (flying cap, goggles, scarf, bomber jacket) → "DO A
 * BARREL ROLL!" → he snaps the goggles down, crouches and launches → loop:
 * he barrel-rolls across the stage, wind streaking past, then swoops back →
 * lands, goggles up, pleased → poof → idle.
 *
 * Usage: node gaming/barrelroll.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, line, caption } = k;
const { tumble } = require('./props');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-BarrelRoll.gif', name: 'barrel roll', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Star Fox 64 (1997): the "Do a barrel roll!" catchphrase. Generic aviator costume (flying cap, goggles, scarf, bomber jacket); no ships or characters.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

// Leather flying cap with ear flaps; goggles up on the brow or down over
// the eyes (frames only, his eyes show through).
function flyingCap(down) {
  return (g, P) => {
    const [x0, x1] = k.headSpan(P), t = P.head.top;
    rect(g, x0 + 2, t - 2, x1 - 2, t - 2, C.brown);
    rect(g, x0, t - 1, x1, t, C.brown);
    rect(g, x0 - 1, t, x0, P.eyeBottom + 1, C.brown); rect(g, x1, t, x1 + 1, P.eyeBottom + 1, C.brown);   // flaps
    if (!down) {
      rect(g, x0 + 1, t - 1, x1 - 1, t - 1, C.slate);                    // strap
      for (const e of P.eyes) { rect(g, e.x - 1, t - 2, e.x + 2, t - 1, C.steel); rect(g, e.x, t - 1, e.x + 1, t - 1, C.sky); }
      return;
    }
    rect(g, x0 + 1, P.eyeY - 1, x1 - 1, P.eyeY - 1, C.slate);            // strap
    for (const e of P.eyes) {                                             // goggle rims around the eyes
      rect(g, e.x - 1, P.eyeY - 1, e.x + 2, P.eyeY - 1, C.steel);
      rect(g, e.x - 1, P.eyeBottom + 1, e.x + 2, P.eyeBottom + 1, C.steel);
      rect(g, e.x - 1, P.eyeY, e.x - 1, P.eyeBottom, C.steel); rect(g, e.x + 2, P.eyeY, e.x + 2, P.eyeBottom, C.steel);
      put(g, e.x + 2, P.eyeY - 1, C.sky);
    }
  };
}
// Long red scarf streaming behind (to screen left) from the neck; phase
// flutters it. (No band across the chin: right under the eyes it reads as
// a mouth.)
function scarf(phase = 0, len = 7) {
  return (g, P) => {
    const y = P.chin;
    const x0 = k.headSpan(P)[0];
    for (let i = 0; i < len; i++) {
      const wav = [0, 1, 1, 0][(i + phase) % 4];
      put(g, x0 - 1 - i, y + 1 + wav, C.red); put(g, x0 - 1 - i, y + 2 + wav, i % 3 === 2 ? C.maroon : C.red);
    }
  };
}
const bomber = (g, P) => k.jacket(g, P, { c: C.olive, dark: C.brown, zip: C.tan, belt: null });
const pilot = (down, phase, len) => [bomber, scarf(phase, len), flyingCap(down)];

// Wind streaks running past (to the left), staggered by phase.
function wind(g, phase, rows = [12, 17, 31, 35]) {
  rows.forEach((y, i) => {
    const x = 42 - ((phase * 6 + i * 11) % 30);
    line(g, x, y, x + 4 + (i % 2) * 2, y, C.gray);
  });
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: pilot(opts.down, opts.phase || 0, opts.len || 4) });
const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 3, ph);

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: suited up.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { him(g, 'idle', { phase: 1 }); puff(g, 3); });

// The order comes in.
const order = (g, c) => { caption(g, 'DO A', 26, 7, c, { align: 'center' }); caption(g, 'BARREL ROLL!', 26, 13, c, { align: 'center' }); };
sc.frame(700, g => { him(g, 'idle', { eyes: 'up', phase: 2 }); order(g, C.ivory); });
sc.frame(220, g => { him(g, 'wave_1', { eyes: 'closed', phase: 3 }); order(g, C.gray); });
sc.frame(200, g => him(g, 'crouch', { down: true, phase: 0 }));
sc.frame(110, g => { him(g, 'jump_up', { down: true, dx: -4, len: 7, phase: 1 }); k.dust(g, 26, 36, 0); });

// Loop: a full roll left-to-right through the air, wind streaking, then a
// swoop back to the start.
sc.loopStart();
for (let i = 0; i < 8; i++) sc.frame(90, g => {
  wind(g, i);
  tumble(g, 'idle', i * 45, { over: pilot(true, i, 7), dx: -7 + 2 * i, dy: -6 });
});
sc.frame(110, g => { wind(g, 8, [14, 33]); him(g, 'jump_top', { down: true, flip: true, dx: 6, dy: 1, eyes: 'happy', len: 7 });
  k.motionLines(g, 40, 18, { dir: 'right', len: 4, count: 3, gap: 4 }); });
sc.frame(110, g => { wind(g, 9, [14, 33]); him(g, 'jump_top', { down: true, flip: true, dx: -3, dy: 1, eyes: 'happy', len: 7 });
  k.motionLines(g, 33, 18, { dir: 'right', len: 4, count: 3, gap: 4 }); });
sc.loopEnd();

// Land, goggles up, chuffed.
sc.frame(110, g => { him(g, 'jump_fall', { down: true, dx: -2, dy: -2 }); });
sc.frame(150, g => { him(g, 'jump_land', { down: true }); k.dust(g, 26, 36, 0); });
sc.frame(200, g => { him(g, 'jump_recover', { eyes: 'happy', phase: 2 }); k.dust(g, 26, 36, 1); });
sc.frame(450, g => him(g, 'idle', { eyes: 'happy', phase: 3 }));

// Poof off.
sc.frame(90, g => { him(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
