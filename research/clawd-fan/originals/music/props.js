/**
 * Shared pieces for the dance scenes in this folder (music/): dance poses
 * built from official cells, costume layers the kit doesn't have, and the
 * poof-on / poof-off bookends every scene shares.
 *
 * Dance poses (derive): every cell still comes from an official frame. A
 * derived pose only rearranges whole official pieces: the arm nubs move as
 * 4×4 blocks (or come from another official frame), the head block stays
 * rigid (eyes untouched), the body leans by sliding whole rows sideways, a
 * leg swings out row by row, and a knee bend drops the body and hides the
 * top leg rows (as the official dancing frames do). The result
 * is registered as a synthetic clip so the kit's place() / clawd() and all
 * costume anchors work on it unchanged.
 */
const k = require('../kit');
const { C, rect, disc, ring } = k;
const { data, pose } = k;

// ── Derived poses ────────────────────────────────────────────────────────────

const CLIP = 'musicmix';
data.clips[CLIP] = data.clips[CLIP] || { file: '(derived in music/props.js)', frames: [] };
const made = new Map();

// Arm-nub cells of a pose: everything beside the head span between the chin
// and the waist, plus anything above the head top (a raised arm).
function armCells(P, side) {
  const a = P.anchors, [x0, x1] = [a.head.x0, a.head.x1];
  return P.cells.filter(([x, y]) => {
    if (y < a.head.top) return side < 0 ? x <= a.head.cx : x > a.head.cx;
    if (y >= a.legTop) return false;
    return side < 0 ? x < x0 : x > x1;
  });
}

/**
 * derive(id, base, ops) -> pose name usable anywhere a pose name is.
 *   base       official pose name
 *   armL/armR  [dx, dy] move that arm nub (screen side), or 'hide' to tuck it
 *   copyArm    [{ side, dx, dy }] stamp an extra copy of an arm nub
 *   graft      [{ pose, side, dx?, dy? }] swap in that official pose's arm
 *   drop       n rows of knee bend: body down n, top n leg rows hidden
 *   lean       head-block shift in cells; the torso rows step from there to
 *              `hips` at the waist (block: n keeps the top n torso rows with
 *              the head, then one step). Negative leans left.
 *   hips       shift of the leg rows (knees forward against a lean)
 *   kick       { leg: 0..3 (left to right), dx, dy } swing one leg from
 *              the hip: its shift grows to dx at the foot, dy lifts it
 */
