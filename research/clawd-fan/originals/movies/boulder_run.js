#!/usr/bin/env node
/**
 * "Boulder run": made for this fork, AI-drawn with the originals kit.
 * References the temple-escape opening of a 1981 adventure film: brown
 * fedora, leather jacket, satchel and coiled whip, a golden idol on a
 * pedestal, and the giant rolling boulder. Caricature only, no likeness, no
 * logos.
 *
 * Story: idle → poof (fedora, jacket, satchel, whip; a pedestal with an
 * idol, temple columns behind) → he snatches the idol, proud → RUMBLE, dust
 * falls; he glances back: a huge boulder → loop (about 2 s): he runs flat
 * out while the columns stream past and the boulder drops back; he glances
 * over his shoulder, trips, his hat pops up and the boulder looms right
 * behind him; he scrambles, the hat lands, and he pulls away again → it
 * rolls right over him (slapstick squash) → he pops back up, idol held
 * high → poof → idle.
 *
 * Usage: node movies/boulder_run.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, disc, stamp } = k;
const m2 = require('./props_m2');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-BoulderRun.gif', name: 'boulder run', mood: 'heavy', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The rolling-boulder temple escape from Raiders of the Lost Ark (1981): brown fedora, leather jacket, satchel, whip, golden idol on a pedestal, temple columns.',
});

// ── Props ────────────────────────────────────────────────────────────────────

function pedestal(g) {
  rect(g, 39, 27, 45, 27, C.steel);
  rect(g, 40, 28, 44, 36, C.slate);
  put(g, 41, 30, C.charcoal); put(g, 42, 31, C.charcoal); put(g, 43, 33, C.charcoal);
}

// The idol: a squat golden figure, 5×7, top-left at (x, y).
function idol(g, x, y) {
  stamp(g, x, y, [
    '.###.',
    '#a#a#',
    '.###.',
    'g###g',
    '.#a#.',
    '.###.',
    '##.##',
  ], { '#': C.gold, a: C.amber, g: C.amber });
}

// The boulder: radius 10.5 at (cx, cy); phase turns its cracks (period 6).
function boulder(g, cx, cy, phase = 0) {
  disc(g, cx, cy, 10.5, C.charcoal);
  disc(g, cx, cy, 9.6, C.gray);
  // Highlight up-left.
  for (const [u, v] of [[-6, -5], [-5, -6], [-4, -7], [-7, -3], [-3, -7], [-6, -4]]) put(g, cx + u, cy + v, C.steel);
  // Cracks and pits that turn as it rolls (clockwise when rolling right).
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + phase * Math.PI / 6, r = i % 2 ? 5.5 : 3.5;
    const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
    rect(g, x, y, x + 1, y, C.slate); put(g, x + (i % 2 ? 0 : 1), y + 1, C.slate);
  }
}

// Temple columns behind everything, `SP` cells apart, scrolled left by s.
// Dark stone (charcoal) with a lit left edge and a capital, so they read as
// a set without competing with Clawd.
// They stop at x 47, the scene's right edge (the idol in his hand), so
// they don't widen the clip.
const SP = 16, RIGHT = 47;
function columns(g, s = 0) {
  const off = ((s % SP) + SP) % SP;
  const r = (x0, y0, x1, y1, c) => { if (x0 <= RIGHT) rect(g, x0, y0, Math.min(x1, RIGHT), y1, c); };
  for (let base = -SP; base <= RIGHT + SP; base += SP) {
    const x = base + 6 - off;
    if (x > RIGHT) continue;                            // not in view yet
    r(x, 16, x + 3, 36, C.charcoal);
    r(x, 16, x, 36, C.slate);                           // lit edge
    r(x - 1, 15, x + 4, 15, C.slate);                   // capital
    r(x - 1, 36, x + 4, 36, C.slate);                   // base
  }
}

function debris(g, phase) {
  const pts = [[[12, 16], [28, 17], [36, 16], [21, 20]], [[13, 20], [29, 21], [35, 19], [20, 24]]][phase % 2];
  for (const [x, y] of pts) { put(g, x, y, C.tan); put(g, x + 1, y + 1, C.gray); }
}

// ── Costume ──────────────────────────────────────────────────────────────────

function outfit({ hat = true, lift = 0, tilt = 0 } = {}) {
  return (g, P) => {
    k.jacket(g, P, { c: C.brown, dark: C.charcoal, shirt: C.tan, lapel: C.charcoal });
    // Satchel strap across the chest, bag on the back-side hip.
    const [x0, x1] = k.headSpan(P), m = k.midCol(P);
    for (let i = 0; i <= P.waist - P.chin; i++) k.onBody(g, P, m + 4 - i, P.chin + i, C.tan);
    const bx = P.facing === 'left' ? x1 - 3 : x0;
    rect(g, bx, P.waist - 1, bx + 3, P.waist + 1, C.tan);
    rect(g, bx, P.waist - 1, bx + 3, P.waist - 1, C.amber);
    // Coiled whip on the other hip.
    const wx = P.facing === 'left' ? x0 : x1 - 2;
    stamp(g, wx, P.waist - 1, ['###', '#.#', '###'], { '#': C.brown });
    put(g, wx + 1, P.waist - 1, C.tan);
    if (hat) k.fedora(g, P, { c: C.brown, band: C.charcoal, lift, tilt });
    m2.armsOver(g, P);
  };
}
const him = (g, pose, opts = {}) => {
  const { hat, lift, tilt, ...rest } = opts;
  return k.clawd(g, pose, { ...rest, over: [outfit({ hat, lift, tilt })].concat(opts.over || []) });
};
// The idol in a hand: on top of a raised hand, or just above a side hand.
function held(g, P, side = 'R') {
  const h = side === 'R' ? P.handR : P.handL;
  if (h.dir === 'up') idol(g, Math.round(h.x) - 2, h.y - 7);
  else idol(g, h.x - 2, h.y0 - 6);
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
sc.frame(700, g => k.clawd(g, 'idle'));
// One cloud, a little right of centre, covers him and the pedestal.
m2.poofSwap(sc, g => k.clawd(g, 'idle'),
  g => { columns(g); him(g, 'idle'); pedestal(g); idol(g, 40, 20); },
  [[P0.centre.x + 2.5, P0.centre.y - 3]]);

// Eyes on the prize; snatch it; proud.
sc.frame(380, g => { columns(g); him(g, 'idle', { eyes: 'right' }); pedestal(g); idol(g, 40, 20); });
sc.frame(160, g => { columns(g); const P = him(g, 'point'); pedestal(g); held(g, P); k.sparkle(g, 46, 17, 2, C.glow); });
sc.frame(420, g => { columns(g); const P = him(g, 'turn', { eyes: 'happy' }); pedestal(g); held(g, P);
  k.sparkle(g, 36, 16, 2, C.glow); k.sparkle(g, 44, 15, 2, C.gold); });
// RUMBLE: dust falls, the room shakes.
sc.frame(140, g => { columns(g); const P = him(g, 'turn', { eyes: 'wide', dx: -1 }); pedestal(g); held(g, P); debris(g, 0); });
sc.frame(200, g => { columns(g); const P = him(g, 'turn', { eyes: 'left', dx: 1 }); pedestal(g); held(g, P); debris(g, 1);
  boulder(g, -6, 26, 0); });

// Loop, about 2 s: 18 frames. Run (two strides), a glance back and a trip
// (the boulder closes in, the hat pops off), a scramble, then a stride
// pulling away. The columns scroll 32 cells (two column gaps) per loop, the
// boulder turns three full crack-cycles, the stride is whole: seamless.
const RUN = k.CYCLES.walk.map(([p]) => p);
const plan = [];
for (let i = 0; i < 10; i++) plan.push({ pose: RUN[i % 5], speed: 2, dx: 3 });
plan[9].eyes = 'left';                                            // glance back
plan.push({ pose: 'squash', speed: 1, dx: 4, lift: 3, tilt: 1, ms: 150, eyes: 'closed', sweat: 0, splat: true });   // trip
plan.push({ pose: 'jump_recover', speed: 1, dx: 4, lift: 1, tilt: -1, ms: 130, eyes: 'wide', sweat: 2 }); // scramble
plan.push({ pose: 'walk_start', speed: 0, dx: 3, ms: 120, eyes: 'wide' });
for (let i = 0; i < 5; i++) plan.push({ pose: RUN[i], speed: 2, dx: 3 });
// The boulder: losing ground, then looming during the trip, then falling back.
const BX = [2, 2, 1, 1, 0, 0, -1, -1, -1, 0, 4, 7, 8, 7, 6, 5, 4, 3];
let s = 0;
sc.loopStart();
plan.forEach((f, i) => {
  const at = s;
  sc.frame(f.ms || 120, g => {
    columns(g, at);
    boulder(g, BX[i], 26, i);
    k.dust(g, BX[i] + 10, 36, i % 3, { c: C.tan, dir: 1 });
    const P = him(g, f.pose, { dx: f.dx, eyes: f.eyes || 'wide', lift: f.lift || 0, tilt: f.tilt || 0 });
    held(g, P);
    if (f.splat) k.dust(g, Math.round(P.centre.x), 36, 0, { c: C.tan });       // the stumble kicks up dust
    if (f.sweat !== undefined) m2.sweatDrop(g, P, { side: -1, drip: f.sweat });
    if (f.speed === 2) {
      const bx = P.head.x0 - 2;
      if (bx - 6 > BX[i] + 11) k.motionLines(g, bx, 23 + (i % 2), { dir: 'left', len: 3, count: 3, gap: 4, c: C.gray });
      k.dust(g, P.feetX[0] - 1, 36, i % 3, { c: C.tan, dir: -1 });
    }
  });
  s += f.speed;
});
sc.loopEnd();
if (s % SP) throw new Error(`boulder run: the columns scroll ${s}, not a multiple of ${SP}`);

// It rolls right over him. Hat flies.
const HAT = { c: C.brown, band: C.charcoal };
sc.frame(110, g => { columns(g); him(g, 'squash', { dx: 3, eyes: 'closed', hat: false }); boulder(g, 20, 26, 0);
  k.fedora(g, k.place('idle', { dy: -2, dx: 8 }), { ...HAT, tilt: 1 }); });
sc.frame(140, g => { columns(g); him(g, 'squash', { dx: 3, eyes: 'closed', hat: false }); boulder(g, 34, 26, 2);
  k.fedora(g, k.place('idle', { dy: -2, dx: 1 }), { ...HAT, tilt: -1 }); });
// Flat and dizzy, the hat lands on him; then back up, idol held high.
sc.frame(560, g => { columns(g); him(g, 'squash', { dx: 3, eyes: 'closed', tilt: 1 });
  for (const [x, y] of [[21, 17], [30, 16], [39, 17]]) k.sparkle(g, x, y, 2, C.gold); });
sc.frame(560, g => { columns(g); const P = him(g, 'turn', { dx: 3, eyes: 'happy' }); held(g, P);
  k.sparkle(g, 38, 16, 2, C.glow); k.sparkle(g, 45, 16, 2, C.gold); });

// Poof off (the temple goes with it).
m2.poofSwap(sc, g => { columns(g); const P = him(g, 'turn', { dx: 3 }); held(g, P); }, g => k.clawd(g, 'idle'),
  [[P0.centre.x + 2.5, P0.centre.y - 3]]);
m2.idleOutro(sc);

sc.finish();
