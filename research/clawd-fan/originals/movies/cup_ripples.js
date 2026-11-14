#!/usr/bin/env node
/**
 * "Cup ripples": made for this fork, AI-drawn with the originals kit.
 * References the water-glass scene from a 1993 dinosaur-park film: a cup
 * of water on the dash shivers with rings at each distant thump, long before
 * anything is seen. Safari hat, denim shirt, red neckerchief. Caricature
 * only, no likeness, no logos, and the beast is never shown.
 *
 * Story: idle → poof (safari hat, shirt, a desk with a glass of water) →
 * he idles, looking away → THUMP: rings in the water → THUMP: he glances →
 * he slowly turns to the glass, eyes wide, a sweat drop (loop: thump, the
 * rings spread, the glass hops, the drop slides) → he looks at us: GULP →
 * poof → idle.
 *
 * Usage: node movies/cup_ripples.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, caption } = k;
const m2 = require('./props_m2');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-CupRipples.gif', name: 'cup ripples', mood: 'calm', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The rippling water glass from Jurassic Park (1993): safari hat, denim shirt, red neckerchief, rings in a cup at each distant footstep.',
});

// ── Props ────────────────────────────────────────────────────────────────────

function desk(g) {
  rect(g, 38, 30, 53, 30, C.brown);
  rect(g, 39, 31, 53, 31, C.tan);
  rect(g, 40, 32, 41, 36, C.brown);
  rect(g, 51, 32, 52, 36, C.brown);
}

// A glass of water seen from a little above: the surface is a 13×7
// ellipse over the glass body. ring: 0 calm, 1 a drop in the middle,
// 2 a small ring, 3 a wide ring (and a second small one). hop lifts it.
const GX = 40, SURF = ['....#####....', '..##.....##..', '.#.........#.', '#...........#',
  '.#.........#.', '..##.....##..', '....#####....'];
function ellipseRing(a, b) {
  const out = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 13; c++) {
    const d = Math.hypot((c - 6) / a, (r - 3) / b);
    if (Math.abs(d - 1) < 0.5 / Math.min(a, b) + 0.12) out.push([c, r]);
  }
  return out;
}
const RINGS = { 1: [[6, 3], [6, 2]], 2: ellipseRing(2.4, 1.2), 3: ellipseRing(4.6, 2.1).concat([[6, 3]]) };
function glass(g, { ring = 0, hop = 0 } = {}) {
  const y0 = 16 - hop;
  // Body: straight glass sides, water inside, a glint.
  for (let y = y0 + 3; y <= y0 + 13; y++) {
    rect(g, GX, y, GX + 12, y, C.blue);
    put(g, GX, y, C.steel); put(g, GX + 12, y, C.steel);
  }
  rect(g, GX + 1, y0 + 13, GX + 11, y0 + 13, C.steel);   // base
  rect(g, GX + 2, y0 + 8, GX + 2, y0 + 11, C.ivory);      // glint
  // Surface: water inside the rim.
  SURF.forEach((row, r) => {
    const a = row.indexOf('#'), b = row.lastIndexOf('#');
    [...row].forEach((ch, c) => {
      if (ch === '#') put(g, GX + c, y0 + r, C.steel);
      else if (c > a && c < b) put(g, GX + c, y0 + r, C.navy);
    });
  });
  for (const [c, r] of RINGS[ring] || []) if (SURF[r][c] === '.') put(g, GX + c, y0 + r, C.sky);
}

// Little shake marks beside the glass on a thump.
function shake(g) {
  for (const [x, y] of [[GX - 2, 18], [GX - 2, 20], [GX - 3, 19]]) put(g, x, y, C.gray);
}
function thump(g, big = false) {
  caption(g, 'THUMP', 40, 9, big ? C.ivory : C.gray, { align: 'center' });
}

// ── Costume ──────────────────────────────────────────────────────────────────

function dressed(g, P) {
  k.jacket(g, P, { c: C.blue, dark: C.navy, buttons: C.ivory });
  // Red neckerchief: a band under the chin with a point.
  const m = k.midCol(P);
  for (let x = m - 3; x <= m + 4; x++) k.onBody(g, P, x, P.chin, C.red);
  for (let x = m - 1; x <= m + 2; x++) k.onBody(g, P, x, P.chin + 1, C.red);
  k.onBody(g, P, m, P.chin + 2, C.red); k.onBody(g, P, m + 1, P.chin + 2, C.red);
  k.safariHat(g, P, { c: C.tan, band: C.brown });
}
const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: [dressed].concat(opts.over || []) });
const set = (g, o) => { desk(g); glass(g, o); };

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
m2.idleIntro(sc);
m2.poofSwap(sc, g => k.clawd(g, 'idle'), g => { him(g, 'idle'); set(g); },
  [[P0.centre.x, P0.centre.y - 4], [46, 24, { scale: 0.65 }]]);

// Calm. He looks the other way.
sc.frame(520, g => { him(g, 'idle', { eyes: 'left' }); set(g); });
// THUMP. Rings in the water; he doesn't notice.
sc.frame(110, g => { him(g, 'idle', { eyes: 'left' }); set(g, { ring: 1, hop: 1 }); shake(g); thump(g); });
sc.frame(130, g => { him(g, 'idle', { eyes: 'left' }); set(g, { ring: 2 }); });
sc.frame(160, g => { him(g, 'idle', { eyes: 'left' }); set(g, { ring: 3 }); });
sc.frame(420, g => { him(g, 'idle', { eyes: 'left' }); set(g); });
// THUMP. He glances.
sc.frame(110, g => { him(g, 'idle', { eyes: 'right' }); set(g, { ring: 1, hop: 1 }); shake(g); thump(g, true); });
sc.frame(130, g => { him(g, 'idle', { eyes: 'right' }); set(g, { ring: 2 }); });
sc.frame(160, g => { him(g, 'idle', { eyes: 'right' }); set(g, { ring: 3 }); });
// Slowly turns to the glass.
sc.frame(300, g => { him(g, 'turn_blink'); set(g); });
sc.frame(380, g => { const P = him(g, 'turn', { eyes: 'wide' }); set(g); m2.sweatDrop(g, P, { side: -1 }); });

// Loop: thump, rings spread, the drop slides down his head.
sc.loopStart();
sc.frame(110, g => { const P = him(g, 'turn', { eyes: 'wide' }); set(g, { ring: 1, hop: 1 }); shake(g); thump(g, true); m2.sweatDrop(g, P, { side: -1, drip: 0 }); });
sc.frame(140, g => { const P = him(g, 'turn', { eyes: 'wide' }); set(g, { ring: 2 }); m2.sweatDrop(g, P, { side: -1, drip: 1 }); });
sc.frame(170, g => { const P = him(g, 'turn', { eyes: 'wide' }); set(g, { ring: 3 }); m2.sweatDrop(g, P, { side: -1, drip: 2 }); });
sc.frame(420, g => { const P = him(g, 'turn', { eyes: 'wide' }); set(g); m2.sweatDrop(g, P, { side: -1, drip: 3 }); });
sc.loopEnd();

// He looks at us. GULP.
sc.frame(260, g => { const P = him(g, 'idle', { eyes: 'wide' }); set(g); m2.sweatDrop(g, P, { side: -1, drip: 1 }); });
sc.frame(560, g => { const P = him(g, 'crouch', { eyes: 'wide' }); set(g); m2.sweatDrop(g, P, { side: -1, drip: 1 });
  caption(g, 'GULP', 27, 9, C.ivory, { align: 'center' }); });
sc.frame(200, g => { him(g, 'idle', { eyes: 'closed' }); set(g); });

// Poof off.
m2.poofSwap(sc, g => { him(g, 'idle'); set(g); }, g => k.clawd(g, 'idle'),
  [[P0.centre.x, P0.centre.y - 4], [46, 24, { scale: 0.65 }]]);
m2.idleOutro(sc);

sc.finish();
