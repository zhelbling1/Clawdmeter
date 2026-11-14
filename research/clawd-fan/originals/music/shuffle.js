#!/usr/bin/env node
/**
 * "The 80s arm shuffle": made for this fork, AI-drawn with the originals
 * kit. References the famous late-80s music-video dance: a side-to-side
 * shuffle with bent arms swinging in time, delivered with total sincerity.
 * Costume: a tall ginger quiff and a belted trench coat. Caricature only,
 * no likeness, no lyrics, no title.
 *
 * Story: idle → poof (quiff, trench) → a tentative first shuffle → loop:
 * a committed shuffle, then an all-in one (bigger steps, bigger arms, eyes
 * shut, coat flying) → he finishes with a point and a ^‿^ → poof → idle.
 *
 * Usage: node music/shuffle.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props');
const { C } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-ArmShuffle.gif', name: 'arm shuffle', mood: 'active', headroom: 0,
  credit: m.CREDIT,
  references: 'The famous late-80s music-video dance: side-to-side shuffle with bent arms swinging in time; a ginger quiff and a trench coat.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

// Trench coat with the hands left orange (the last two columns of each sleeve).
function dressed(g, P) {
  k.trench(g, P, { long: 2 });
  for (const h of [P.handL, P.handR]) {
    if (!h || h.dir === 'up') continue;
    for (let y = h.y0; y <= h.y1; y++) for (const x of [h.x, h.x - h.dir]) if (P.at(x, y)) g.put(x, y, C.body);
  }
  k.quiff(g, P);
}
const him = (g, pose, o = {}) => k.clawd(g, pose, { ...o, over: dressed });

// ── The shuffle: arms bent, one forearm up, the other down, swapping each
// step; bigger each pass. ─────────────────────────────────────────────────────

const step = (id, up, down, o = {}) => m.derive('sh_' + id, 'idle', { armL: [0, -up], armR: [0, down], ...o });
const S = {
  small: step('s', 1, 1),
  mid:   step('m', 3, 2, { drop: 1, kick: { leg: 0, dx: -2 } }),
  big:   step('b', 4, 3, { drop: 1, lean: 3, block: 4, kick: { leg: 0, dx: -3, dy: -1 } }),
  rest:  m.derive('sh_rest', 'idle', { armL: [0, 1], armR: [0, 1] }),
};

// One pass: step left with the left arm up, through the middle, step right
// with the right arm up (the mirror), back through the middle.
function pass(pose, { reach, ms, eyes = null, extra = null }) {
  const beats = [[-reach, false], [0, null], [reach, true], [0, null]];
  beats.forEach(([dx, flip], i) => sc.frame(ms, g => {
    if (flip === null) him(g, S.rest, { dx: 0, eyes });
    else him(g, pose, { dx, flip, eyes });
    if (extra) extra(g, i, dx);
  }));
}

// ── Storyboard ───────────────────────────────────────────────────────────────

m.open(sc, g => him(g, 'idle'));

// Tentative: small steps, eyes open, checking nobody is looking.
sc.frame(200, g => him(g, 'idle', { eyes: 'left' }));
pass(S.small, { reach: 1, ms: 170 });

sc.loopStart();
// Committed.
pass(S.mid, { reach: 2, ms: 150, extra: (g, i) => { if (i === 0) k.note(g, 40, 14, C.gold); } });
// All in: eyes shut, coat flying, sparkles.
pass(S.big, { reach: 4, ms: 140, eyes: 'closed', extra: (g, i, dx) => {
  if (i === 0) { k.motionLines(g, 41 + dx, 24, { dir: 'right', len: 3, count: 2, gap: 3 }); k.sparkle(g, 8, 18, 2); }
  if (i === 2) { k.motionLines(g, 12 + dx, 24, { dir: 'left', len: 3, count: 2, gap: 3 }); k.sparkle(g, 45, 16, 3); }
  if (i === 1) k.note(g, 11, 13, C.sky, { flip: true });
} });
sc.loopEnd();

// The finish: a point to the crowd, then content.
sc.frame(140, g => him(g, 'point_1', { flip: false }));
sc.frame(460, g => { him(g, 'point_3', { eyes: 'happy' }); k.sparkle(g, 47, 21, 3); });
sc.frame(480, g => him(g, 'idle', { eyes: 'happy' }));

m.close(sc, g => him(g, 'idle'));

sc.finish();
