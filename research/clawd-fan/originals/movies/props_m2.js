/**
 * Shared bits for the movies2 scenes (opal, saber duel, cup ripples,
 * boulder run, king of the world, here's Clawdy). Lives beside the scenes
 * rather than in the kit, so the kit stays as reviewed.
 *
 *   bookends:  idleIntro(sc), poofSwap(sc, before, after, puffs), idleOutro(sc)
 *   hair:      curlyHair, floppyHair, shaggyHair, messyHair, brows
 *   face:      grin (a toothy cartoon grin under the eyes), eyesOnTop
 *   props:     saber (glowing laser sword), clash (spark burst), goldChain,
 *              sweatDrop, gull
 */
const k = require('../kit');
const { C, rect, line, put, stamp, disc } = k;

// ── Bookends (the briefcase / moonwalk timing) ───────────────────────────────

function idleIntro(sc, { first = 500 } = {}) {
  sc.frame(first, g => k.clawd(g, 'idle'));
  sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
  sc.frame(250, g => k.clawd(g, 'idle'));
}
function idleOutro(sc, ms = 400) { sc.frame(ms, g => k.clawd(g, 'idle')); }

// Four poof frames: phase 0 over `before`, phases 1-3 over `after` (the
// swap happens behind the full cloud). puffs: [[cx, cy, opts], ...].
function poofSwap(sc, before, after, puffs, ms = [90, 110, 100, 90]) {
  [0, 1, 2, 3].forEach(ph => sc.frame(ms[ph], g => {
    (ph === 0 ? before : after)(g);
    for (const [cx, cy, o] of puffs) k.poof(g, cx, cy, ph, o || {});
  }));
}

// Repaint his eye cells over anything drawn on top (light, glasses).
function eyesOnTop(g, P) { for (const [x, y, t] of P.cells) if (t === 'e') g.put(x, y, C.eye); }

// Raised arms go in front of hats and hair: repaint his cells above the
// head top (and beside it, for 'up' hands) after the costume.
function armsOver(g, P) {
  const cols = { o: C.body, s: C.shade, e: C.eye };
  for (const [x, y, t] of P.cells) if (y < P.head.top) g.put(x, y, cols[t]);
}

// ── Hair ─────────────────────────────────────────────────────────────────────

// Tight curls: a bumpy cap of 2×2 curls, curls hanging down the sides.
function curlyHair(g, P, { c = C.charcoal, hi = C.slate } = {}) {
  const [x0] = k.headSpan(P), t = P.head.top;
  // A cloud of curls; 'h' marks the little C-shaped highlights.
  const rows = [
    '...###..###..###..###...',
    '..##h##.#h##.#h##.##h#..',
    '.##h########h######h###.',
    '.#h###h###h####h###h###.',
    '###h##############h#####',
  ];
  stamp(g, x0 - 4, t - 5, rows, { '#': c, h: hi });
  // Side curls hang down beside the eyes, hugging the head.
  const side = ['###', 'h##', '##.', '#h.'];
  stamp(g, x0 - 3, t, side, { '#': c, h: hi });
  stamp(g, x0 + 16, t, side, { '#': c, h: hi }, { flip: true });
}

// Floppy middle-parted fringe, blown back by the wind. wind 0..2 streams
// the back strands; phase flutters their tips.
function floppyHair(g, P, { c = C.gold, dark = C.amber, wind = 0, phase = 0 } = {}) {
  const [x0, x1] = k.headSpan(P), t = P.head.top, b = k.backDir(P);
  const cx = Math.floor(P.head.cx);
  rect(g, x0 + 1, t - 3, x1 - 1, t - 3, c);
  rect(g, x0, t - 2, x1, t - 1, c);
  rect(g, x0 - 1, t, x1 + 1, t, c);
  put(g, cx, t - 2, dark); put(g, cx + 1, t - 1, dark);              // the parting
  // Curtains over the forehead, flopping toward each side.
  rect(g, x0, t + 1, x0 + 3, t + 1, c); rect(g, x1 - 3, t + 1, x1, t + 1, c);
  put(g, x0, t + 2, c); put(g, x1, t + 2, c);
  // Streaming strands behind.
  if (wind) {
    const bx = b < 0 ? x0 - 1 : x1 + 1;
    for (let i = 0; i < 3 + wind * 2; i++) {
      const y = t - 2 + Math.floor(i / 2) + ((i + phase) % 3 === 0 ? 1 : 0);
      put(g, bx + b * i, y, i % 3 === 2 ? dark : c);
      if (i < 2 + wind) put(g, bx + b * i, y + 2, c);
    }
  }
}

// Shaggy farm-boy mop: a full top with a ragged fringe of strands.
function shaggyHair(g, P, { c = C.gold, dark = C.brown } = {}) {
  const [x0] = k.headSpan(P), t = P.head.top;
  const rows = [
    '...##.#####.###.#...',
    '..###############d..',
    '.#################d.',
    '.#d#.##.#d.##.#.##d.',
    '.#..............#..#',
  ];
  stamp(g, x0 - 2, t - 3, rows, { '#': c, d: dark });
}

// Messy, wild hair (taller and more chaotic than the kit's `wild`).
function messyHair(g, P, { c = C.charcoal, hi = C.slate, phase = 0 } = {}) {
  const [x0] = k.headSpan(P), t = P.head.top;
  const rows = [
    ['#....#...#....#...#...', '.#...#....#..#....#..#'][phase % 2],
    '.##..##.##..###.##..#.',
    '..##################..',
    '.####################.',
    '##################h###',
    '#.##..............###.',
    '#..#...............#.#',
  ];
  stamp(g, x0 - 3, t - 5, rows, { '#': c, h: hi });
}