function derive(id, base, ops = {}) {
  if (made.has(id)) return made.get(id);
  const P = pose(base), a = P.anchors;
  const L = new Set(armCells(P, -1).map(([x, y]) => x + ',' + y));
  const R = new Set(armCells(P, 1).map(([x, y]) => x + ',' + y));
  let cells = [];
  const legX = [...new Set(P.cells.filter(([, y]) => y === a.feet).map(c => c[0]))].sort((u, v) => u - v);
  // Leg columns: pairs of feet-row columns.
  const legs = [];
  for (const x of legX) { const l = legs[legs.length - 1]; if (l && x - l[l.length - 1] <= 1) l.push(x); else legs.push([x]); }
  for (const [x, y, t] of P.cells) {
    const key = x + ',' + y;
    const side = L.has(key) ? 'L' : R.has(key) ? 'R' : null;
    let nx = x, ny = y;
    if (side) {
      const m = ops['arm' + side];
      if (m === 'hide') continue;
      if (m) { nx += m[0]; ny += m[1]; }
    }
    // Legs: kick one leg column.
    if (y >= a.legTop && ops.kick) {
      const leg = legs[ops.kick.leg];
      if (leg && x >= leg[0] - 1 && x <= leg[leg.length - 1] + 1) {
        // The leg swings from the hip: the shift grows toward the foot.
        const f = (y - a.legTop + 1) / (a.feet - a.legTop + 1);
        nx += Math.round((ops.kick.dx || 0) * f); ny += ops.kick.dy || 0;
      }
    }
    cells.push([nx, ny, t, y >= a.legTop ? 'leg' : side ? 'arm' : 'body', side]);
  }
  // Graft an arm nub from another official pose (e.g. the pointing arm onto
  // a walking body), aligned by head centre and top unless dx / dy given.
  for (const gr of ops.graft || []) {
    const G = pose(gr.pose), ga = G.anchors;
    const ox = gr.dx ?? Math.round(a.head.cx - ga.head.cx), oy = gr.dy ?? (a.head.top - ga.head.top);
    const sd = gr.side < 0 ? 'L' : 'R';
    cells = cells.filter(c => !(c[3] === 'arm' && c[4] === sd));
    for (const [x, y, t] of armCells(G, gr.side)) cells.push([x + ox, y + oy, t, 'arm', sd]);
  }
  for (const c of ops.copyArm || []) {
    const src = c.side < 0 ? armCells(P, -1) : armCells(P, 1);
    for (const [x, y, t] of src) cells.push([x + (c.dx || 0), y + (c.dy || 0), t, 'arm', 'C' + (c.side < 0 ? 'L' : 'R')]);
  }
  // Knee bend.
  const drop = ops.drop || 0;
  if (drop) {
    cells = cells.filter(([, y, , part]) => !(part === 'leg' && y < a.legTop + drop));
    cells = cells.map(([x, y, t, part, side]) => [x, part === 'leg' ? y : y + drop, t, part, side]);
  }
  // Lean: the head block slides rigidly by `lean`, the torso rows step
  // from there down to `hips` at the waist, the legs slide by `hips`, and
  // each arm nub stays rigid with the row it hangs from.
  const lean = ops.lean || 0, hips = ops.hips || 0;
  if (lean || hips) {
    const chin = a.chin + drop, waist = a.waist + drop;
    const blk = ops.block;   // block lean: shoulders move with the head, one step to the hips
    const shift = (y) => y < chin ? lean : y > waist ? hips
      : blk ? (y < chin + blk ? lean : Math.round((lean + hips) / 2))
      : Math.round(lean + (hips - lean) * (y - chin + 1) / (waist - chin + 2));
    const armRow = {};
    for (const [, y, , part, side] of cells) if (part === 'arm') armRow[side] = Math.min(armRow[side] ?? 99, y);
    cells = cells.map(([x, y, t, part, side]) => [x + (part === 'leg' ? hips : part === 'arm' ? shift(armRow[side]) : shift(y)), y, t, part, side]);
  }
  // Rasterise (body wins over a moved arm that overlaps it).
  const at = new Map();
  for (const [x, y, t] of cells) {
    const k2 = x + ',' + y, old = at.get(k2);
    if (old === 'e') continue;
    if (t === 'e' || !old || (old === 's' && t === 'o')) at.set(k2, t);
  }
  const xs = [...at.keys()].map(s => +s.split(',')[0]), ys = [...at.keys()].map(s => +s.split(',')[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const rows = [];
  for (let y = y0; y <= y1; y++) { let s = ''; for (let x = x0; x <= x1; x++) s += at.get(x + ',' + y) || '.'; rows.push(s); }
  const n = 1000 + made.size;
  data.clips[CLIP].frames.push({ src: [n], ms: 100, x: x0, y: y0, rows });
  const name = `${CLIP}:${n}`;
  made.set(id, name);
  // Body-part rows the analyser can't see through a lean: take them from the
  // base pose (plus the knee bend).
  const p = k.frame(CLIP, n), an = p.anchors;
  if (ops.lean || ops.hips || drop) {
    an.legTop = a.legTop + drop; an.waist = an.legTop - 1;
    an.chin = Math.max(an.chin, a.chin + drop);
  }
  // Hands: the moved nubs themselves (handL / handR as the kit shapes them:
  // dir 'up' when the nub is above the head top, else -1 / +1 outward).
  for (const sd of ['L', 'R']) {
    const arm = cells.filter(c => c[3] === 'arm' && c[4] === sd);
    if (!arm.length) { an['hand' + sd] = null; continue; }
    const ax = arm.map(c => c[0]), ay = arm.map(c => c[1]);
    const hx0 = Math.min(...ax), hx1 = Math.max(...ax), hy0 = Math.min(...ay), hy1 = Math.max(...ay);
    an['hand' + sd] = hy1 < an.head.top
      ? { x: (hx0 + hx1) / 2, y: hy0, x0: hx0, x1: hx1, y0: hy0, y1: hy1, dir: 'up' }
      : { x: sd === 'L' ? hx0 : hx1, y: Math.round((hy0 + hy1) / 2), y0: hy0, y1: hy1, dir: sd === 'L' ? -1 : 1 };
  }
  return name;
}

// ── Costume pieces ───────────────────────────────────────────────────────────

const { headSpan, backDir, midCol, recolour, onBody } = k;

// Fitted cap worn backwards: snug dome, the brim sticking out over the nape
// (side -1 = brim to screen left), a button on top and the strap gap in front.
function capBack(g, P, { c = C.red, dark = C.maroon, brim = C.charcoal, side = -1, button = C.ivory } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top;
  rect(g, x0 + 3, t - 3, x1 - 3, t - 3, c);
  rect(g, x0 + 1, t - 2, x1 - 1, t - 1, c);
  rect(g, x0, t, x1, t, c);
  rect(g, x0 + 1, t - 1, x1 - 1, t - 1, c);
  // Panel seams.
  const cx = Math.floor(P.head.cx);
  g.put(cx - 3, t - 2, dark); g.put(cx + 4, t - 2, dark);
  rect(g, cx, t - 4, cx + 1, t - 4, button);
  // Strap gap: the cap's back faces us, a little opening above the band.
  rect(g, cx, t - 1, cx + 1, t - 1, dark);
  rect(g, x0, t, x1, t, dark);                     // band
  if (brim) capBrim(g, P, { brim, side });
}
// The brim over the nape, sticking out the side (draw it UNDER the pose so
// a raised hand passes in front of it).
function capBrim(g, P, { brim = C.charcoal, side = -1 } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top;
  if (side < 0) rect(g, x0 - 4, t - 1, x0 - 1, t, brim);
  else rect(g, x1 + 1, t - 1, x1 + 4, t, brim);
}

// Flat-brim cap worn forward and cocked: snug dome, a dead-straight brim
// sticking out the front (side 1 = screen right), a sticker on the brim.
function flatBrim(g, P, { c = C.pink, brim = C.pink, sticker = C.gold, side = 1, button = C.ivory } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top, cx = Math.floor(P.head.cx);
  rect(g, x0 + 3, t - 3, x1 - 3, t - 3, c);
  rect(g, x0 + 1, t - 2, x1 - 1, t - 1, c);
  rect(g, x0, t, x1, t, c);
  rect(g, cx, t - 4, cx + 1, t - 4, button);
  if (side > 0) { rect(g, x1 - 2, t, x1 + 5, t, brim); rect(g, x1 + 2, t, x1 + 3, t, sticker); }
  else { rect(g, x0 - 5, t, x0 + 2, t, brim); rect(g, x0 - 3, t, x0 - 2, t, sticker); }
}

// Gold rope chain hanging in a U across the chest, with a medallion.
function goldChain(g, P, { c = C.gold, pend = C.glow, swing = 0 } = {}) {
  const [x0, x1] = headSpan(P), y = P.chin, m = midCol(P);
  const pts = [[x0 + 3, y], [x0 + 4, y + 1], [x0 + 5, y + 2], [m - 1, y + 3], [m, y + 3], [m + 1, y + 3], [m + 2, y + 3],
    [x1 - 5, y + 2], [x1 - 4, y + 1], [x1 - 3, y]];
  for (const [px, py] of pts) onBody(g, P, px, py, c);
  const px = m + swing;
  rect(g, px, y + 4, px + 1, y + 5, c);
  g.put(px, y + 4, pend);
}

// Open party shirt: loud colour on the torso and sleeves, a white collar
// flaring over the shoulders, the orange chest showing down the middle,
// a few dots of print.
function openShirt(g, P, { c = C.purple, dark = C.navy, print = C.gold, collar = C.ivory } = {}) {
  const m = midCol(P);
  const open = (x, y) => (y === P.chin && x >= m - 1 && x <= m + 2) || (y > P.chin && x >= m && x <= m + 1);
  recolour(g, P, (x, y) => y >= P.chin && y <= P.waist && !open(x, y), c, dark);
  for (const [dx, dy] of [[-2, 0], [-3, 0], [-4, 0], [-2, 1], [3, 0], [4, 0], [5, 0], [3, 1]]) onBody(g, P, m + dx, P.chin + dy, collar);
  for (const [dx, dy] of [[-6, 3], [-4, 6], [-8, 5], [6, 3], [8, 5], [5, 6]]) {
    const x = m + dx, y = P.chin + dy;
    if (y <= P.waist) { const t = P.at(x, y); if (t === 'o' || t === 's') g.put(x, y, print); }
  }
}

// Skinny jeans: the legs and the waist row in denim, a seam on each leg.
function skinnyJeans(g, P, { c = C.navy, seam = C.blue } = {}) {
  recolour(g, P, (x, y) => y >= P.waist, c, c);
  const legX = P.cells.filter(([, y, t]) => y === P.feet - 3 && t !== 'e').map(c2 => c2[0]);
  for (const x of legX) if (!legX.includes(x - 1)) for (let y = P.legTop; y < P.feet - 1; y++) onBody(g, P, x, y, seam);
}

// Leg pieces of a placed pose: 4-connected groups of cells below the waist.
function legGroups(P) {
  const legSet = new Map(P.cells.filter(([, y]) => y >= P.legTop).map(([x, y]) => [x + ',' + y, [x, y]]));
  const seen = new Set(), out = [];
  for (const [key0, c0] of legSet) {
    if (seen.has(key0)) continue;
    const st = [c0], comp = []; seen.add(key0);
    while (st.length) {
      const [x, y] = st.pop(); comp.push([x, y]);
      for (const [u, v] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const kk = u + ',' + v; if (legSet.has(kk) && !seen.has(kk)) { seen.add(kk); st.push([u, v]); }
      }
    }
    out.push(comp);
  }
  return out;
}

// Bright high-tops on every foot: the leg's bottom row a white sole with a
// toe poking out a cell (dir -1 / 1, 0 = outward from his middle), the two
// rows above it shoe colour with a lace.
function hiTops(g, P, { c = C.lime, sole = C.ivory, lace = C.pink, dir = 0 } = {}) {
  for (const leg of legGroups(P)) {
    const bot = Math.max(...leg.map(q => q[1]));
    const rowAt = (y) => leg.filter(q => q[1] === y).map(q => q[0]);
    const b = rowAt(bot); if (!b.length) continue;
    const bx0 = Math.min(...b), bx1 = Math.max(...b);
    const d = dir || ((bx0 + bx1) / 2 < P.head.cx ? -1 : 1);
    for (const x of b) g.put(x, bot, sole);
    for (const y of [bot - 1, bot - 2]) for (const x of rowAt(y)) g.put(x, y, c);
    const r1 = rowAt(bot - 1);
    if (r1.length) g.put(d < 0 ? Math.max(...r1) : Math.min(...r1), bot - 1, lace);
    const tx = d < 0 ? bx0 - 1 : bx1 + 1;
    g.put(tx, bot, sole);
    if (r1.length) g.put(d < 0 ? Math.min(...r1) - 1 : Math.max(...r1) + 1, bot - 1, c);
  }
}

// Oversized white tee: torso white, baggy short sleeves (the hands stay
// orange), the hem hanging past the waist over the tops of his legs.
function bigTee(g, P, { c = C.ivory, dark = C.cream, hem = 2, sleeve = 2 } = {}) {
  // The torso's span on each row (cells under the head's columns, ±lean).
  const rowSpan = (y) => {      // the widest run of cells on the row
    const xs = P.cells.filter(q => q[1] === y).map(q => q[0]).sort((u, v) => u - v);
    if (!xs.length) return null;
    const runs = []; for (const x of xs) { const r = runs[runs.length - 1]; if (r && x === r[1] + 1) r[1] = x; else runs.push([x, x]); }
    return runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  };
  const w = rowSpan(P.waist);
  const tx0 = w ? w[0] : headSpan(P)[0], tx1 = w ? w[1] : headSpan(P)[1];
  // Torso: everything from the chin to the waist within the body block;
  // arms: only the `sleeve` cells nearest the body.
  const body = (y) => {
    const xs = P.cells.filter(q => q[1] === y && q[2] !== 'e').map(q => q[0]).sort((u, v) => u - v);
    return xs;
  };
  for (let y = P.chin; y <= P.waist; y++) {
    const xs = body(y); if (!xs.length) continue;
    // Split the row into runs; the widest run is the torso, others are arms.
    const runs = []; for (const x of xs) { const r = runs[runs.length - 1]; if (r && x === r[1] + 1) r[1] = x; else runs.push([x, x]); }
    const torso = runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
    const head = headSpan(P);
    const tl = Math.max(torso[0], Math.min(head[0], tx0) - (torso[0] < head[0] - 1 ? sleeve : 0));
    const tr = Math.min(torso[1], Math.max(head[1], tx1) + (torso[1] > head[1] + 1 ? sleeve : 0));
    for (let x = tl; x <= tr; x++) { const t = P.at(x, y); if (t && t !== 'e') g.put(x, y, t === 's' ? dark : c); }
    for (const r of runs) if (r !== torso && r[1] - r[0] >= 1) {      // detached arm nubs: sleeve on the body side
      const near = r[0] > torso[1] ? [r[0], r[0] + sleeve - 1] : [r[1] - sleeve + 1, r[1]];
      for (let x = near[0]; x <= near[1]; x++) { const t = P.at(x, y); if (t && t !== 'e') g.put(x, y, c); }
    }
  }
  for (let i = 1; i <= hem; i++) rect(g, tx0 - (i === hem ? 1 : 0), P.waist + i, tx1 + (i === hem ? 1 : 0), P.waist + i, c);
  const m = Math.floor((tx0 + tx1) / 2);
  g.put(m - 4, P.waist + hem, dark); g.put(m + 4, P.waist + hem, dark);
  // Neck hole.
  const mc = midCol(P);
  for (let x = mc - 1; x <= mc + 2; x++) onBody(g, P, x, P.chin, C.body);
}

// Wristband on a hand (side 'L' / 'R', screen side after any flip): the
// nub's bottom row for a raised hand, its inner column for a side one.
function wristband(g, P, { side = 'R', c = C.red, stripe = C.ivory, row = false } = {}) {
  const h = side === 'R' ? P.handR : P.handL;
  if (!h) return;
  if (h.dir === 'up' || row) {
    const x0 = h.dir === 'up' ? h.x0 : h.dir < 0 ? h.x : h.x - 3, x1 = x0 + 3;
    for (let x = x0; x <= x1; x++) { onBody(g, P, x, h.y1, c); }
    onBody(g, P, x0 + 1, h.y1, stripe);
  } else {
    const x = h.dir < 0 ? h.x + 2 : h.x - 2;
    for (let y = h.y0; y <= h.y1; y++) onBody(g, P, x, y, c);
    onBody(g, P, x, h.y0 + 1, stripe);
  }
}

// Shoulder pads: a raised block on each shoulder, a cell wider than the arm.
function shoulderPads(g, P, { c = C.red, dark = C.maroon } = {}) {
  const [x0, x1] = headSpan(P);
  for (const side of [-1, 1]) {
    const arm = P.cells.filter(([x, y]) => y >= P.chin - 1 && y <= P.waist && (side < 0 ? x < x0 : x > x1));
    if (!arm.length) continue;
    const top = Math.min(...arm.map(c2 => c2[1]));
    const row = arm.filter(c2 => c2[1] === top).map(c2 => c2[0]);
    const ax0 = Math.min(...row), ax1 = Math.max(...row);
    const inner = side < 0 ? ax1 + 1 : ax0 - 1;
    rect(g, Math.min(ax0, inner) - (side < 0 ? 1 : 0), top - 1, Math.max(ax1, inner) + (side > 0 ? 1 : 0), top - 1, c);
    g.put(side < 0 ? ax0 - 1 : ax1 + 1, top, dark);
  }
}

// ── Scenery ──────────────────────────────────────────────────────────────────

// Full moon: a pale disc with a few crater patches.
function moon(g, cx, cy, r = 6, { c = C.cream, crater = C.tan, rim = null } = {}) {
  disc(g, cx, cy, r, c);
  for (const [x, y, s] of [[-2, -2, 1], [2, 1, 1], [-1, 3, 0], [3, -3, 0]]) {
    rect(g, cx + x, cy + y, cx + x + s, cy + y + s, crater);
  }
  if (rim) ring(g, cx, cy, r + 1, rim);
}

// ── Bookends: idle → poof (costume on) ... poof (costume off) → idle ─────────

/**
 * open(sc, dressedIdle): official idle with a blink (blink: false skips it,
 * to save frames), then the poof that
 * puts the costume on. dressedIdle(g) paints the dressed idle (plus any
 * set dressing that arrives with the costume).
 */
function open(sc, dressedIdle, { cy = -4, first = 450, blink = true } = {}) {
  const P0 = k.place('idle');
  const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y + cy, ph);
  sc.frame(first, g => k.clawd(g, 'idle'));
  if (blink) {
    sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
    sc.frame(200, g => k.clawd(g, 'idle'));
  }
  sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
  sc.frame(110, g => { dressedIdle(g); puff(g, 1); });
  sc.frame(100, g => { dressedIdle(g); puff(g, 2); });
  sc.frame(90, g => { dressedIdle(g); puff(g, 3); });
}
function close(sc, dressedIdle, { cy = -4, last = 400 } = {}) {
  const P0 = k.place('idle');
  const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y + cy, ph);
  sc.frame(90, g => { dressedIdle(g); puff(g, 0); });
  sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
  sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
  sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
  sc.frame(last, g => k.clawd(g, 'idle'));
}

const CREDIT = 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).';

module.exports = {
  derive, armCells,
  capBack, capBrim, flatBrim, legGroups, goldChain, wristband, openShirt, skinnyJeans, hiTops, bigTee, shoulderPads, moon,
  open, close, CREDIT,
};
