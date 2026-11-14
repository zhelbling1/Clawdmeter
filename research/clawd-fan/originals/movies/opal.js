#!/usr/bin/env node
/**
 * "The opal": made for this fork, AI-drawn with the originals kit.
 * References the black-opal scene from a 2019 crime thriller: tight curls,
 * glasses, a gold chain, a dark rough stone held up to a lamp until a tiny
 * galaxy of colour swirls inside it. Caricature only, no likeness, no quote.
 *
 * Story: idle → poof (curls, glasses, chain; a hanging lamp) → he eyes the
 * stone in his hand, lifts it overhead into the lamplight → the colours
 * bloom, his eyes go wide (loop: the galaxy swirls, colour flecks dance on
 * his face) → he lowers it, blissful → poof → idle.
 *
 * Usage: node movies/opal.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put } = k;
const m2 = require('./props_m2');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-Opal.gif', name: 'the opal', mood: 'calm', headroom: 2,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The black opal from Uncut Gems (2019): tight curls, glasses, gold chain, a rough stone held up to the light with a galaxy of colour inside.',
});

// ── Props ────────────────────────────────────────────────────────────────────

// Hanging lamp over his spot. on: rays of light fall from the bulb.
function lamp(g, { on = true, flicker = 0 } = {}) {
  rect(g, 26, -2, 26, 0, C.slate);                        // cord
  rect(g, 25, 1, 28, 1, C.charcoal);                      // shade
  rect(g, 24, 2, 29, 2, C.charcoal);
  rect(g, 23, 3, 30, 3, C.charcoal);
  put(g, 24, 2, C.slate); put(g, 23, 3, C.slate);
  rect(g, 26, 4, 27, 4, on ? C.glow : C.gray);            // bulb
  if (on) {
    // A cone of light: dotted edges and a glow under the bulb.
    for (let i = 1; i <= 5; i += 2) { put(g, 23 - i, 3 + i, C.glow); put(g, 30 + i, 3 + i, C.glow); }
    rect(g, 25, 5, 28, 5, C.glow);
    put(g, 26, 7 - flicker, C.glow); put(g, 27, 7 - flicker, C.glow);
  }
}

// The stone: an 8×6 rounded lump, its top-left at (x, y). level 0 dull,
// 1 waking, 2 full galaxy; phase 0..3 turns the swirl.
const GEM_ROWS = ['..####..', '.######.', '########', '########', '.######.', '..####..'];
function opal(g, x, y, level = 0, phase = 0) {
  const inside = (c, r) => GEM_ROWS[r] && GEM_ROWS[r][c] === '#';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
    if (!inside(c, r)) continue;
    const edge = !inside(c - 1, r) || !inside(c + 1, r) || !inside(c, r - 1) || !inside(c, r + 1);
    let col = edge ? C.charcoal : C.navy;
    if (!edge) {
      const u = c - 3.5, v = (r - 2.5) * 1.4, rad = Math.hypot(u, v);
      const ang = Math.atan2(v, u) / (2 * Math.PI) + 0.5;            // 0..1
      const s = ((ang * 2 + rad * 0.28 - phase / 4) % 1 + 1) % 1;    // two spiral arms
      const bands = [C.blue, C.sky, C.navy, C.green, C.pink, C.purple, C.navy, C.blue];
      if (level === 2) col = rad < 0.9 ? (phase % 2 ? C.ivory : C.glow) : bands[Math.floor(s * bands.length)];
      else if (level === 1) col = (Math.floor(s * 4) === 1) ? C.purple : rad < 0.9 ? C.sky : C.navy;
      else col = (c === 4 && r === 2) ? C.purple : C.navy;
    }
    put(g, x + c, y + r, col);
  }
  if (level) put(g, x + 2, y, C.slate);                   // a dull glint on the rim
}

// Colour flecks the stone throws: a few cells around it, and on his face.
function flecks(g, P, gx, gy, phase) {
  const cols = [C.pink, C.sky, C.green, C.purple];
  const around = [[[-3, 1], [10, 2], [1, -2], [9, -1]], [[-2, 4], [10, 5], [-1, -1], [7, -3]],
    [[-3, 2], [11, 0], [3, -3], [9, 4]], [[-2, -1], [10, 3], [0, 5], [6, -2]]][phase % 4];
  around.forEach(([u, v], i) => put(g, gx + u, gy + v, cols[(i + phase) % 4]));
  // On his face (only where he is), never over the eyes.
  const face = [[[19, 27], [33, 26], [25, 28]], [[22, 27], [31, 28], [28, 26]],
    [[20, 26], [34, 27], [26, 29]], [[23, 28], [30, 26], [27, 27]]][phase % 4];
  face.forEach(([fx, fy], i) => { if (P.at(fx, fy) === 'o') put(g, fx, fy, cols[(i + phase + 1) % 4]); });
}

// ── Costume ──────────────────────────────────────────────────────────────────

function glasses(g, P) {
  k.roundGlasses(g, P, { c: C.gray });
  m2.eyesOnTop(g, P);                                     // wide eyes bulge past the rims
}
const dressed = (g, P) => { m2.goldChain(g, P); m2.curlyHair(g, P); m2.armsOver(g, P); glasses(g, P); };
const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: [dressed].concat(opts.over || []) });

// Where the stone sits per pose (top-left of the 8×6 lump).
const AT = { idle: [35, 20], crouch: [35, 22], arms_up_wide: [32, 12], arms_up: [23, 10] };

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const set = (g, on = true) => lamp(g, { on });
m2.idleIntro(sc);

// Poof on: the costume, the stone in his hand, the lamp in a small puff.
m2.poofSwap(sc, g => k.clawd(g, 'idle'),
  g => { him(g, 'idle'); set(g); opal(g, ...AT.idle); },
  [[P0.centre.x, P0.centre.y - 3], [26.5, 3, { scale: 0.45 }]]);

// He eyes the stone, crouches, and lifts it up into the light.
sc.frame(420, g => { set(g); him(g, 'idle', { eyes: 'right' }); opal(g, ...AT.idle); });
sc.frame(160, g => { set(g); him(g, 'crouch', { eyes: 'right' }); opal(g, ...AT.crouch); });
sc.frame(140, g => { set(g); him(g, 'arms_up_wide', { eyes: 'up' }); opal(g, ...AT.arms_up_wide); });
sc.frame(300, g => { set(g); him(g, 'arms_up'); opal(g, ...AT.arms_up); });
// It wakes in the lamplight.
sc.frame(200, g => { set(g); him(g, 'arms_up'); opal(g, ...AT.arms_up, 1, 0); });
sc.frame(180, g => { set(g); him(g, 'arms_up', { eyes: 'wide' }); opal(g, ...AT.arms_up, 2, 0);
  k.sparkle(g, 31, 9, 3, C.glow); });

// Loop: the galaxy swirls, flecks of colour dance on his face.
sc.loopStart();
for (let ph = 0; ph < 4; ph++) sc.frame(170, g => {
  set(g);
  const P = him(g, 'arms_up', { eyes: ph === 3 ? 'happy' : 'wide' });
  opal(g, ...AT.arms_up, 2, ph);
  flecks(g, P, ...AT.arms_up, ph);
  if (ph % 2 === 0) k.sparkle(g, ph ? 22 : 32, ph ? 11 : 9, 2, C.glow);
});
sc.loopEnd();

// He lowers it, blissful; it dims back to a dark stone.
sc.frame(240, g => { set(g); him(g, 'arms_up', { eyes: 'happy' }); opal(g, ...AT.arms_up, 1, 1); });
sc.frame(180, g => { set(g); him(g, 'arms_up_wide', { eyes: 'happy' }); opal(g, ...AT.arms_up_wide, 1, 2); });
sc.frame(520, g => { set(g); him(g, 'idle', { eyes: 'happy' }); opal(g, ...AT.idle); k.sparkle(g, 40, 17, 2, C.pink); });

// Poof off.
m2.poofSwap(sc, g => { him(g, 'idle'); set(g); opal(g, ...AT.idle); },
  g => k.clawd(g, 'idle'),
  [[P0.centre.x, P0.centre.y - 3], [26.5, 3, { scale: 0.45 }]]);
m2.idleOutro(sc);

sc.finish();
