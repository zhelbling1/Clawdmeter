/**
 * Clawd's official poses, cell-exact, with anchor points for costumes.
 *
 * Every pose is a frame of an official core GIF (kit/poses.json, rebuilt by
 * kit/build_poses.js). Nothing here redraws his body: costumes and props are
 * layers on top (or under) it.
 *
 *   pose(name)                  -> the pose (cells + anchors), stage coords
 *   place(name | pose, opts)    -> a placed copy: { dx, dy, flip, eyes }
 *   drawPose(g, placed)         -> paints him
 *   clawd(g, name, opts)        -> place + draw (+ opts.under / opts.over
 *                                  callbacks), returns the placed pose
 *   POSES / poseNames()         -> the named poses; frame(clip, src) for any
 *                                  other official frame by GIF frame number
 *
 * Anchors (all in stage cells, after dx/dy/flip):
 *   eyes      [{x, y, w, h}, {…}]  left, right (screen order)
 *   eyeY      top row of the eyes;  eyeL / eyeR: left eye box, right eye box
 *   head      { x0, x1, top, cx }  head span at the eye row, top row above
 *                                  the face centre, cx = face centre (x.5 ok)
 *   chin      first row under the eyes (collar / tie knot row)
 *   waist     last row of the torso;   legTop: first leg row
 *   feet      bottom row;   feetX: [x0, x1]
 *   handL / handR  { x, y, y0, y1, dir }  arm tip: dir -1 = pointing left,
 *                  +1 right, 'up' raised (then x is its centre column, y its
 *                  top row); null when the arm is tucked into the body
 *   centre    { x, y }   torso centre
 *   facing    'front' | 'right' | 'left'  (3/4 views face right unflipped)
 */

const data = require('./poses.json');
const { C } = require('./canvas');

// ── Named poses (GIF frame numbers from the official core set) ───────────────
// Browse every frame with labels: node kit/pose_sheet.js → kit/poses.png.
const POSES = {
  // Standing
  idle:          { clip: 'waving', src: 0 },     // the universal bookend
  crouch:        { clip: 'waving', src: 4 },     // knees bent, about to move
  squash:        { clip: 'jumping', src: 14 },   // landed, wide and low
  stretch:       { clip: 'jumping', src: 5 },    // tall, on his toes, eyes wide
  // Arms
  arms_up:       { clip: 'pointing', src: 7 },   // both arms overhead, feet planted
  arms_up_2:     { clip: 'pointing', src: 8 },   //   (arms a cell closer)
  arms_up_wide:  { clip: 'pointing', src: 6 },   //   (arms rising, spread)
  wave_reach:    { clip: 'waving', src: 5, anchors: { facing: 'front' } },  // arm flung up, leaning
  wave_1:        { clip: 'waving', src: 6 },     // right hand up by the head
  wave_2:        { clip: 'waving', src: 7 },     // the wave alternates 2 / 3
  wave_3:        { clip: 'waving', src: 8 },
  wave_down:     { clip: 'waving', src: 16, anchors: { facing: 'front' } }, // lowering the arm
  // 3/4 view, facing right (flip: true faces left)
  turn_blink:    { clip: 'pointing', src: 17 },  // turning, eyes shut
  turn:          { clip: 'pointing', src: 18 },  // turned, arm at his side
  point_1:       { clip: 'pointing', src: 19 },  // the arm extending…
  point:         { clip: 'pointing', src: 20 },  // …fully pointing right
  point_2:       { clip: 'pointing', src: 23 },  //   (arm a cell lower)
  point_3:       { clip: 'pointing', src: 35 },  //   (arm a cell longer)
  // Jumping (airborne frames rise above the floor; feet anchor follows)
  jump_crouch:   { clip: 'jumping', src: 4 },
  jump_up:       { clip: 'jumping', src: 6 },
  jump_top:      { clip: 'jumping', src: 8 },
  jump_fall:     { clip: 'jumping', src: 12 },
  jump_land:     { clip: 'jumping', src: 13 },   // splat, eyes tall
  jump_recover:  { clip: 'jumping', src: 15 },   // legs long, arms out
  happy_top:     { clip: 'happy', src: 8 },      // airborne, ^ ^ eyes
  // Gaits (in place; translate with dx). 3/4 view facing right.
  walk_start: { clip: 'walking', src: 4 },
  walk_0: { clip: 'walking', src: 5 },  walk_1: { clip: 'walking', src: 6 },
  walk_2: { clip: 'walking', src: 7 },  walk_3: { clip: 'walking', src: 8 },
  walk_4: { clip: 'walking', src: 9 },
  crab_0: { clip: 'crab', src: 4 },     crab_1: { clip: 'crab', src: 5 },
  crab_2: { clip: 'crab', src: 6 },     crab_3: { clip: 'crab', src: 7 },
  crab_4: { clip: 'crab', src: 8 },     crab_5: { clip: 'crab', src: 9 },
  crab_6: { clip: 'crab', src: 10 },    crab_7: { clip: 'crab', src: 11 },
  // Dancing (^ ^ eyes, bouncing; 0-5 lean right, 6-10 lean left)
  dance_0: { clip: 'dancing', src: 8 },  dance_1: { clip: 'dancing', src: 9 },
  dance_2: { clip: 'dancing', src: 10 }, dance_3: { clip: 'dancing', src: 12 },
  dance_4: { clip: 'dancing', src: 16 }, dance_5: { clip: 'dancing', src: 22 },
  dance_6: { clip: 'dancing', src: 24 }, dance_7: { clip: 'dancing', src: 25 },
  dance_8: { clip: 'dancing', src: 26 }, dance_9: { clip: 'dancing', src: 28 },
  dance_10: { clip: 'dancing', src: 32 },
  dance_blink:   { clip: 'dancing', src: 7 },    // squashed, eyes shut
};
// Official cycles, in playing order: [pose, ms] (ms as the GIFs time them).
const CYCLES = {
  walk: [['walk_0', 80], ['walk_1', 80], ['walk_2', 90], ['walk_3', 80], ['walk_4', 80]],
  crab: [0, 1, 2, 3, 4, 5, 6, 7].map(i => [`crab_${i}`, i % 3 === 0 ? 90 : 80]),
  dance: [[0, 80], [1, 80], [2, 170], [3, 170], [2, 170], [4, 170], [2, 170], [0, 170], [5, 170],
    [6, 80], [7, 90], [8, 160], [9, 170], [8, 160], [10, 160], [8, 160], [6, 160], [5, 160]]
    .map(([i, ms]) => [`dance_${i}`, ms]),
  wave: [['wave_2', 90], ['wave_3', 80]],
};

