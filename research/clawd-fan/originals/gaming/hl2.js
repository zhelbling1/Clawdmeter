#!/usr/bin/env node
/**
 * "Rise and shine": made for this fork, AI-drawn with the originals kit.
 * References Half-Life 2 (2004) as costumes and situations only: a silent
 * scientist in an orange-and-grey hazard suit with little glasses, a goatee
 * and a red crowbar, smashing supply crates; a mysterious man in a blue-grey
 * suit with a briefcase who flickers in to watch. No logos (no lambda), no
 * game UI, no sprites, no likenesses.
 *
 * Story: idle → poof (hazard suit, crowbar; a crate arrives) → he whacks the
 * crate; behind him the suited Clawd fades in out of nowhere → loop: crack,
 * SMASH, splinters, a fresh crate drops in, crack again, while the suited
 * one watches and straightens his tie → the hero finally turns; they stare;
 * "WAKE UP"; the suited one glitches out of existence → the hero shrugs →
 * poof → idle.
 *
 * Usage: node gaming/hl2.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, line, caption } = k;
const { layer, inFront } = require('./props');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-HalfLife.gif', name: 'rise and shine', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Half-Life 2 (2004): the silent scientist in an orange-and-grey hazard suit (glasses, goatee, red crowbar) smashing supply crates, watched by a mysterious man in a blue-grey suit with a briefcase. Costumes only: no lambda or other logos, no game UI or sprites.',
});

const SUIT = [0x40, 0x50, 0x6E];        // the suited man's blue-grey (own colour)

const HX = 6;                           // hero: right of centre, facing the crate
const GX = -14, GY = -3;                // suited man: left, a few rows "further back"

// ── Hero: hazard suit ────────────────────────────────────────────────────────

function hazardSuit(g, P) {
  const [x0, x1] = k.headSpan(P), m = k.midCol(P);
  const arm = (x, y) => (x < x0 || x > x1 || y < P.head.top) && y < P.legTop;
  // Arm armour: grey sleeves; the tip column stays orange (his hand).
  const tips = new Set();
  for (const s of ['handL', 'handR']) {
    const h = P[s]; if (!h) continue;
    if (h.dir === 'up') for (let x = h.x0; x <= h.x1; x++) tips.add(x + ',' + h.y0);
    else for (let y = h.y0; y <= h.y1; y++) tips.add(h.x + ',' + y);
  }
  k.recolour(g, P, (x, y) => arm(x, y) && !tips.has(x + ',' + y), C.slate, C.slate);
  // Chest plate: orange-red armour with a grey collar ring and trim.
  const y0 = P.chin + 2, y1 = P.waist - 1;
  k.recolour(g, P, (x, y) => y >= y0 && y <= y1 && x >= x0 + 1 && x <= x1 - 1, C.ginger, C.ginger);
  k.recolour(g, P, (x, y) => y === y0 && x >= x0 + 1 && x <= x1 - 1, C.slate, C.slate);
  for (let y = y0 + 1; y <= y1; y++) { k.onBody(g, P, m, y, C.slate); k.onBody(g, P, m + 1, y, C.slate); }
  // Belt and grey boots.
  k.recolour(g, P, (x, y) => y === P.waist && !arm(x, y), C.charcoal, C.charcoal);
  k.recolour(g, P, (x, y) => y >= P.feet - 1, C.slate, C.slate);
  // Short brown hair, little rectangular glasses, a goatee.
  const t = P.head.top;
  rect(g, x0 + 1, t - 1, x1 - 1, t - 1, C.brown);
  rect(g, x0 + 3, t - 2, x1 - 3, t - 2, C.brown);
  k.onBody(g, P, x0, t, C.brown); k.onBody(g, P, x1, t, C.brown);
  for (const e of P.eyes) {
    const ex = e.x + (e.w > 2 ? (e.x < P.head.cx ? 1 : 0) : 0), ey = P.eyeBottom - 1;
    k.outline(g, ex - 1, ey - 1, ex + 2, ey + 2, C.charcoal);
  }
  const [eL, eR] = P.eyes;
  rect(g, eL.x + 3, P.eyeBottom - 1, eR.x - 2, P.eyeBottom - 1, C.charcoal);
  // Eyes stay on top of the frames.
  for (const [x, y, tp] of P.cells) if (tp === 'e') put(g, x, y, C.eye);
  k.onBody(g, P, m, P.chin, C.brown); k.onBody(g, P, m + 1, P.chin, C.brown);
  k.onBody(g, P, m, P.chin + 1, C.brown); k.onBody(g, P, m + 1, P.chin + 1, C.brown);
}

// The red crowbar, as cell runs from the grip: a straight bar and a claw
// hook curling at the far end. dir: 'up' (held upright), 'back' (over the
// shoulder, up and back), 'raised' (wound up overhead), 'strike' (down and
// forward onto the crate), 'down' (hanging).
function crowbar(g, x, y, dir, f = 1) {
  const runs = {
    up:     [[0, 0], [0, -1], [0, -2], [0, -3], [0, -4], [0, -5], [0, -6], [1, -7], [2, -7], [2, -6]],
    back:   [[0, 0], [-1, -1], [-2, -2], [-3, -3], [-4, -4], [-5, -5], [-6, -5], [-6, -4]],
    raised: [[0, 0], [-1, -1], [-2, -1], [-3, -2], [-4, -2], [-5, -3], [-6, -3], [-7, -2], [-7, -1]],
    strike: [[0, 0], [1, 1], [1, 2], [2, 3], [2, 4], [3, 5], [4, 5], [4, 4]],
    down:   [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 7], [2, 7], [2, 6]],
  }[dir];
  runs.forEach(([u, v], i) => put(g, x + u * f, y + v, i === 0 ? C.maroon : C.red));
}

// Hero poses with the crowbar: 'rest' (over his shoulder), 'raise'
// (overhead, about to swing), 'strike' (down on the crate), 'turned' (facing
// left at the suited man), 'blink', 'shrug'.
function hero(g, mode, { eyes = null } = {}) {
  const pose = { rest: 'turn', raise: 'wave_1', strike: 'point', turned: 'turn', shrug: 'arms_up_wide', blink: 'turn_blink' }[mode];
  const flip = mode === 'turned' || mode === 'blink';
  return inFront(g, h => {
    const P = k.clawd(h, pose, { dx: HX + (flip ? 2 : 0), flip, eyes, over: hazardSuit });
    const r = P.handR;
    if (mode === 'rest') crowbar(h, r.x, r.y - 1, 'back');
    if (mode === 'raise') crowbar(h, Math.round(r.x), r.y - 1, 'raised');
    if (mode === 'strike') crowbar(h, r.x + 1, r.y, 'strike');
    if (mode === 'turned' || mode === 'blink') crowbar(h, r.x + 1, r.y0, 'up', -1);
    if (mode === 'shrug') crowbar(h, r.x + 1, r.y, 'up');
  });
}

// ── The suited man ───────────────────────────────────────────────────────────

// tie: true moves his right arm nub (a whole block of official cells) onto
// his chest, the hand on the knot.
function gman(g, { eyes = 'right', tie = false, fx = null } = {}) {
  const L = layer(g.headroom, h => {
    let P = k.place('idle', { dx: GX, dy: GY, eyes });
    const [x0, x1] = k.headSpan(P);
    const armR = P.cells.filter(([x, y]) => x > x1 && y < P.legTop);
    const armKey = new Set(armR.map(([x, y]) => x + ',' + y));
    if (tie) P = { ...P, cells: P.cells.filter(([x, y]) => !armKey.has(x + ',' + y)) };
    k.drawPose(h, P);
    // Suit, trousers and shoes; sleeves leave his hands orange.
    const tipX = Math.max(...armR.map(c => c[0]));
    const hand = (x) => x === tipX || x === P.handL.x;
    k.recolour(h, P, (x, y) => y >= P.chin && !hand(x), SUIT, SUIT);
    k.recolour(h, P, (x, y) => y === P.feet, C.charcoal, C.charcoal);
    const m = k.midCol(P);
    // Shirt V and a dark tie.
    for (const [u, v] of [[-2, 0], [-1, 0], [2, 0], [3, 0], [-1, 1], [2, 1]]) put(h, m + u, P.chin + v, C.ivory);
    for (let y = P.chin; y <= P.waist - 1; y++) { put(h, m, y, C.charcoal); put(h, m + 1, y, C.charcoal); }
    k.slick(h, P, { c: C.charcoal, sheen: C.slate });
    // Briefcase hanging from his left hand.
    const hl = P.handL;
    rect(h, hl.x, hl.y1 + 2, hl.x + 3, hl.y1 + 5, C.brown);
    rect(h, hl.x, hl.y1 + 2, hl.x + 3, hl.y1 + 2, C.tan);
    put(h, hl.x + 1, hl.y1 + 1, C.charcoal); put(h, hl.x + 2, hl.y1 + 1, C.charcoal);
    if (tie) {
      // The arm block, mirrored onto his chest (a row lower, clear of his
      // face): grey sleeve, orange hand on the tie.
      for (const [x, y] of armR) {
        const nx = m + 2 + (tipX - x);
        put(h, nx, y + 1, x === tipX ? C.body : C.slate);
      }
    }
  });
  if (!fx) { k.blit(g, L); return; }
  for (let y = g.top; y < k.STAGE_H; y++) for (let x = 0; x < k.W; x++) {
    const c = fx(L, x, y);
    if (c) g.put(x, y, c);
  }
}
// Fade / glitch filters over his layer.
const ghost = (L, x, y) => (x + 2 * y) % 4 === 0 && L.get(x, y) ? C.slate : null;
const checker = (L, x, y) => (x + y) % 2 === 0 ? L.get(x, y) : null;
const SHIFT = [0, 2, -2, 1, 0, -3, 2, -1];
const glitch = (L, x, y) => (y % 4 === 1 ? null : L.get(x - SHIFT[(y + 40) % 8], y));

// ── The crate ────────────────────────────────────────────────────────────────

const CX0 = 44, CX1 = 52, CY0 = 30, CY1 = 36, CM = 48;   // a squat crate, centre column CM
// state: 'whole' | 'cracked'. dy lifts it (falling in).
function crate(g, { state = 'whole', dy = 0 } = {}) {
  rect(g, CX0, CY0 + dy, CX1, CY1 + dy, C.tan);
  k.outline(g, CX0, CY0 + dy, CX1, CY1 + dy, C.brown);
  line(g, CX0 + 1, CY1 - 1 + dy, CX1 - 1, CY0 + 1 + dy, C.brown);           // brace
  if (state === 'cracked') {
    for (const [u, v] of [[1, 0], [1, 1], [0, 2], [1, 3], [0, 4]]) put(g, CM + u, CY0 + v + dy, C.charcoal);
    put(g, CM + 2, CY0 - 1 + dy, C.tan); put(g, CM + 3, CY0 - 2 + dy, C.tan);  // a splinter sticking up
  }
}
// Splinters after the smash. phase 0: bursting out; 1: on the ground.
function splinters(g, phase) {
  const at = (u, v) => [CM + u, CY0 + v];
  if (phase === 0) {
    for (const [p, q] of [[[-5, -6], [-3, -4]], [[4, -8], [2, -6]], [[0, -9], [0, -7]], [[5, -2], [3, -1]],
      [[-5, 1], [-3, 2]], [[2, 4], [4, 5]]]) line(g, ...at(...p), ...at(...q), C.tan);
    for (const [u, v] of [[-5, -2], [5, -5], [-1, 5], [2, -3], [-2, -7]]) put(g, ...at(u, v), C.brown);
    k.sparkle(g, CM, CY0 + 1, 3, C.glow, C.ivory);
  } else {
    rect(g, CX0, 36, CX0 + 3, 36, C.tan); rect(g, CM + 1, 36, CX1, 36, C.tan);
    rect(g, CX0 + 2, 35, CX0 + 4, 35, C.brown); rect(g, CM + 2, 35, CM + 3, 35, C.tan);
    put(g, CX1, 35, C.tan);
  }
}
// Where the crowbar lands: a white-hot point and sparks flying up.
const impact = (g) => {
  const x = CM + 4, y = CY0;
  put(g, x, y, C.ivory); put(g, x - 1, y, C.glow);
  for (const [u, v] of [[-3, -1], [-5, -2], [-4, -4], [-6, -4]]) put(g, x + u, y + v, C.glow);
};

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puffs = (g, ph) => { k.poof(g, P0.centre.x + 4, P0.centre.y - 3, ph); k.poof(g, CM, 33, ph, { scale: 0.6 }); };

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(200, g => k.clawd(g, 'idle'));

// Poof on: suited up, crowbar in hand, a crate in a puff of its own.
sc.frame(90, g => { k.clawd(g, 'idle'); puffs(g, 0); });
sc.frame(110, g => { crate(g); hero(g, 'rest'); puffs(g, 1); });
sc.frame(100, g => { crate(g); hero(g, 'rest'); puffs(g, 2); });
sc.frame(160, g => { crate(g); hero(g, 'rest'); puffs(g, 3); });

// He goes to work; behind him, the suited man fades in out of nowhere.
sc.frame(200, g => { gman(g, { fx: ghost }); crate(g); hero(g, 'raise'); });
sc.frame(200, g => { gman(g, { fx: checker }); crate(g, { state: 'cracked' }); hero(g, 'strike'); impact(g); });
sc.frame(180, g => { gman(g); crate(g, { state: 'cracked' }); hero(g, 'raise'); });

// Loop: SMASH, splinters, a fresh crate drops in, crack, raise again. The
// suited man watches and straightens his tie.
sc.loopStart();
sc.frame(240, g => { gman(g); splinters(g, 0); hero(g, 'strike', { eyes: 'closed' }); });
sc.frame(280, g => { gman(g, { tie: true }); splinters(g, 1); hero(g, 'rest'); });
sc.frame(90, g => { gman(g, { tie: true, eyes: 'closed' }); splinters(g, 1); crate(g, { dy: -12 });
  k.motionLines(g, CM - 2, 16, { dir: 'up', len: 3, count: 3, gap: 2 }); hero(g, 'rest'); });
sc.frame(200, g => { gman(g); crate(g); k.dust(g, CM, 36, 0); hero(g, 'rest'); });
sc.frame(220, g => { gman(g); crate(g); hero(g, 'raise'); });
sc.frame(220, g => { gman(g); crate(g, { state: 'cracked' }); hero(g, 'strike'); impact(g); });
sc.frame(200, g => { gman(g, { eyes: 'closed' }); crate(g, { state: 'cracked' }); hero(g, 'raise'); });
sc.loopEnd();

// He finally turns. They stare. A tie adjustment, two words, and he's gone.
sc.frame(560, g => { gman(g); crate(g, { state: 'cracked' }); hero(g, 'turned', { eyes: 'wide' }); });
sc.frame(800, g => { gman(g, { tie: true }); crate(g, { state: 'cracked' }); hero(g, 'turned', { eyes: 'wide' });
  caption(g, 'WAKE UP', 15, 11, C.ivory, { align: 'center' }); });
sc.frame(90, g => { gman(g, { fx: glitch }); crate(g, { state: 'cracked' }); hero(g, 'turned', { eyes: 'wide' }); });
sc.frame(70, g => { rect(g, 4, 26, 20, 26, C.slate); put(g, 12, 26, C.ivory); put(g, 13, 26, C.ivory);
  crate(g, { state: 'cracked' }); hero(g, 'blink'); });
sc.frame(420, g => { crate(g, { state: 'cracked' }); hero(g, 'turned', { eyes: 'open' });
  caption(g, '?', 34, 13, C.ivory); });
// Shrug; back to work.
sc.frame(560, g => { crate(g, { state: 'cracked' }); hero(g, 'shrug', { eyes: 'closed' }); });

// Poof off.
sc.frame(90, g => { crate(g, { state: 'cracked' }); hero(g, 'rest'); puffs(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puffs(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puffs(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puffs(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
