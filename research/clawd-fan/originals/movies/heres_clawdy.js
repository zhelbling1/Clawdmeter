#!/usr/bin/env node
/**
 * "Here's Clawdy!": made for this fork, AI-drawn with the originals kit.
 * References the axe-through-the-door scene from a 1980 hotel horror film,
 * played as pure cartoon: an axe chops a hole in a wooden door in three
 * hits, then a grinning face with messy hair and wild eyebrows pops through.
 * Caricature only, no likeness; the caption is a two-word pun, not the line.
 *
 * Story: idle → poof (messy hair, wild eyebrows) → a door slides in front of
 * him → CHOP, CHOP, CHOP: the blade bursts through, the hole grows, an eye
 * peeks → his head pops through: HERE'S CLAWDY! (loop: eyebrows waggle,
 * grin) → he ducks back, poof → idle.
 *
 * Usage: node movies/heres_clawdy.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, caption, stamp } = k;
const m2 = require('./props_m2');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-HeresClawdy.gif', name: "here's clawdy", mood: 'heavy', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: "The axe-through-the-door scene from The Shining (1980), as a cartoon: messy hair, wild eyebrows, a grin through a chopped hole. Caption is a pun on the line.",
});

// ── Props ────────────────────────────────────────────────────────────────────

const DX0 = 12, DX1 = 41, DY0 = 12;          // the door: x 12..41, y 12..36

// Jagged hole stages: cells (x, y) inside the hole.
function holeCells(stage) {
  if (!stage) return new Set();
  const [cx, cy, rx, ry] = [[0], [27, 21, 2.2, 1.6], [27, 22, 4.5, 3.4], [26.5, 23, 7.6, 6.4]][stage];
  const out = new Set();
  for (let y = DY0; y <= 36; y++) for (let x = DX0; x <= DX1; x++) {
    const a = Math.atan2(y - cy, x - cx);
    const jag = 1 + 0.22 * Math.sin(a * 5 + stage) + 0.12 * Math.cos(a * 9);
    if (Math.hypot((x - cx) / rx, (y - cy) / ry) < jag) out.add(x + ',' + y);
  }
  return out;
}
const HOLES = [0, 1, 2, 3].map(holeCells);

// The door: planks, frame, knob; `hole` cells are left open; dx slides it.
function door(g, { hole = 0, dx = 0 } = {}) {
  const H = HOLES[hole];
  for (let y = DY0; y <= 36; y++) for (let x = DX0; x <= DX1; x++) {
    const X = x + dx;
    if (H.has(x + ',' + y)) {
      // Splintered rim: tan cells where the hole meets wood.
      continue;
    }
    let c = C.brown;
    if (x === DX0 || x === DX1 || y === DY0) c = C.charcoal;              // frame
    else if ((x - DX0) % 6 === 0) c = C.amber;                          // plank seams
    else if (y === 20 || y === 31) c = C.amber;                          // cross rails
    g.put(X, y, c);
  }
  // Splinters round the hole.
  for (const key of H) {
    const [x, y] = key.split(',').map(Number);
    for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const kk = (x + u) + ',' + (y + v);
      if (!H.has(kk) && (x + y) % 3 === 0 && x + u > DX0 && x + u < DX1) g.put(x + u + dx, y + v, C.tan);
    }
  }
  rect(g, 36 + dx, 26, 37 + dx, 27, C.gold);                          // knob
}

// The axe blade bursting through, its edge at (x, y), pointing left.
function blade(g, x, y) {
  stamp(g, x, y - 3, [
    '..ss',
    '.sss',
    'ssss',
    'ssss',
    'ssss',
    '.sss',
    '..ss',
  ], { s: C.steel });
  for (let i = -3; i <= 3; i++) put(g, x + (Math.abs(i) === 3 ? 2 : Math.abs(i) === 2 ? 1 : 0), y + i, C.ivory);   // the edge
  // Chips flying.
  for (const [u, v] of [[-3, -4], [-4, 1], [-2, 5], [6, -4], [6, 4]]) put(g, x + u, y + v, C.tan);
}
const chop = (g, c = C.ivory) => caption(g, 'CHOP!', 27, 3, c, { align: 'center' });

// ── Costume ──────────────────────────────────────────────────────────────────

function face({ mood = 'up', grin = false } = {}) {
  return (g, P) => {
    m2.messyHair(g, P, { phase: mood === 'v' ? 1 : 0 });
    m2.brows(g, P, { mood });
    if (grin) m2.grin(g, P, { w: 8 });
  };
}
const him = (g, pose, opts = {}) => {
  const { mood, grin, ...rest } = opts;
  return k.clawd(g, pose, { ...rest, over: face({ mood, grin }) });
};

// His head pushed through the hole: draw only his head (and hair, brows,
// grin) on top of the door.
function popped(g, { eyes = 'wide', mood = 'up', dy = 0 } = {}) {
  const tmp = new k.Canvas(0);
  const P = him(tmp, 'idle', { eyes, mood, grin: true, dy });
  for (let y = 0; y <= 29 + dy; y++) for (let x = 15; x <= 38; x++) {
    const c = tmp.get(x, y);
    const arm = (x < 19 || x > 34) && y >= P.chin;
    if (c && !arm) g.put(x, y, c);
  }
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
m2.idleIntro(sc);
m2.poofSwap(sc, g => k.clawd(g, 'idle'), g => him(g, 'idle', { mood: 'v' }), [[P0.centre.x, P0.centre.y - 4]]);

// A wicked grin, eyebrows wiggle; then the door slides in front of him.
sc.frame(300, g => him(g, 'idle', { eyes: 'happy', mood: 'v', grin: true }));
sc.frame(200, g => him(g, 'idle', { eyes: 'happy', mood: 'arch', grin: true }));
sc.frame(110, g => { him(g, 'idle', { mood: 'v' }); door(g, { dx: 6 }); });
sc.frame(420, g => { him(g, 'idle', { mood: 'v' }); door(g); });

// CHOP, CHOP, CHOP: each hit leaves the hole bigger.
const behind = (g, eyes = null) => him(g, 'idle', { mood: 'v', eyes });
[[1, 27, 21], [2, 30, 24], [3, 24, 22]].forEach(([h, bx, by], i) => {
  sc.frame(120, g => { behind(g); door(g, { hole: h - 1 }); blade(g, bx, by); chop(g); });
  sc.frame(i === 2 ? 240 : 300, g => { behind(g, i === 2 ? 'right' : null); door(g, { hole: h }); });
});
// An eye peeks through... then his head pops through.
sc.frame(380, g => { behind(g, 'left'); door(g, { hole: 3 }); });

sc.loopStart();
const lines = (g) => { caption(g, "HERE'S", 27, 0, C.ivory, { align: 'center' }); caption(g, 'CLAWDY!', 27, 6, C.ivory, { align: 'center' }); };
[['open', 'up', 0], ['happy', 'up', -1], ['open', 'v', 0], ['happy', 'up', -1]].forEach(([eyes, mood, dy], i) =>
  sc.frame(i === 0 ? 260 : 200, g => { behind(g); door(g, { hole: 3 }); popped(g, { eyes, mood, dy }); lines(g); }));
sc.loopEnd();

// He ducks back behind the door, then everything poofs away.
sc.frame(260, g => { behind(g, 'happy'); door(g, { hole: 3 }); });
m2.poofSwap(sc, g => { behind(g); door(g, { hole: 3 }); }, g => k.clawd(g, 'idle'),
  [[P0.centre.x, P0.centre.y - 4], [26.5, 17, { scale: 0.7 }]]);
m2.idleOutro(sc);

sc.finish();
