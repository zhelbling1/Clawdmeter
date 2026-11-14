/**
 * Shared helpers for the gaming scenes (kept here, not in kit/, so the four
 * artists' branches merge cleanly).
 *
 *   layer(headroom, draw)              draw into a fresh Canvas, return it
 *   blitRotated(g, src, deg, cx, cy)   copy a layer rotated about (cx, cy)
 *                                      (clockwise on screen; 90° steps are
 *                                      cell-exact, others nearest-neighbour)
 *   eyesX / eyesSquint(g, P)           cartoon eyes in the official eye ink
 *   firework(g, x, y, phase, c, c2)    rising spark → burst → fading dots
 *   alertFlash(g, x, y, phase, c)      the stealth-game "spotted!" burst
 *   tumble(g, ...)                     Clawd (with costume) rotated as one piece
 *   inFront(g, draw)                   draw on top with a 1-cell gap around it
 */
const k = require('../kit');
const { C, Canvas, rect, line } = k;

function layer(headroom, draw) { const g = new Canvas(headroom); draw(g); return g; }

function blitRotated(g, src, deg, cx, cy, { dx = 0, dy = 0 } = {}) {
  const a = deg * Math.PI / 180;
  let cs = Math.cos(a), sn = Math.sin(a);
  if (Math.abs(cs) < 1e-9) cs = 0; if (Math.abs(sn) < 1e-9) sn = 0;
  for (let y = g.top; y < k.STAGE_H; y++) for (let x = 0; x < k.W; x++) {
    const rx = x - dx - cx, ry = y - dy - cy;
    const sx = Math.round(cx + cs * rx + sn * ry + 1e-6), sy = Math.round(cy - sn * rx + cs * ry + 1e-6);
    const c = src.get(sx, sy);
    if (c) g.put(x, y, c);
  }
}

// Clawd in `pose` with `over` costume, rotated by deg about his torso centre
// and shifted by dx/dy. Returns nothing (anchors don't survive rotation).
function tumble(g, pose, deg, { over, under, dx = 0, dy = 0, eyes = null, flip = false, cx = 26.5, cy = 28.5 } = {}) {
  const src = layer(g.headroom, h => k.clawd(h, pose, { over, under, eyes, flip }));
  blitRotated(g, src, deg, cx, cy, { dx, dy });
}

// Eye ink in custom shapes. Each eye box is redrawn: body first, then ink.
function clearEyes(g, P) {
  for (const e of P.eyes) for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++)
    if (P.at(x, y)) g.put(x, y, C.body);
}
// X X (knocked out): a 3×3 cross per eye, centred on the 2×2 eye.
function eyesX(g, P) {
  clearEyes(g, P);
  for (const e of P.eyes) {
    const x = e.x, y = e.y + e.h - 2;
    for (const [u, v] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) g.put(x + u + (e.x < P.head.cx ? 0 : 1), y + v + 1, C.eye);
  }
}
// > < (wince): chevrons pointing at the nose.
function eyesSquint(g, P) {
  clearEyes(g, P);
  P.eyes.forEach((e, side) => {
    const x = e.x, y = e.y + e.h - 2;          // the eye's top row; the chevron spans y-1..y+1
    const pts = side === 0 ? [[0, -1], [1, 0], [0, 1]] : [[1, -1], [0, 0], [1, 1]];
    for (const [u, v] of pts) g.put(x + u, y + v, C.eye);
  });
}

// Firework: phase 0 rising trail, 1 pop, 2 full burst, 3 falling sparks.
function firework(g, x, y, phase, c = C.gold, c2 = C.glow) {
  if (phase === 0) { line(g, x, y + 2, x, y + 5, C.gray); g.put(x, y + 1, c2); return; }
  if (phase === 1) { k.sparkle(g, x, y, 3, c, c2); return; }
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  if (phase === 2) {
    g.put(x, y, c2);
    for (const [u, v] of dirs) { const r = u && v ? 3 : 4; for (let i = 2; i <= r; i++) g.put(x + u * i, y + v * i, i === r ? c2 : c); }
    return;
  }
  for (const [u, v] of dirs) { const r = u && v ? 4 : 5; g.put(x + u * r, y + v * r + 1, c); }
}

// The "spotted" burst around a "!": short strokes radiating out.
function alertFlash(g, x, y, phase = 0, c = C.ivory) {
  const r0 = 4 + phase, r1 = 6 + phase;
  for (const [u, v] of [[-1, -1], [1, -1], [-1, 0.2], [1, 0.2], [-0.5, -1.2], [0.5, -1.2]]) {
    const n = Math.hypot(u, v);
    line(g, x + u / n * r0, y + v / n * r0, x + u / n * r1, y + v / n * r1, c);
  }
}

// Draw the main subject in front of what's already on g, with a one-cell
// gap of background around him so he separates from look-alikes behind.
function inFront(g, draw) {
  const L = layer(g.headroom, draw);
  for (let y = g.top; y < k.STAGE_H; y++) for (let x = 0; x < k.W; x++) {
    if (L.get(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => L.get(x + u, y + v))) g.put(x, y, null);
  }
  k.blit(g, L);
  return L;
}

module.exports = { layer, inFront, blitRotated, tumble, clearEyes, eyesX, eyesSquint, firework, alertFlash };
