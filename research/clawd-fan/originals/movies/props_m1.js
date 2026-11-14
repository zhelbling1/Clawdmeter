/**
 * Props and costume pieces for the movies1 scenes (Zed's dead, bullet time,
 * thumbs up in lava, moon bike, bat country). Made for this fork, AI-drawn.
 * Kit-style: every function takes the canvas first, positions are stage
 * cells, colours default to the kit palette. Nothing here redraws Clawd:
 * costume pieces sit on top of the official pose, props around it.
 */
const k = require('../kit');
const { C, rect, line, put, disc, ring, stamp } = k;

// ── Layers ───────────────────────────────────────────────────────────────────

// Draw into a scratch canvas, then copy onto g through `map(x, y, colour)`
// (return a colour, or null to drop the cell). Used for the moon silhouette
// and for keeping props inside a column window.
function layer(g, draw, map = (x, y, c) => c) {
  const L = new k.Canvas(g.headroom);
  const out = draw(L);
  for (let y = L.top; y < k.STAGE_H; y++)
    for (let x = 0; x < k.W; x++) {
      const c = L.get(x, y);
      if (!c) continue;
      const m = map(x, y, c);
      if (m) g.put(x, y, m);
    }
  return out;
}
// Keep only columns x0..x1 (a tighter frame keeps the converted size down).
const clipX = (x0, x1) => (x, y, c) => (x >= x0 && x <= x1 ? c : null);

// ── Costume pieces ───────────────────────────────────────────────────────────

// Tiny oval shades: one dark lens over each eye (a cell wider on the outer
// side), a bridge on the top row, short arms to the head's edges.
function tinyShades(g, P, { c = C.charcoal, glint = C.slate } = {}) {
  const [eL, eR] = P.eyes, y = P.eyeY;
  rect(g, eL.x - 1, y, eL.x + 1, y + 1, c);
  rect(g, eR.x, y, eR.x + 2, y + 1, c);
  put(g, eL.x - 1, y, glint); put(g, eR.x, y, glint);
  rect(g, eL.x + 2, y, eR.x - 1, y, c);                     // bridge
}

// Long black coat worn open: sleeves and body charcoal, the front left
// open (his orange shows in a V and down the middle), slate lapels, and
// a skirt to his ankles split at the front.
function openCoat(g, P, { c = C.charcoal, lapel = C.slate, long = 3 } = {}) {
  const [x0, x1] = k.headSpan(P), mc = k.midCol(P);
  const y0 = P.chin + 1;                     // an orange neck row under the face
  const open = (x, y) => (y === y0 && x >= mc - 1 && x <= mc + 2) || (x >= mc && x <= mc + 1);
  const arm = (x, y) => x < x0 || x > x1 || y < P.head.top;
  k.recolour(g, P, (x, y) => y <= P.waist && (y >= y0 ? !open(x, y) : arm(x, y)), c, c);
  k.onBody(g, P, mc - 2, y0, lapel); k.onBody(g, P, mc - 1, y0 + 1, lapel);
  k.onBody(g, P, mc + 3, y0, lapel); k.onBody(g, P, mc + 2, y0 + 1, lapel);
  for (let i = 1; i <= long; i++) {
    const y = P.waist + i;
    if (y > 36) break;
    rect(g, x0 - (i === long ? 1 : 0), y, mc - 1, y, c);
    rect(g, mc + 2, y, x1 + (i === long ? 1 : 0), y, c);
  }
}

