/**
 * Effects and small props: the poof, sparkles, motion lines, music notes,
 * light beams, dust. All take the canvas first; colours default to C.
 */
const { C, rect, line, disc, ring, stamp } = require('./canvas');

/**
 * poof(g, cx, cy, phase, opts): the smoke puff that puts a costume on or
 * takes it off. Phases: 0 burst, 1 full cloud (big enough to hide him from
 * the head to the knees, so swap the costume behind it), 2 breaking up,
 * 3 last wisps. (cx, cy) is the cloud centre: P.centre or a bit above.
 * opts: scale (1 = Clawd-sized, 0.6 = head-sized), c (puff), edge (shading)
 */
function poof(g, cx, cy, phase, { scale = 1, c = C.ivory, edge = C.gray } = {}) {
  const s = scale;
  const blob = (x, y, r) => { disc(g, cx + x * s, cy + y * s, r * s + 0.6, edge); disc(g, cx + x * s, cy + y * s - 0.6, r * s, c); };
  if (phase === 0) {
    blob(0, 0, 3.5);
    for (const [x, y] of [[-7, -3], [7, -3], [-6, 4], [6, 4], [0, -7]]) blob(x, y, 1.5);
  } else if (phase === 1) {
    for (const [x, y, r] of [[-9, 2, 5], [9, 2, 5], [-5, -5, 5.5], [5, -5, 5.5], [0, 4, 6], [0, -2, 6.5],
      [-12, -2, 3], [12, -2, 3], [-4, 8, 3.5], [5, 8, 3.5]]) blob(x, y, r);
  } else if (phase === 2) {
    for (const [x, y, r] of [[-12, 3, 3.5], [12, 3, 3.5], [-7, -8, 3.5], [7, -8, 3.5], [0, 9, 3], [-14, -4, 2], [14, -4, 2]])
      blob(x, y, r);
  } else {
    for (const [x, y] of [[-15, 4], [15, 4], [-9, -11], [9, -11], [0, 12], [-17, -5], [17, -5]]) {
      g.put(cx + x * s, cy + y * s, c); g.put(cx + x * s + 1, cy + y * s, edge);
    }
  }
}

// Four-point sparkle: size 1 dot, 2 plus, 3 long plus with a bright core.
function sparkle(g, x, y, size = 2, c = C.glow, core = C.ivory) {
  if (size <= 1) { g.put(x, y, c); return; }
  for (let k = 1; k <= size - 1; k++) { g.put(x - k, y, c); g.put(x + k, y, c); g.put(x, y - k, c); g.put(x, y + k, c); }
  g.put(x, y, size >= 3 ? core : c);
}

// Speed lines trailing behind a moving thing: `count` lines of `len`
// cells, stacked `gap` rows apart, starting at (x, y) and running away in
// `dir` ('left' | 'right' | 'up' | 'down'). Lines are staggered so they read
// as motion, not a fence.
function motionLines(g, x, y, { dir = 'left', len = 4, count = 3, gap = 2, c = C.gray } = {}) {
  for (let i = 0; i < count; i++) {
    const st = (i % 2) * 2, l = len - (i % 2);
    if (dir === 'left' || dir === 'right') {
      const s = dir === 'left' ? -1 : 1;
      line(g, x + s * st, y + i * gap, x + s * (st + l - 1), y + i * gap, c);
    } else {
      const s = dir === 'up' ? -1 : 1;
      line(g, x + i * gap, y + s * st, x + i * gap, y + s * (st + l - 1), c);
    }
  }
}

// Music note (eighth note), 3×4, (x, y) its top-left. flip mirrors it.
function note(g, x, y, c = C.ivory, { flip = false, double = false } = {}) {
  const rows = double ? ['####', '#..#', '#..#', '#.##', '##..'] : ['.##', '.#.', '.#.', '##.'];
  stamp(g, x, y, rows, { '#': c }, { flip });
}

// A beam of light from `from` [x, y] widening to the segment `to0`..`to1`,
// drawn as rays (every `step` cells along the far edge). solid fills it.
function beam(g, from, to0, to1, c = C.glow, { step = 2, solid = false } = {}) {
  const n = Math.max(Math.abs(to1[0] - to0[0]), Math.abs(to1[1] - to0[1]));
  for (let i = 0; i <= n; i += solid ? 1 : step) {
    const t = n ? i / n : 0;
    line(g, from[0], from[1], Math.round(to0[0] + (to1[0] - to0[0]) * t), Math.round(to0[1] + (to1[1] - to0[1]) * t), c);
  }
}

// Dust kicked up at the feet (landing, sliding). phase 0..2 spreads it.
function dust(g, x, y, phase = 0, { c = C.gray, dir = 0 } = {}) {
  const o = phase + 1;
  for (const s of dir ? [dir] : [-1, 1]) {
    g.put(x + s * (1 + o), y, c);
    g.put(x + s * (2 + o), y - 1, c);
    if (phase < 2) g.put(x + s * (3 + o), y, c);
  }
}

// Exclamation mark over a head (the classic "!" alert), 2 cells wide.
function exclaim(g, x, y, c = C.red) { rect(g, x, y, x + 1, y + 3, c); rect(g, x, y + 5, x + 1, y + 5, c); }

module.exports = { poof, sparkle, motionLines, note, beam, dust, exclaim };
