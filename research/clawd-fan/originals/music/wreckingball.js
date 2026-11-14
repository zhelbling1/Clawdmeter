#!/usr/bin/env node
/**
 * "Wrecking ball": made for this fork, AI-drawn with the originals kit.
 * References the famous 2013 power-ballad music video: a giant wrecking
 * ball swinging on a chain, ridden by a singer with short platinum hair
 * hugging the chain, one tear. Cartoon only, no likeness, no lyrics, no
 * title. The chain runs up through the headroom rows.
 *
 * Story: idle → poof (platinum crop) → a wrecking ball drops in on its
 * chain → he hops on and hugs the chain → loop: the ball swings across
 * the stage and back, hair whipping, eyes shut, a tear at the far ends →
 * the ball settles, he hops off, ^‿^ → the ball is hauled away → poof →
 * idle.
 *
 * Usage: node music/wreckingball.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props');
const { C, rect, disc, ring } = k;

const H = 11;
const sc = k.scene({
  dir: __dirname, file: 'Clawd-WreckingBall.gif', name: 'wrecking ball', mood: 'heavy', headroom: H,
  credit: m.CREDIT,
  references: 'The 2013 power-ballad music video: a giant wrecking ball on a chain, ridden while hugging the chain; short platinum hair, one tear.',
});

// ── The ball and chain ───────────────────────────────────────────────────────

const R = 10;                      // ball radius: wider than he is
const REST_Y = 26;                 // ball centre at rest (bottom on the floor row 36)
const PIVOT_Y = -70;               // the crane, far above the stage

// Ball centred at (bx, by); the chain runs up toward a pivot above bx0.
function ball(g, bx, by, { bx0 = 26.5 } = {}) {
  const top = by - R;
  // Chain: alternating links, from the top of the headroom to the shackle.
  for (let y = -H; y <= top - 2; y++) {
    const t = (y - PIVOT_Y) / (top - 2 - PIVOT_Y);
    const x = Math.round(bx0 + (bx - bx0) * t - 0.5);
    const link = ((y + 40) % 2) ? C.steel : C.slate;
    g.put(x, y, link); g.put(x + 1, y, (y + 40) % 2 ? C.slate : C.steel);
  }
  // Shackle.
  const sx = Math.round(bx - 0.5);
  rect(g, sx - 1, top - 1, sx + 2, top - 1, C.steel);
  g.put(sx - 1, top, C.steel); g.put(sx + 2, top, C.steel);
  // Ball: dark iron, a highlight crescent, a rim of shade at the bottom.
  disc(g, bx, by, R, C.charcoal);
  for (const [x, y] of [[-7, -3], [-7, -2], [-7, -1], [-6, -4], [-6, -5], [-5, -6], [-4, -6], [-3, -7], [-6, -3], [-5, -5], [-4, -5]])
    g.put(Math.round(bx + x), by + y, C.slate);
  g.put(Math.round(bx - 5), by - 4, C.steel); g.put(Math.round(bx - 4), by - 4, C.steel);
  // A dent of shadow along the bottom right.
  for (const [x, y] of [[6, 6], [7, 5], [5, 7], [8, 3], [8, 4]]) g.put(Math.round(bx + x), by + y, C.eye);
}

// ── Costume ──────────────────────────────────────────────────────────────────

// Platinum crop; `whip` -1 / 1 streams strands that way, 0 none.
function hair(whip = 0) {
  return (g, P) => {
    k.platinum(g, P);
    if (!whip) return;
    const [x0, x1] = k.headSpan(P), t = P.head.top;
    const bx = whip < 0 ? x0 - 1 : x1 + 1;
    for (const [len, dy, c] of [[4, -1, C.cream], [3, 0, C.tan], [5, 1, C.cream]])
      for (let i = 0; i < len; i++) g.put(bx + whip * i, t + dy + (i > 2 ? 1 : 0), c);
  };
}
const him = (g, pose, { whip = 0, tear = false, ...o } = {}) => k.clawd(g, pose, { ...o, over: [hair(whip), (g2, P) => {
  if (tear) { const e = P.eyeR; rect(g2, e.x + 1, e.y + 2, e.x + 1, e.y + 3, C.sky); }
}] });

// Hugging the chain: the raised hands close in round it.
const HUG = m.derive('wb_hug', 'arms_up', { armL: [2, 0], armR: [-2, 0] });
const hugDy = (by) => (by - R + 4) - 36;          // his feet overlap the ball's top

// Ride: ball at offset `s` (-1..1 of the swing), Clawd on top.
const A = 9;
function ride(g, s, { whip = 0, tear = false, eyes = 'closed' } = {}) {
  const bx = 26.5 + A * s, by = REST_Y - Math.round(Math.abs(s) * 1.4);
  ball(g, bx, by);
  him(g, HUG, { dx: Math.round(bx - 26.5), dy: hugDy(by), whip, tear, eyes });
  if (Math.abs(s) > 0.6) k.motionLines(g, s > 0 ? Math.round(bx) - 12 : Math.round(bx) + 12, by - 2,
    { dir: s > 0 ? 'left' : 'right', len: 3, count: 2, gap: 3 });
}

// ── Storyboard ───────────────────────────────────────────────────────────────

m.open(sc, g => him(g, 'idle'), { blink: false });

// The ball drops in from above to his right; he looks up.
sc.frame(200, g => { ball(g, 26.5 + A, 7, { bx0: 26.5 + A }); him(g, 'idle', { eyes: 'up' }); });
sc.frame(220, g => { ball(g, 26.5 + A, REST_Y - 1, { bx0: 26.5 + A }); him(g, 'crouch', { eyes: 'wide' }); });
// Hops on.
sc.frame(200, g => { ball(g, 26.5 + A, REST_Y - 1, { bx0: 26.5 + A }); him(g, 'jump_up', { dx: 7, dy: -14 }); });

// Loop: swing across and back.
sc.loopStart();
const SWING = [[1, 300, 1], [0.45, 120, -1], [-0.45, 120, -1], [-1, 300, 0], [-0.45, 120, 1], [0.45, 120, 1]];
SWING.forEach(([s, ms, whip], i) => sc.frame(ms, g => ride(g, s, { whip: s > 0.9 ? -1 : s < -0.9 ? 1 : whip, tear: Math.abs(s) > 0.9 })));
sc.loopEnd();

// The ball settles in the middle; he hops off, content; the ball is hauled up.
sc.frame(200, g => { ball(g, 26.5 + A, REST_Y - 1, { bx0: 26.5 + A }); him(g, 'jump_top', { dx: 2, dy: -2, eyes: 'happy' }); });
sc.frame(540, g => { ball(g, 26.5 + A, 7, { bx0: 26.5 + A }); him(g, 'idle', { eyes: 'happy' }); });

m.close(sc, g => him(g, 'idle'));

sc.finish();
