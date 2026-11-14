#!/usr/bin/env node
/**
 * "Zed's dead": made for this fork, AI-drawn with the originals kit.
 * References the chopper getaway at the end of a 1994 crime film: slicked
 * hair, a leather jacket, a low chopper with ape-hanger bars, and the
 * two-word line as a caption. Caricature only, no likeness, no logos.
 *
 * Story: idle → poof (hair, jacket; a chopper poofs in behind him) → he hops
 * on, grips the bars → loop: revs (exhaust puffs, "ZED'S DEAD"), rides off
 * to the right and comes back round from the left, brakes → kills the
 * engine, hops off → poof → idle.
 *
 * Usage: node movies/zeds_dead.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props_m1');
const { C } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-ZedsDead.gif', name: "zed's dead", mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: "The chopper getaway from Pulp Fiction (1994): slicked-back hair, leather jacket, a raked chopper with ape-hanger bars, and the line \"Zed's dead\" as a two-word caption.",
});

// ── Costume ──────────────────────────────────────────────────────────────────

const dressed = (g, P) => { k.leatherJacket(g, P); k.slick(g, P); };
const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: dressed });

// The rider on the bike: bike back, him in the 'point' pose (hands on the
// grips), bike front over his legs. bx shifts the whole rig, by bounces it.
// Clipped to columns 2..52 so the ride-off keeps the frame narrow.
function rig(g, bx = 0, by = 0, { spin = 0, eyes = null } = {}) {
  return m.layer(g, L => {
    m.chopperBack(L, bx, by, { spin });
    const P = him(L, 'point', { dx: bx, dy: by - 4, eyes });
    m.chopperFront(L, bx, by, { spin });
    return P;
  }, m.clipX(2, 52));
}
// The bike parked, with nobody on it (drawn behind him).
const parked = (g) => { m.chopperBack(g); m.chopperFront(g); };

const CAP = (g, c = C.ivory) => k.caption(g, "ZED'S DEAD", 27, 7, c, { align: 'center', shadow: C.charcoal });

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puff = (g, ph) => {
  k.poof(g, P0.centre.x, P0.centre.y - 3, ph);
  k.poof(g, 10, 29, ph, { scale: 0.45 });
  k.poof(g, 43, 29, ph, { scale: 0.45 });
};

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: jacket and hair; the chopper appears behind him.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { parked(g); him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { parked(g); him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { parked(g); him(g, 'idle'); puff(g, 3); });

// He glances back at it, hops on, grips the bars.
sc.frame(380, g => { parked(g); him(g, 'idle', { eyes: 'right' }); });
sc.frame(130, g => { parked(g); him(g, 'jump_crouch'); });
sc.frame(150, g => { parked(g); him(g, 'jump_top'); k.motionLines(g, 22, 28, { dir: 'down', len: 3, count: 3, gap: 4 }); });
sc.frame(260, g => { rig(g, 0, 1); k.dust(g, 26, 36, 0); });

// Loop: rev, rev, ride off right, come round from the left, brake.
sc.loopStart();
sc.frame(130, g => { rig(g, 0, 0); m.exhaust(g, 5, 30, 2); });
sc.frame(130, g => { rig(g, 0, -1); m.exhaust(g, 5, 26, 3); m.exhaust(g, 6, 31, 1); CAP(g); });
sc.frame(520, g => { rig(g, 0, 0, { eyes: 'happy' }); m.exhaust(g, 5, 30, 2); m.exhaust(g, 4, 23, 2); CAP(g); });
sc.frame(110, g => { rig(g, 14, 0, { spin: 1 }); k.motionLines(g, 10, 22, { dir: 'left', len: 5, count: 3, gap: 4 }); m.exhaust(g, 6, 31, 3); m.exhaust(g, 4, 26, 1); });
sc.frame(110, g => { rig(g, 32, 0, { spin: 0 }); k.motionLines(g, 28, 22, { dir: 'left', len: 6, count: 3, gap: 4 }); m.exhaust(g, 14, 31, 2); m.exhaust(g, 6, 29, 1); });
sc.frame(110, g => { rig(g, -34, 0, { spin: 1 }); k.motionLines(g, 14, 22, { dir: 'left', len: 5, count: 3, gap: 4 }); });
sc.frame(110, g => { rig(g, -15, 0, { spin: 0 }); k.motionLines(g, 6, 22, { dir: 'left', len: 4, count: 3, gap: 4 }); });
sc.frame(200, g => { rig(g, 0, 1, { spin: 1 }); k.dust(g, 12, 36, 1, { dir: -1 }); k.dust(g, 47, 36, 0, { dir: 1 }); });
sc.loopEnd();

// Kills the engine, pleased; hops off.
sc.frame(380, g => rig(g, 0, 0, { eyes: 'closed' }));
sc.frame(150, g => { parked(g); him(g, 'jump_top'); });
sc.frame(300, g => { parked(g); him(g, 'idle', { eyes: 'happy' }); });

// Poof off.
sc.frame(90, g => { parked(g); him(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