// Thick, wild eyebrows over the eyes (the two rows above them). mood:
// 'up' (raised high, manic), 'v' (inner ends down: wicked), 'arch'
// (outer ends down, inner up: worried / wiggling).
function brows(g, P, { c = C.charcoal, mood = 'up' } = {}) {
  const hi = P.eyeY - 2, lo = P.eyeY - 1;
  for (const [i, e] of P.eyes.entries()) {
    const inner = i === 0 ? [e.x + 1, e.x + 2] : [e.x - 1, e.x];
    const outer = i === 0 ? [e.x - 2, e.x] : [e.x + 1, e.x + 3];
    const yi = mood === 'v' ? lo : hi, yo = mood === 'arch' ? lo : hi;
    rect(g, outer[0], yo, outer[1], yo, c);
    rect(g, inner[0], yi, inner[1], yi, c);
  }
}

// A wide cartoon grin: ivory teeth with an ink outline, under the eyes.
function grin(g, P, { w = 8, teeth = C.ivory, ink = C.eye } = {}) {
  const cx = Math.floor(P.head.cx), y = P.eyeBottom + 2;
  const x0 = cx - w / 2 + 1, x1 = cx + w / 2;
  rect(g, x0, y, x1, y + 1, teeth);
  put(g, x0 - 1, y - 1, ink); put(g, x1 + 1, y - 1, ink);
  rect(g, x0, y + 2, x1, y + 2, ink);
  for (let x = x0 + 2; x < x1; x += 3) put(g, x, y + 1, ink);
}

// ── Props ────────────────────────────────────────────────────────────────────

/**
 * Laser sword held at (hx, hy) pointing at angle `deg` (0 = right, -90 =
 * up), blade `len` cells (0 = unlit). A white core, a glow cell either side,
 * a steel hilt with a dark grip behind the hand.
 */
function saber(g, hx, hy, deg, len, { glow = C.blue, core = C.ivory, hilt = C.steel, grip = C.charcoal } = {}) {
  const a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  const at = (t) => [Math.round(hx + dx * t), Math.round(hy + dy * t)];
  // Glow sides: perpendicular, rounded to a whole cell.
  // Glow on one side (the side facing up / outward), so the blade reads
  // as a bright core with a coloured halo rather than a striped stick.
  let px = Math.round(-dy * 1.2), py = Math.round(dx * 1.2);
  if (py > 0 || (py === 0 && px < 0)) { px = -px; py = -py; }
  if (!px && !py) py = -1;
  const pts = [];
  for (let t = 2; t <= len + 1; t += 0.5) pts.push(at(t));
  for (const [x, y] of pts) put(g, x + px, y + py, glow);
  if (len) { const [tx, ty] = at(len + 2); put(g, tx, ty, glow); }
  for (const [x, y] of pts) put(g, x, y, core);
  // Hilt: grip under the hand, steel emitter in front.
  const [ax, ay] = at(-1), [bx, by] = at(0), [cx, cy] = at(1);
  put(g, ax, ay, grip); put(g, bx, by, grip); put(g, cx, cy, hilt);
}

// The burst where two blades meet: a big sparkle and flying sparks.
function clash(g, x, y, phase = 0, { c = C.glow, core = C.ivory } = {}) {
  k.sparkle(g, x, y, phase === 0 ? 4 : 3, c, core);
  const sp = [[[-4, -3], [4, -2], [-3, 3], [5, 3]], [[-5, -1], [3, -4], [-2, 4], [4, 2]]][phase % 2];
  for (const [u, v] of sp) { put(g, x + u, y + v, c); if (phase === 0) put(g, x + u + Math.sign(u), y + v + Math.sign(v), core); }
}

// A gold chain hanging in a U from the shoulders, with a pendant.
function goldChain(g, P, { c = C.gold, pendant = C.gold } = {}) {
  const cx = Math.floor(P.head.cx), y = P.chin + 1;
  const pts = [[-5, 0], [-4, 1], [-3, 2], [-2, 3], [-1, 3], [0, 4], [1, 4], [2, 3], [3, 3], [4, 2], [5, 1], [6, 0]];
  for (const [u, v] of pts) k.onBody(g, P, cx + u, y + v, c);
  rect(g, cx, y + 5, cx + 1, y + 6, pendant);
}

// Sweat drop beside the head (side +1 right, -1 left); drip 0..2 slides it.
function sweatDrop(g, P, { side = -1, drip = 0, c = C.sky, hi = C.ivory } = {}) {
  const [x0, x1] = k.headSpan(P);
  const x = side < 0 ? x0 - 2 : x1 + 2, y = P.head.top + 1 + drip;
  put(g, x, y, c); rect(g, x - 1, y + 1, x + 1, y + 2, c); put(g, x, y + 3, c);
  put(g, x - 1, y + 1, hi);
}

// Seagull, wings 'up' | 'flat' | 'down', facing right unless flip.
function gull(g, x, y, wings = 'up', { c = C.ivory, wing = C.gray, beak = C.gold, flip = false } = {}) {
  const rows = {
    up:   ['#.....#', '.#...#.', '..#b#..', '...#...'],
    flat: ['.......', '##...##', '..#b#..', '...#...'],
    down: ['.......', '.......', '.##b##.', '#..#..#'],
  }[wings];
  stamp(g, x - 3, y - 2, rows, { '#': wing, b: c }, { flip });
  put(g, x + (flip ? -1 : 1), y, beak);
}

module.exports = {
  idleIntro, idleOutro, poofSwap, eyesOnTop, armsOver,
  curlyHair, floppyHair, shaggyHair, messyHair, brows, grin,
  saber, clash, goldChain, sweatDrop, gull,
};