// ── Loading ──────────────────────────────────────────────────────────────────

const cache = new Map();

function frame(clip, src) {
  const k = `${clip}:${src}`;
  if (cache.has(k)) return cache.get(k);
  const c = data.clips[clip];
  if (!c) throw new Error(`no clip '${clip}' (have ${Object.keys(data.clips)})`);
  const f = c.frames.find(f => f.src.includes(src));
  if (!f) throw new Error(`${clip}: no frame ${src}`);
  const cells = [];
  f.rows.forEach((row, r) => [...row].forEach((ch, i) => { if (ch !== '.') cells.push([f.x + i, f.y + r, ch]); }));
  const p = analyse({ name: k, clip, src, cells });
  cache.set(k, p);
  return p;
}

function pose(name) {
  if (typeof name === 'object') return name;
  const def = POSES[name];
  if (!def) {
    const m = /^(\w+):(\d+)$/.exec(name);
    if (m) return frame(m[1], +m[2]);
    throw new Error(`unknown pose '${name}' (see POSES in kit/poses.js)`);
  }
  const p = frame(def.clip, def.src);
  return { ...p, name, anchors: { ...p.anchors, ...(def.anchors || {}) } };
}

// ── Anchors ──────────────────────────────────────────────────────────────────

function analyse(p) {
  const at = new Map(p.cells.map(([x, y, t]) => [x + ',' + y, t]));
  const has = (x, y) => at.has(x + ',' + y);
  // Eyes: 8-connected components of eye cells.
  const eyeCells = p.cells.filter(c => c[2] === 'e');
  const seen = new Set(), eyes = [];
  for (const [x, y] of eyeCells) {
    if (seen.has(x + ',' + y)) continue;
    const st = [[x, y]], comp = [];
    seen.add(x + ',' + y);
    while (st.length) {
      const [cx, cy] = st.pop(); comp.push([cx, cy]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = (cx + dx) + ',' + (cy + dy);
        if (!seen.has(k) && at.get(k) === 'e') { seen.add(k); st.push([cx + dx, cy + dy]); }
      }
    }
    const xs = comp.map(c => c[0]), ys = comp.map(c => c[1]);
    eyes.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1,
      h: Math.max(...ys) - Math.min(...ys) + 1, cells: comp });
  }
  eyes.sort((a, b) => a.x - b.x);
  if (eyes.length !== 2) throw new Error(`${p.name}: found ${eyes.length} eyes`);
  const [eL, eR] = eyes;
  const eyeY = Math.min(eL.y, eR.y);
  const eyeBottom = Math.max(eL.y + eL.h, eR.y + eR.h) - 1;
  const cx = (eL.x + eL.w - 1 + eR.x) / 2;         // may be x.5
  const ci = Math.floor(cx);
  let top = eyeY; while (has(ci, top - 1) && has(ci + 1, top - 1)) top--;
  let x0 = ci; while (has(x0 - 1, eyeY)) x0--;
  let x1 = ci; while (has(x1 + 1, eyeY)) x1++;
  const ys = p.cells.map(c => c[1]);
  const feet = Math.max(...ys);
  // Legs start where the centre column opens up below the torso.
  // Legs start at the first row under the eyes with a gap inside the head's
  // span (between the legs).
  const gappy = (y) => {
    let a = -1, b = -1;
    for (let x = x0; x <= x1; x++) if (has(x, y)) { if (a < 0) a = x; b = x; }
    if (a < 0) return true;
    for (let x = a; x <= b; x++) if (!has(x, y)) return true;
    return false;
  };
  let legTop = eyeBottom + 1;
  while (legTop <= feet && !gappy(legTop)) legTop++;
  if (legTop > feet) legTop = feet;              // no visible gap (squashes)
  const waist = legTop - 1;
  const feetXs = p.cells.filter(c => c[1] === feet).map(c => c[0]);
  // Arms: cells beside the head/torso span, or above the head top.
  const hand = (side) => {
    const out = p.cells.filter(([x, y]) => y >= top && y < legTop && (side < 0 ? x < x0 : x > x1));
    if (out.length) {
      const ex = side < 0 ? Math.min(...out.map(c => c[0])) : Math.max(...out.map(c => c[0]));
      const col = out.filter(c => c[0] === ex).map(c => c[1]);
      const y0 = Math.min(...col), y1 = Math.max(...col);
      return { x: ex, y: Math.round((y0 + y1) / 2), y0, y1, dir: side };
    }
    const up = p.cells.filter(([x, y]) => y < top && (side < 0 ? x <= ci : x > ci));
    if (up.length) {
      const ty = Math.min(...up.map(c => c[1]));
      const row = up.filter(c => c[1] === ty).map(c => c[0]);
      const ux0 = Math.min(...row), ux1 = Math.max(...row);
      return { x: (ux0 + ux1) / 2, y: ty, x0: ux0, x1: ux1, y0: ty, y1: top - 1, dir: 'up' };
    }
    return null;
  };
  // 3/4 views shade the far side of the face; arm shading doesn't count.
  const faceShade = (side) => p.cells.filter(c => c[2] === 's' && c[1] >= eyeY && c[1] <= eyeBottom &&
    (side < 0 ? c[0] < eL.x : c[0] > eR.x + eR.w - 1)).length;
  const shadeL = faceShade(-1), shadeR = faceShade(1);
  p.anchors = {
    eyes: eyes.map(({ x, y, w, h }) => ({ x, y, w, h })), eyeY, eyeBottom,
    eyeL: { x: eL.x, y: eL.y, w: eL.w, h: eL.h }, eyeR: { x: eR.x, y: eR.y, w: eR.w, h: eR.h },
    head: { x0, x1, top, cx },
    chin: eyeBottom + 1, waist, legTop, feet, feetX: [Math.min(...feetXs), Math.max(...feetXs)],
    handL: hand(-1), handR: hand(1),
    centre: { x: cx, y: Math.round((eyeBottom + 1 + waist) / 2) },
    facing: shadeL > shadeR ? 'right' : shadeR > shadeL ? 'left' : 'front',
  };
  return p;
}

