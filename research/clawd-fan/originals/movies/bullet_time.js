#!/usr/bin/env node
/**
 * "Bullet time": made for this fork, AI-drawn with the originals kit.
 * References the slow-motion rooftop dodge from a 1999 sci-fi film: tiny
 * black shades, a long black coat, green code falling behind, bullets
 * crawling past with ripples in the air. Caricature only, no likeness, no
 * logos.
 *
 * Story: idle → poof (coat, shades; green code rain behind) → a bullet comes
 * in → in slow motion he bends way back (knees forward, body sheared back
 * as one rigid block, the coat falling open and hanging to the floor) →
 * loop: slow frames, his arms wheel, the coat ripples, bullets crawl over
 * him trailing ripples, the code crawls → snaps back upright → poof → idle.
 *
 * The lean-back is the official idle pose rearranged (props_m1.leanBack):
 * whole rows slid sideways, plain torso rows taken out, arm nubs moved as
 * blocks, never a redrawn cell.
 *
 * Usage: node movies/bullet_time.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props_m1');
const { C, put } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-BulletTime.gif', name: 'bullet time', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The slow-motion bullet dodge from The Matrix (1999): tiny black shades, long black coat, the bend-back dodge, falling green code, bullets crawling past with ripples in the air.',
});

// ── Poses ────────────────────────────────────────────────────────────────────

// Bending back in three steps; the deepest one comes in four arm positions
// (the arms wheel slowly while he hangs there).
const LEAN_1 = m.leanBack('bt1', { lean: -4, knees: 1, drop: 0 });
const LEAN_2 = m.leanBack('bt2', { lean: -8, knees: 2, drop: 1, squash: 1, armL: [0, -1], armR: [0, -2] });
const ARMS = [[[0, 1], [0, -1]], [[0, 0], [0, -2]], [[0, -1], [0, -3]], [[0, -2], [0, -2]]];
const DEEP = ARMS.map(([armL, armR], i) => m.leanBack('bt3_' + i, { lean: -10, knees: 3, drop: 1, squash: 1, armL, armR }));

// ── Costume ──────────────────────────────────────────────────────────────────

// Upright: the trimmed coat (sleeves, narrow front panels, tails), shades.
const dressed = (g, P) => { m.trimCoat(g, P); m.tinyShades(g, P); };
const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: dressed });
// Leaning: the coat falls open and hangs to the floor behind him.
const leaning = (g, pose, flutter = 0) => k.clawd(g, pose, {
  under: (g2, P) => m.drape(g2, P, { flutter }),
  over: (g2, P) => { m.leanCoat(g2, P); m.tinyShades(g2, P); },
});

// ── Background ───────────────────────────────────────────────────────────────

// Falling code, tiled every 18 rows so any whole number of 18-row steps
// lands back where it started: phase p (cells) scrolls it down. Each column
// has its own streak length and offset; the glyph gaps stay put while the
// streaks slide through them, like the film's columns of lit characters.
const COLS = [];
{
  let s = 11;
  const rnd = (n) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s >> 16) % n; };
  for (let x = 2; x <= 51; x += 4) COLS.push({ x: x + rnd(2), len: 3 + rnd(5), off: rnd(18) });
}
function rain(g, p) {
  for (const { x, len, off } of COLS) {
    for (let y = 7; y <= 36; y++) {
      const d = (((p + off - y) % 18) + 18) % 18;       // 0 = the streak's head
      if (d >= len || ((y + x) % 3 === 2 && d > 0)) continue;
      put(g, x, y, d === 0 ? C.lime : d < 3 ? C.green : [0x1E, 0x5A, 0x2D]);
    }
  }
}

// Bullets crawling left over where his head was, 24 cells apart, 4 cells
// a frame: six frames bring the stream back where it started.
const LOOP = 6;
function bullets(g, f) {
  for (let b = 0; b < 3; b++) {
    const x = 38 + 24 * b - 4 * f - 24;
    if (x >= 1 && x <= 53) m.bullet(g, x, 20, { dir: -1, rings: 2 });
  }
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 3, ph);
let R = 0;                                    // rain phase
const step = (n) => (R += n);

// Idle bookend.
sc.frame(560, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));

// Poof on: coat and shades; the code starts falling (full speed).
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { rain(g, step(5)); him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { rain(g, step(5)); him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { rain(g, step(5)); him(g, 'idle'); puff(g, 3); });
sc.frame(420, g => { rain(g, step(5)); him(g, 'idle'); });

// A bullet comes in from the right at head height. Time slows: he bends
// way back, knees forward, the coat falling open.
sc.frame(200, g => { rain(g, step(5)); him(g, 'idle'); m.bullet(g, 52, 20, { dir: -1, rings: 0 }); });
sc.frame(200, g => { rain(g, step(3)); const P = leaning(g, LEAN_1); m.bullet(g, 48, 20, { dir: -1, rings: 1 }); k.motionLines(g, P.head.x1 + 2, P.head.top, { dir: 'right', len: 3, count: 2, gap: 2 }); });
sc.frame(280, g => { rain(g, step(2)); const P = leaning(g, LEAN_2, 1); m.bullet(g, 44, 20, { dir: -1, rings: 2 }); k.motionLines(g, P.head.x1 + 2, P.head.top, { dir: 'right', len: 4, count: 2, gap: 2 }); });

// Loop: slow motion. Arms wheel, the coat ripples, bullets and code crawl.
const ARM_SEQ = [0, 1, 2, 3, 2, 1];
const R0 = R + 2;
sc.loopStart();
for (let f = 0; f < LOOP; f++)
  sc.frame(280, g => { rain(g, R0 + 3 * f); leaning(g, DEEP[ARM_SEQ[f]], f % 3); bullets(g, f); });
sc.loopEnd();

// Snaps back upright at full speed, cool.
sc.frame(90, g => { rain(g, R0 + 16); leaning(g, LEAN_2); k.motionLines(g, 34, 22, { dir: 'right', len: 4, count: 2, gap: 3 }); });
sc.frame(90, g => { rain(g, R0 + 21); him(g, 'stretch', { dy: 3 }); k.motionLines(g, 14, 22, { dir: 'down', len: 4, count: 1 }); k.motionLines(g, 39, 22, { dir: 'down', len: 4, count: 1 }); });
sc.frame(300, g => { rain(g, R0 + 26); him(g, 'idle'); });
sc.frame(420, g => { rain(g, R0 + 31); const P = him(g, 'idle'); k.sparkle(g, P.eyeL.x - 1, P.eyeY, 2, C.ivory, C.ivory); });

// Poof off.
sc.frame(90, g => { rain(g, R0 + 36); him(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
