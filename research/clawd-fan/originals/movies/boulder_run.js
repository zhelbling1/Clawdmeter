#!/usr/bin/env node
/**
 * "Boulder run": made for this fork, AI-drawn with the originals kit.
 * References the temple-escape opening of a 1981 adventure film: brown
 * fedora, leather jacket, satchel and coiled whip, a golden idol on a
 * pedestal, and the giant rolling boulder. Caricature only, no likeness, no
 * logos.
 *
 * Story: idle → poof (fedora, jacket, satchel, whip; a pedestal with an
 * idol) → he reaches out and snatches the idol, holds it up → RUMBLE, dust
 * falls, he looks left: a huge boulder → loop: he runs flat out in place,
 * the boulder rolling right behind him → it rolls right over him (slapstick
 * squash, hat flying) → he pops back up, idol still held high → poof → idle.
 *
 * Usage: node movies/boulder_run.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, disc, stamp } = k;
const m2 = require('./props_m2');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-BoulderRun.gif', name: 'boulder run', mood: 'heavy', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The rolling-boulder temple escape from Raiders of the Lost Ark (1981): brown fedora, leather jacket, satchel, whip, golden idol on a pedestal.',
});

// ── Props ────────────────────────────────────────────────────────────────────

function pedestal(g) {
  rect(g, 43, 28, 51, 28, C.steel);
  rect(g, 44, 29, 50, 36, C.slate);
  put(g, 46, 31, C.charcoal); put(g, 47, 32, C.charcoal); put(g, 48, 34, C.charcoal);
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

// The boulder: radius 10.5 at (cx, cy); phase 0..5 turns its cracks.
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

function debris(g, phase) {
  const pts = [[[12, 9], [30, 11], [41, 9], [22, 14]], [[13, 13], [31, 15], [42, 12], [21, 18]]][phase % 2];
  for (const [x, y] of pts) { put(g, x, y, C.tan); put(g, x + 1, y + 1, C.gray); }
}

// ── Costume ──────────────────────────────────────────────────────────────────

function outfit({ hat = true } = {}) {
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
    if (hat) k.fedora(g, P, { c: C.brown, band: C.charcoal });
    m2.armsOver(g, P);
  };
}
const him = (g, pose, opts = {}) => {
  const { hat, ...rest } = opts;
  return k.clawd(g, pose, { ...rest, over: [outfit({ hat })].concat(opts.over || []) });
};
// The idol in a hand: on top of a raised hand, or just above a side hand.
function held(g, P, side = 'R') {
  const h = side === 'R' ? P.handR : P.handL;
  if (h.dir === 'up') idol(g, Math.round(h.x) - 2, h.y - 7);
  else idol(g, h.x - 2, h.y0 - 6);
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
m2.idleIntro(sc);
m2.poofSwap(sc, g => k.clawd(g, 'idle'),
  g => { him(g, 'idle'); pedestal(g); idol(g, 45, 21); },
  [[P0.centre.x, P0.centre.y - 4], [47, 27, { scale: 0.6 }]]);

// Eyes on the prize; snatch it.
sc.frame(420, g => { him(g, 'point', { eyes: 'right' }); pedestal(g); idol(g, 45, 21); });
sc.frame(160, g => { const P = him(g, 'point_2'); pedestal(g); held(g, P); k.sparkle(g, 47, 19, 2, C.glow); });
// Holds it up, proud.
sc.frame(420, g => { const P = him(g, 'wave_2', { eyes: 'happy' }); pedestal(g); held(g, P); k.sparkle(g, 38, 12, 2, C.glow); });
// RUMBLE: dust falls, the room shakes, he looks left.
sc.frame(140, g => { const P = him(g, 'wave_2', { eyes: 'left', dx: -1 }); pedestal(g); held(g, P); debris(g, 0); });
sc.frame(200, g => { const P = him(g, 'wave_2', { eyes: 'wide', dx: 1 }); pedestal(g); held(g, P); debris(g, 1); });
// The boulder rolls in from the left.
sc.frame(200, g => { boulder(g, -6, 26, 0); const P = him(g, 'idle', { eyes: 'left' }); pedestal(g); held(g, P); });

// Loop: he runs flat out in place; the boulder looms right behind.
sc.loopStart();
const run = k.CYCLES.walk.map(([p]) => p);
run.forEach((p, i) => sc.frame(80, g => {
  boulder(g, [3, 4, 5, 4, 3][i], 26, i + 1);
  const P = him(g, p, { dx: 6, eyes: 'wide' });
  held(g, P);
  k.motionLines(g, 19, 22 + (i % 2), { dir: 'left', len: 3, count: 3, gap: 4, c: C.gray });
  k.dust(g, 24, 36, i % 3, { c: C.tan, dir: -1 });
}));
sc.loopEnd();

// It rolls right over him. Hat flies.
sc.frame(110, g => { boulder(g, 22, 26, 0); k.fedora(g, k.place('idle', { dy: -6, dx: 6 }), { c: C.brown, band: C.charcoal, tilt: 1 }); });
sc.frame(130, g => { him(g, 'squash', { eyes: 'closed', hat: false }); boulder(g, 44, 26, 2);
  k.fedora(g, k.place('idle', { dy: -6, dx: 2 }), { c: C.brown, band: C.charcoal, tilt: -1 }); });
// Flat, dizzy, then back on his feet with the idol still high.
sc.frame(520, g => { const P = him(g, 'squash', { eyes: 'closed', hat: false });
  for (const [x, y, s] of [[18, 19, 2], [27, 18, 2], [36, 19, 2]]) k.sparkle(g, x, y, s, C.gold);
  k.fedora(g, k.place('idle', { dy: -7 }), { c: C.brown, band: C.charcoal, tilt: 1 }); });
sc.frame(520, g => { const P = him(g, 'wave_2', { eyes: 'happy' }); held(g, P); k.sparkle(g, 38, 12, 2, C.glow); k.sparkle(g, 27, 12, 2, C.gold); });

// Poof off.
m2.poofSwap(sc, g => { const P = him(g, 'idle'); held(g, P); }, g => k.clawd(g, 'idle'),
  [[P0.centre.x, P0.centre.y - 4]]);
m2.idleOutro(sc);

sc.finish();