// ── Placing (shift, mirror, eye variants) ────────────────────────────────────

// Mirror axis: the idle pose's centre (x 15..38 -> 26.5), so flipping keeps
// him on his spot.
const AXIS2 = 53;

/**
 * place(name, { dx = 0, dy = 0, flip = false, eyes = null })
 * eyes: null (as drawn) | 'open' (2×2) | 'closed' (official blink line) |
 *       'left' | 'right' (glance one cell) | 'up' (official up-glance) |
 *       'happy' (official ^ ^) | 'wide' (official tall 1×3, surprise) |
 *       'none' (no eyes: a mask or visor covers them)
 * Eye variants redraw only the eye cells with shapes from the official frames.
 */
function place(nameOrPose, { dx = 0, dy = 0, flip = false, eyes = null } = {}) {
  const p = pose(nameOrPose);
  const fx = (x) => flip ? AXIS2 - x : x;
  let cells = p.cells.map(([x, y, t]) => [fx(x) + dx, y + dy, t]);
  const a = p.anchors;
  // Eye variants: fill the eye cells with body, stamp the new shape at each eye.
  if (eyes) {
    const eyeSet = new Set(a.eyes.flatMap(e => {
      const out = []; for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) out.push(fx(x) + dx + ',' + (y + dy)); return out;
    }));
    cells = cells.map(([x, y, t]) => t === 'e' && eyeSet.has(x + ',' + y) ? [x, y, 'o'] : [x, y, t]);
    const idx = new Map(cells.map((c, i) => [c[0] + ',' + c[1], i]));
    const set = (x, y) => { const i = idx.get(x + ',' + y); if (i !== undefined) cells[i][2] = 'e'; };
    // Eye boxes in screen order after flipping.
    const boxes = a.eyes.map(e => ({ x: flip ? AXIS2 - (e.x + e.w - 1) + dx : e.x + dx, y: e.y + dy, w: e.w, h: e.h }))
      .sort((u, v) => u.x - v.x);
    boxes.forEach((b, side) => {             // side 0 = screen-left eye
      // Normalise to the open 2×2 eye's spot: a 3-wide blink line extends
      // inward, a 4-wide ^ is centred on it, tall eyes keep their bottom row.
      const bx = b.w === 3 ? b.x + side : b.w >= 4 ? b.x + 1 : b.x;
      const by = b.y + (b.h > 2 ? b.h - 2 : 0);
      const shapes = {
        open:   [[0, 0], [1, 0], [0, 1], [1, 1]],
        closed: side ? [[-1, 1], [0, 1], [1, 1]] : [[0, 1], [1, 1], [2, 1]],
        left:   [[-1, 0], [0, 0], [-1, 1], [0, 1]],
        right:  [[1, 0], [2, 0], [1, 1], [2, 1]],
        up:     side ? [[0, 0], [0, 1], [1, 1]] : [[1, 0], [0, 1], [1, 1]],
        happy:  side ? [[0, 0], [1, 0], [-1, 1], [2, 1]] : [[0, 0], [1, 0], [-1, 1], [2, 1]],
        wide:   [[0, -1], [1, -1], [0, 0], [1, 0], [0, 1], [1, 1]],
        none:   [],
      }[eyes];
      if (!shapes) throw new Error(`unknown eyes '${eyes}'`);
      for (const [u, v] of shapes) set(bx + u, by + v);
    });
  }
  // Anchors through the same transform.
  const tx = (x) => (flip ? AXIS2 - x : x) + dx;
  const hand = (h) => h && (h.dir === 'up'
    ? { ...h, x: tx(h.x), x0: Math.min(tx(h.x0), tx(h.x1)), x1: Math.max(tx(h.x0), tx(h.x1)), y: h.y + dy, y0: h.y0 + dy, y1: h.y1 + dy }
    : { ...h, x: tx(h.x), y: h.y + dy, y0: h.y0 + dy, y1: h.y1 + dy, dir: flip ? -h.dir : h.dir });
  const box = (e) => ({ x: flip ? AXIS2 - (e.x + e.w - 1) + dx : e.x + dx, y: e.y + dy, w: e.w, h: e.h });
  const eyesT = a.eyes.map(box).sort((u, v) => u.x - v.x);
  const headX = [tx(a.head.x0), tx(a.head.x1)].sort((u, v) => u - v);
  const anchors = {
    ...a,
    eyes: eyesT, eyeL: eyesT[0], eyeR: eyesT[1],
    eyeY: a.eyeY + dy, eyeBottom: a.eyeBottom + dy,
    head: { x0: headX[0], x1: headX[1], top: a.head.top + dy, cx: tx(a.head.cx) },
    chin: a.chin + dy, waist: a.waist + dy, legTop: a.legTop + dy, feet: a.feet + dy,
    feetX: [tx(a.feetX[0]), tx(a.feetX[1])].sort((u, v) => u - v),
    handL: hand(flip ? a.handR : a.handL), handR: hand(flip ? a.handL : a.handR),
    centre: { x: tx(a.centre.x), y: a.centre.y + dy },
    facing: flip ? ({ right: 'left', left: 'right', front: 'front' })[a.facing] : a.facing,
  };
  const at = new Map(cells.map(([x, y, t]) => [x + ',' + y, t]));
  return { name: p.name, cells, anchors, ...anchors, flip, dx, dy, at: (x, y) => at.get(x + "," + y) || null };
}

const CELL_COLOUR = { o: C.body, s: C.shade, e: C.eye };

function drawPose(g, P) {
  for (const [x, y, t] of P.cells) g.put(x, y, CELL_COLOUR[t]);
  return P;
}

// One call: place, draw the under-layers, Clawd, then the over-layers.
// opts: place() options plus under / over: fn(g, P) or an array of them.
function clawd(g, name, opts = {}) {
  const P = place(name, opts);
  const run = (f) => [].concat(f || []).forEach(fn => fn(g, P));
  run(opts.under);
  drawPose(g, P);
  run(opts.over);
  return P;
}

const poseNames = () => Object.keys(POSES);

module.exports = { POSES, CYCLES, pose, frame, place, drawPose, clawd, poseNames, data, AXIS2 };