// Aviators with tinted glass: the eyes stay visible through amber lenses,
// gold rims across the top. Use with eyes: 'wide' for the stare.
function tintedAviators(g, P, { frame = C.gold, lens = C.amber } = {}) {
  // Lens boxes from the eye cells as drawn (eye variants change their size).
  const eyeCells = P.cells.filter(c => c[2] === 'e');
  const cx = P.head.cx;
  const boxes = [eyeCells.filter(c => c[0] < cx), eyeCells.filter(c => c[0] > cx)].map(cs => {
    const xs = cs.map(c => c[0]), ys = cs.map(c => c[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const y0 = Math.min(boxes[0].y0, boxes[1].y0), y1 = Math.max(boxes[0].y1, boxes[1].y1);
  for (const b of boxes) {
    const a = b.x0 - 1, z = Math.max(b.x1, b.x0 + 1) + 1;
    rect(g, a, y0 - 1, z, y0 - 1, frame);
    for (let y = y0; y <= y1 + 1; y++) for (let x = a; x <= z; x++) {
      if (y === y1 + 1 && (x === a || x === z)) continue;     // teardrop bottom
      if (P.at(x, y) !== 'e') put(g, x, y, lens);
    }
  }
  rect(g, Math.max(boxes[0].x1, boxes[0].x0 + 1) + 2, y0 - 1, boxes[1].x0 - 2, y0 - 1, frame);
}

// Hood up: the hoodie's hood over the top of his head and down the back of
// it, the face left open.
function hood(g, P, { c = C.red, dark = C.maroon } = {}) {
  const [x0, x1] = k.headSpan(P), t = P.head.top, b = k.backDir(P);
  rect(g, x0 + 1, t - 2, x1 - 1, t - 2, c);
  rect(g, x0, t - 1, x1, t - 1, c);
  rect(g, x0 + 1, t - 1, x1 - 1, t - 1, c);
  // the back of the hood falls to the shoulders on his back side
  const bx = b < 0 ? x0 - 1 : x1 + 1;
  rect(g, bx, t - 1, bx, P.chin, dark);
  rect(g, Math.min(bx, bx - 2 * b), t, Math.max(bx, bx - 2 * b), P.eyeY - 1, c);
  if (P.facing === 'front') { rect(g, x1 + 1, t - 1, x1 + 1, P.chin, dark); }
}
const hoodie = (g, P) => {
  k.jacket(g, P, { c: C.red, dark: C.maroon });
  hood(g, P);
  const m = k.midCol(P);
  for (let x = m - 3; x <= m + 4; x++) k.onBody(g, P, x, P.waist - 1, C.maroon);   // pocket seam
};

// Hawaiian shirt: a loud short-sleeved shirt, flowers scattered on it.
function hawaiian(g, P, { c = C.sky, flower = C.pink, centre = C.gold } = {}) {
  k.jacket(g, P, { c, dark: c, shirt: null });
  const m = k.midCol(P);
  for (let y = P.chin; y <= P.waist; y++) k.onBody(g, P, m + 1, y, C.ivory);   // button placket
  const spots = [[-6, 1], [-3, 4], [4, 2], [7, 5], [-8, 5], [2, 6], [-4, 0]];
  for (const [dx, dy] of spots) {
    const x = m + dx, y = P.chin + dy;
    if (y > P.waist) continue;
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) k.onBody(g, P, x + u, y + v, flower);
    k.onBody(g, P, x, y, centre);
  }
}

// Cigarette holder: a long thin holder from the face, angled up and out on
// the facing side, with a lit tip. Returns the tip cell (for smoke).
function cigHolder(g, P, { holder = C.charcoal, cig = C.ivory, ember = C.red } = {}) {
  const f = P.facing === 'left' ? -1 : 1;
  const x = f > 0 ? P.eyeR.x + 3 : P.eyeL.x - 2;
  const y = P.eyeBottom + 1;
  // holder: 5 cells rising one row per two cells
  const cells = [[0, 0], [1, 0], [2, -1], [3, -2], [4, -3]];
  for (const [u, v] of cells) put(g, x + f * u, y + v, holder);
  put(g, x + f * 5, y - 4, cig); put(g, x + f * 6, y - 5, cig);
  put(g, x + f * 7, y - 6, ember);
  return { x: x + f * 7, y: y - 6 };
}

// A cartoon glove over the raised fist, thumb sticking up: the thumbs-up.
// Works on 'wave_1' / 'wave_2' (hand raised, dir 'up'). cuff colours the
// row under the fist (the sleeve end).
function thumbsUp(g, P, { c = C.ivory, crease = C.gray, cuff = C.brown } = {}) {
  const h = P.handR;
  if (!h || h.dir !== 'up') return null;
  k.recolour(g, P, (x, y) => y >= h.y && y <= h.y + 2 && x >= h.x0 && x <= h.x1, c, c);
  rect(g, h.x0 + 1, h.y + 1, h.x1, h.y + 1, crease);           // curled fingers
  put(g, h.x1, h.y + 2, crease);
  rect(g, h.x0, h.y + 3, h.x1, h.y + 3, cuff);
  rect(g, h.x0, h.y - 3, h.x0 + 1, h.y - 1, c);               // the thumb
  return { x: h.x0, y: h.y - 3 };
}

// ── Vehicles ─────────────────────────────────────────────────────────────────

function wheel(g, cx, cy, r, { tire = C.charcoal, rim = C.slate, hub = C.steel, spin = 0 } = {}) {
  disc(g, cx, cy, r, tire);
  disc(g, cx, cy, Math.max(0.6, r - 1.6), rim);
  put(g, cx, cy, hub);
  if (r >= 3) {                                               // two spokes, turning
    const sp = [[[-1, 0], [1, 0]], [[0, -1], [0, 1]]][spin % 2];
    for (const [u, v] of sp) put(g, cx + u, cy + v, hub);
  }
}

/**
 * Chopper, facing right. (bx, by) shifts it; parts split so the rider sits
 * between them: chopperBack() before Clawd, chopperFront() after. The rider
 * is the 'point' pose at { dx: bx, dy: by - 4 }: seat under him, ape-hanger
 * grips at his hand (x 42+bx, y 20+by).
 */
function chopperBack(g, bx = 0, by = 0, { spin = 0 } = {}) {
  const X = (x) => x + bx, Y = (y) => y + by;
  wheel(g, X(12), Y(32), 4.4, { spin, rim: C.slate });       // fat rear tyre
  // Rear fender and sissy bar.
  line(g, X(7), Y(29), X(10), Y(27), C.red); rect(g, X(10), Y(27), X(15), Y(27), C.red);
  rect(g, X(9), Y(21), X(10), Y(28), C.steel);
  rect(g, X(9), Y(21), X(12), Y(21), C.steel);
  // Exhaust: two pipes under the seat, sweeping up behind the rear wheel.
  rect(g, X(17), Y(33), X(30), Y(33), C.steel);
  line(g, X(17), Y(33), X(5), Y(27), C.steel);
  line(g, X(17), Y(34), X(5), Y(28), C.slate);
  rect(g, X(17), Y(34), X(28), Y(34), C.slate);
}
function chopperFront(g, bx = 0, by = 0, { spin = 0 } = {}) {
  const X = (x) => x + bx, Y = (y) => y + by;
  // Seat and frame rail.
  rect(g, X(14), Y(29), X(31), Y(30), C.charcoal);
  rect(g, X(14), Y(29), X(20), Y(29), C.brown);              // leather seat
  line(g, X(13), Y(31), X(30), Y(31), C.charcoal);
  // V-twin engine.
  rect(g, X(27), Y(30), X(36), Y(33), C.slate);
  for (let x = 28; x <= 35; x += 2) rect(g, X(x), Y(30), X(x), Y(32), C.steel);
  rect(g, X(29), Y(33), X(34), Y(33), C.charcoal);
  // Teardrop tank.
  rect(g, X(35), Y(25), X(41), Y(28), C.red);
  rect(g, X(34), Y(26), X(34), Y(28), C.red);
  rect(g, X(36), Y(26), X(40), Y(26), C.gold);                // stripe
  put(g, X(42), Y(27), C.red);
  // Raked fork out to the front wheel, ape-hanger bars up to the grips.
  line(g, X(41), Y(25), X(48), Y(32), C.steel);
  line(g, X(42), Y(25), X(49), Y(32), C.steel);
  rect(g, X(43), Y(18), X(43), Y(25), C.steel);
  rect(g, X(42), Y(18), X(43), Y(18), C.steel);
  rect(g, X(42), Y(19), X(42), Y(19), C.charcoal);            // grip
  put(g, X(45), Y(24), C.glow); put(g, X(46), Y(24), C.glow);  // headlight
  rect(g, X(44), Y(23), X(46), Y(23), C.steel);
  wheel(g, X(49), Y(33), 3.4, { spin, rim: C.slate });
}

/**
 * BMX with a front basket, facing right. The rider is a walk pose at
 * { dx: bx, dy: by - 3 } (the walk cycle's legs pedal). Basket holds a
 * blanket bundle. All in one call (the frame sits over his legs).
 */
// A bicycle wheel: a tyre ring with spokes (the background shows through).
function spokeWheel(g, cx, cy, r, { tire = C.charcoal, spoke = C.steel, spin = 0 } = {}) {
  ring(g, cx, cy, r, tire);
  ring(g, cx, cy, r - 0.7, tire);
  const sp = spin % 2 ? [[1, 1], [-1, -1], [1, -1], [-1, 1], [2, 2], [-2, -2], [2, -2], [-2, 2]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  for (const [u, v] of sp) put(g, cx + u, cy + v, spoke);
  put(g, cx, cy, spoke);
}
function bikeBack(g, bx = 0, by = 0, { spin = 0 } = {}) {
  spokeWheel(g, 14 + bx, 32 + by, 4, { spin });
}
function bikeFront(g, bx = 0, by = 0, { spin = 0, crank = 0 } = {}) {
  const X = (x) => x + bx, Y = (y) => y + by;
  // Frame: seat post, top tube, down tube, chain stay.
  rect(g, X(19), Y(28), X(24), Y(28), C.charcoal);            // saddle
  line(g, X(22), Y(29), X(26), Y(33), C.steel);
  line(g, X(23), Y(29), X(39), Y(28), C.steel);
  line(g, X(26), Y(33), X(39), Y(29), C.steel);
  line(g, X(14), Y(32), X(26), Y(33), C.steel);
  // Crank and pedal (turns with the legs).
  const pd = [[0, -2], [2, 0], [0, 2], [-2, 0]][crank % 4];
  line(g, X(26), Y(33), X(26 + pd[0]), Y(33 + pd[1]), C.slate);
  rect(g, X(25 + pd[0]), Y(33 + pd[1]), X(27 + pd[0]), Y(33 + pd[1]), C.charcoal);
  // Fork, bars.
  line(g, X(39), Y(27), X(41), Y(32), C.steel);
  rect(g, X(38), Y(24), X(39), Y(27), C.steel);
  rect(g, X(36), Y(24), X(39), Y(24), C.charcoal);
  spokeWheel(g, X(41), Y(32), 4, { spin });
  // Basket on the front, a blanket bundle peeking out.
  rect(g, X(40), Y(23), X(46), Y(27), C.tan);
  for (let x = 40; x <= 46; x += 2) rect(g, X(x), Y(24), X(x), Y(27), C.brown);
  rect(g, X(40), Y(23), X(46), Y(23), C.brown);
  rect(g, X(41), Y(20), X(45), Y(22), C.ivory);
  rect(g, X(42), Y(19), X(44), Y(19), C.ivory);
  put(g, X(43), Y(21), C.steel);                              // a fold
}

/**
 * Red convertible, facing right, in side view. carBack() before the
 * driver (seat back), carFront() after (door, hood, windshield, wheels,
 * steering wheel at his hand). The driver is the 'point' pose at
 * { dx: bx - 3, dy: by - 4 } (sitting up tall, legs hidden in the car):
 * his hand meets the wheel rim at x 39+bx.
 */
function carBack(g, bx = 0, by = 0) {
  const X = (x) => x + bx, Y = (y) => y + by;
  rect(g, X(8), Y(19), X(10), Y(27), C.maroon);              // seat back
  rect(g, X(9), Y(18), X(10), Y(18), C.maroon);
}
function carFront(g, bx = 0, by = 0, { spin = 0 } = {}) {
  const X = (x) => x + bx, Y = (y) => y + by;
  // Body: long and low, a fin at the back.
  rect(g, X(3), Y(27), X(51), Y(32), C.red);
  rect(g, X(3), Y(25), X(6), Y(26), C.red);                   // tail fin
  put(g, X(3), Y(24), C.red);
  rect(g, X(3), Y(27), X(51), Y(27), C.maroon);               // the door top
  rect(g, X(4), Y(30), X(50), Y(30), C.ivory);                // chrome stripe
  put(g, X(51), Y(28), C.gold);                               // headlamp
  put(g, X(3), Y(28), C.gold);                                // tail light
  rect(g, X(31), Y(28), X(31), Y(31), C.maroon);              // door seam
  // Steering wheel (a ring seen edge-on) and the raked windshield.
  rect(g, X(40), Y(18), X(40), Y(24), C.charcoal);
  put(g, X(41), Y(18), C.charcoal); put(g, X(41), Y(24), C.charcoal);
  line(g, X(41), Y(26), X(41), Y(25), C.charcoal);            // column
  line(g, X(46), Y(26), X(43), Y(18), C.steel);
  line(g, X(47), Y(26), X(44), Y(18), C.steel);
  // Wheel arches and wheels.
  for (const cx of [13, 43]) disc(g, X(cx), Y(33), 4.6, null);
  wheel(g, X(13), Y(33), 3.5, { spin, rim: C.steel, hub: C.charcoal });
  wheel(g, X(43), Y(33), 3.5, { spin, rim: C.steel, hub: C.charcoal });
}

// The desert rolling by: tan floor from the horizon down, mesas on the
// horizon and pebbles drifting left with t.
function desert(g, t, { horizon = 29 } = {}) {
  rect(g, 2, horizon, 52, 36, C.tan);
  const mesas = [[2, 5, 6], [24, 7, 4], [42, 4, 7]];
  for (const [x, w, h] of mesas) {
    let mx = ((x - t) % 56 + 56) % 56 - 2;
    for (let i = 0; i < h; i++) rect(g, Math.max(2, mx - i), horizon - 1 - (h - 1 - i), Math.min(52, mx + w + i), horizon - 1 - (h - 1 - i), C.brown);
  }
  for (let i = 0; i < 9; i++) {
    const px = ((i * 13 + 7 - t * 4) % 52 + 52) % 52 + 1, py = horizon + 1 + (i * 5) % 7;
    put(g, px, py, C.brown);
  }
}

// ── Effects ──────────────────────────────────────────────────────────────────

// Exhaust puff: a small gray cloud; size 1..3.
function exhaust(g, x, y, size = 2, { c = C.gray, core = C.ivory } = {}) {
  if (size <= 1) { put(g, x, y, c); put(g, x - 1, y - 1, c); return; }
  disc(g, x, y, size - 0.4, c);
  if (size >= 3) disc(g, x + 0.4, y - 0.4, size - 1.6, core);
}

// Cartoon bat, 9 cells wide: wings up (phase 0) or down (phase 1), two
// gold eyes. (x, y) is the middle of its head row.
function bat(g, x, y, phase = 0, { c = C.purple, eye = C.gold } = {}) {
  const rows = phase === 0
    ? ['#..#.#..#', '##.###.##', '.#######.', '...###...']
    : ['...#.#...', '.#######.', '##.###.##', '#.......#'];
  stamp(g, x - 4, y - 1, rows, { '#': c });
  put(g, x - 1, y, eye); put(g, x + 1, y, eye);
}

// Falling code: `cols` columns of glyph streaks drifting down by `t`.
// Each streak: a bright head cell and a dim tail, gaps between characters.
function codeRain(g, t, { y0 = 6, y1 = 36, head = C.lime, tail = null, mid = C.green, seed = 7, x0 = 2, x1 = 52 } = {}) {
  tail = tail || [0x1E, 0x5A, 0x2D];
  let s = seed;
  const rnd = (n) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
  const H = y1 - y0 + 1;
  for (let x = x0; x <= x1; x += 3) {
    const speed = 2 + rnd(3), len = 6 + rnd(9), off = rnd(H + 12);
    const xo = x + (rnd(2));
    const hy = y0 + ((off + t * speed) % (H + len)) ;
    for (let i = 0; i < len; i++) {
      const y = hy - i;
      if (y < y0 || y > y1) continue;
      if ((y + xo) % 3 === 2 && i > 0) continue;               // gaps between glyphs
      put(g, xo, y, i === 0 ? head : i < 3 ? mid : tail);
    }
  }
}

// A bullet in flight with ripple rings left in the air behind it.
// dir +1 flies right. rings: how many trailing rings (older = bigger).
function bullet(g, x, y, { dir = 1, rings = 2, c = C.ivory, trail = C.gray, ripple = C.sky, old = C.slate, spacing = 6 } = {}) {
  const len = rings ? rings * spacing + 2 : 3;
  for (let i = 1; i <= len; i++) put(g, x - dir * i, y, i <= 1 ? c : trail);
  rect(g, x, y, x + dir, y, c);                                // the slug
  for (let r = 1; r <= rings; r++) {
    const cx = x - dir * (r * spacing - 2), h = r + 1;
    const col = r === 1 ? ripple : old;
    // a tall thin ring standing across the path
    for (let v = -h; v <= h; v++) {
      const u = Math.abs(v) === h ? 0 : 1;
      put(g, cx - u, y + v, col); put(g, cx + u, y + v, col);
    }
  }
}

// Lava pool from x0..x1, surface row `top`, down to the floor. phase 0..3
// moves the crust highlights; bubbles: [[x, size]] along the surface.
function lavaPool(g, top, phase = 0, { x0 = 4, x1 = 50 } = {}) {
  for (let y = top; y <= 36; y++) {
    const inset = y === top ? 2 : y === top + 1 ? 1 : 0;
    rect(g, x0 + inset, y, x1 - inset, y, y >= top + 3 ? C.maroon : C.red);
  }
  // rocky rim at both ends
  rect(g, x0 - 2, top + 1, x0 - 1, 36, C.charcoal); rect(g, x0, top, x0 + 1, top, C.charcoal);
  rect(g, x1 + 1, top + 1, x1 + 2, 36, C.charcoal); rect(g, x1 - 1, top, x1, top, C.charcoal);
  put(g, x0 - 1, top, C.slate); put(g, x1 + 1, top, C.slate);
  // glowing crust swirls
  for (let x = x0 + 3 + phase; x < x1 - 2; x += 7) {
    rect(g, x, top, x + 2, top, C.gold);
    put(g, x + 4, top + 2, C.amber); put(g, x + 5, top + 2, C.amber);
    put(g, x + 1, top + 4, C.red);
  }
}
// The surface line drawn over a sinking body (so he goes "into" it).
function lavaSurface(g, top, phase = 0, { x0 = 4, x1 = 50 } = {}) {
  for (let y = top; y <= 36; y++) for (let x = x0 + (y === top ? 2 : y === top + 1 ? 1 : 0); x <= x1 - (y === top ? 2 : y === top + 1 ? 1 : 0); x++)
    put(g, x, y, y >= top + 3 ? C.maroon : C.red);
  for (let x = x0 + 3 + phase; x < x1 - 2; x += 7) {
    rect(g, x, top, x + 2, top, C.gold);
    put(g, x + 4, top + 2, C.amber); put(g, x + 5, top + 2, C.amber);
  }
}
// A lava bubble on the surface: size 1 bead, 2 dome, 3 popping ring.
function lavaBubble(g, x, top, size = 2) {
  if (size === 1) { put(g, x, top - 1, C.gold); return; }
  if (size === 2) { rect(g, x - 1, top - 1, x + 1, top - 1, C.gold); rect(g, x - 2, top, x + 2, top, C.gold); put(g, x, top - 2, C.gold); put(g, x, top - 1, C.glow); return; }
  for (const [u, v] of [[-3, -1], [3, -1], [-2, -3], [2, -3], [0, -4], [-4, 0], [4, 0]]) put(g, x + u, top + v, C.gold);
  put(g, x, top - 1, C.glow);
}

// Full moon with soft craters.
function moon(g, cx, cy, r, { c = C.cream, crater = [0xD6, 0xCC, 0xA4], rim = null } = {}) {
  disc(g, cx, cy, r - 0.25, c);                               // (no single-cell nubs)
  for (const [u, v, rr] of [[-5, -4, 2.4], [4, 3, 3], [6, -6, 1.6], [-3, 6, 1.6], [-8, 2, 1.2], [1, -8, 1.2]])
    if (u * u + v * v < (r - rr) * (r - rr)) disc(g, cx + u * r / 14, cy + v * r / 14, rr * r / 14, crater);
  if (rim) ring(g, cx, cy, r, rim);
}

module.exports = {
  layer, clipX,
  tinyShades, openCoat, tintedAviators, hood, hoodie, hawaiian, cigHolder, thumbsUp,
  wheel, spokeWheel, chopperBack, chopperFront, bikeBack, bikeFront, carBack, carFront, desert,
  exhaust, bat, codeRain, bullet, lavaPool, lavaSurface, lavaBubble, moon,
};
