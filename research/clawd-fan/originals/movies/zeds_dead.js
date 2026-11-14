#!/usr/bin/env node
/**
 * "Zed's dead": made for this fork, AI-drawn with the originals kit.
 * References the chopper getaway at the end of a 1994 crime film: slicked
 * hair, a leather jacket, a low chopper with ape-hanger bars, and the
 * two-word line as a caption. Caricature only, no likeness, no logos.
 *
 * Story: idle → poof (hair, jacket; a chopper poofs in behind him) → he hops
 * on, grips the bars, revs → "ZED'S DEAD" (once) → he pulls away → loop: a
 * calm cruise (road dashes and wind streaks slide past, wheels turn, the
 * frame bobs on its springs, exhaust drifts back) → he guns it off to the
 * right, swings back in from the left, skids to a stop, hops off → poof →
 * idle.
 *
 * The loop holds nothing that happens once: the caption and the ride-off
 * play a single time, so the 16 s a show spends in the loop is just the
 * ride.
 *
 * Usage: node movies/zeds_dead.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props_m1');
const { C, rect, put } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-ZedsDead.gif', name: "zed's dead", mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: "The chopper getaway from Pulp Fiction (1994): slicked-back hair, leather jacket, a raked chopper with ape-hanger bars, and the line \"Zed's dead\" as a two-word caption.",
});

// ── Costume ──────────────────────────────────────────────────────────────────

const dressed = (g, P) => { k.leatherJacket(g, P); k.slick(g, P); };
const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: dressed });

// The rider on the bike: bike back, him in the 'point' pose (hands on the
// grips), bike front over his legs. bx shifts the whole rig, by bobs the
// frame and rider (wy, default by, the wheels). Clipped to columns 2..52 so
// the ride-off keeps the frame narrow.
function rig(g, bx = 0, by = 0, { spin = 0, eyes = null, wy = by } = {}) {
  return m.layer(g, L => {
    m.chopperBack(L, bx, by, { spin, wy });
    const P = him(L, 'point', { dx: bx, dy: by - 4, eyes });
    m.chopperFront(L, bx, by, { spin, wy });
    return P;
  }, m.clipX(2, 52));
}
// The bike parked, with nobody on it (drawn behind him).
const parked = (g) => { road(g, 0); m.chopperBack(g); m.chopperFront(g); };

const CAP = (g, c = C.ivory) => k.caption(g, "ZED'S DEAD", 27, 8, c, { align: 'center', shadow: C.charcoal });

// ── The cruise (the loop) ────────────────────────────────────────────────────

// Everything that scrolls repeats every 4 frames, so the loop is seamless.
const STEPS = 4;
// Road: dashes on the floor row (it arrives with the bike), sliding left 2
// cells a frame while he rides (period 8).
function road(g, f) {
  for (let x = 2; x <= 52; x++) if (((x + 2 * f) % 8 + 8) % 8 < 4) put(g, x, 36, C.gray);
}
// Wind streaks in the open air ahead of and behind him, 3 cells a frame
// (period 12): short slate lines that slide back past the rig.
function wind(g, f) {
  for (const [y, left, ph] of [[13, 1, 0], [17, 1, 6], [11, 0, 3], [15, 0, 9]]) {
    const span = left ? [2, 9] : [44, 52];
    const head = span[1] - (((3 * f + ph) % 12) + 12) % 12;
    if (head >= span[0] && head + 3 <= span[1]) rect(g, head, y, head + 3, y, C.slate);   // whole streaks only
  }
}
// Exhaust: puffs leave the pipes (x 5, y 27) every other frame and drift
// back and up, thinning out.
function trail(g, f) {
  const path = [[5, 27, 2], [4, 25, 2], [3, 23, 1], [3, 21, 1]];
  for (const age of [f, (f + 2) % STEPS]) { const [x, y, s] = path[age]; m.exhaust(g, x, y, s); }
}
function cruise(g, f) {
  road(g, f);
  wind(g, f);
  const bob = [0, -1, -1, 0][f];                  // the frame rides its springs
  rig(g, 0, bob, { spin: f % 2, wy: 0 });
  trail(g, f);
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puff = (g, ph) => {
  k.poof(g, P0.centre.x, P0.centre.y - 3, ph);
  k.poof(g, 10, 29, ph, { scale: 0.45 });
  k.poof(g, 43, 29, ph, { scale: 0.45 });
};

// Idle bookend.
sc.frame(560, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));

// Poof on: jacket and hair; the chopper appears behind him.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { parked(g); him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { parked(g); him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { parked(g); him(g, 'idle'); puff(g, 3); });

// He glances back at it, hops on, grips the bars.
sc.frame(380, g => { parked(g); him(g, 'idle', { eyes: 'right' }); });
sc.frame(130, g => { parked(g); him(g, 'jump_crouch'); });
sc.frame(150, g => { parked(g); him(g, 'jump_top', { dy: 2 }); k.motionLines(g, 22, 30, { dir: 'down', len: 3, count: 3, gap: 4 }); });
sc.frame(240, g => { road(g, 0); rig(g, 0, 1); k.dust(g, 26, 36, 0); });

// Revs it, then the line, once.
sc.frame(160, g => { road(g, 0); rig(g, 0, -1, { wy: 0 }); m.exhaust(g, 5, 27, 3); m.exhaust(g, 6, 31, 1); });
sc.frame(1150, g => { road(g, 0); rig(g, 0, 0); m.exhaust(g, 3, 24, 2); CAP(g); });

// Loop: the cruise.
sc.loopStart();
for (let f = 0; f < STEPS; f++) sc.frame(140, g => cruise(g, f));
sc.loopEnd();

// He guns it off to the right, swings back in from the left, skids.
sc.frame(110, g => { road(g, 0); rig(g, 15, 0, { spin: 1, wy: 0 }); k.motionLines(g, 11, 21, { dir: 'left', len: 6, count: 3, gap: 4 }); m.exhaust(g, 9, 27, 3); });
sc.frame(110, g => { road(g, 0); rig(g, 34, 0, { spin: 0, wy: 0 }); k.motionLines(g, 30, 21, { dir: 'left', len: 7, count: 3, gap: 4 }); m.exhaust(g, 20, 27, 2); m.exhaust(g, 10, 26, 1); });
sc.frame(120, g => { road(g, 0); rig(g, -14, 0, { spin: 1, wy: 0 }); k.motionLines(g, 8, 21, { dir: 'left', len: 5, count: 3, gap: 4 }); });
sc.frame(380, g => { road(g, 0); rig(g, 0, 1, { spin: 0, eyes: 'closed', wy: 0 }); k.dust(g, 9, 35, 1, { dir: -1 }); k.dust(g, 47, 35, 0, { dir: 1 }); });

// Hops off, pleased.
sc.frame(150, g => { parked(g); him(g, 'jump_top', { dy: 2 }); });
sc.frame(320, g => { parked(g); him(g, 'idle', { eyes: 'happy' }); });

// Poof off.
sc.frame(90, g => { parked(g); him(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
