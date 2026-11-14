#!/usr/bin/env node
/**
 * "Moon bike": made for this fork, AI-drawn with the originals kit.
 * References the flying-bicycle shot from a 1982 family sci-fi film: a red
 * hoodie, a BMX with a front basket (a blanket bundle in it, nothing more),
 * and the ride across a giant full moon in silhouette. Caricature only, no
 * likeness, no character, no logos.
 *
 * Story: idle → poof (red hoodie; he's on a bike) → he pedals off → a huge
 * full moon rises → loop: he rides back in from the left, lifts off and
 * sails across the moon, dark in silhouette wherever he crosses it, and
 * glides down and out → the moon sets, he rolls back to his spot → poof →
 * idle.
 *
 * The silhouette is the one deliberate exception to "body stays orange":
 * cells of him (and the bike) in front of the moon are drawn dark, the rest
 * of him stays in his normal colours.
 *
 * Usage: node movies/moon_bike.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props_m1');
const { C, put } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-MoonBike.gif', name: 'moon bike', mood: 'calm', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The bicycle flying across the full moon from E.T. the Extra-Terrestrial (1982): red hoodie, a BMX with a front basket and a blanket bundle, the silhouette against a giant moon. No character is drawn.',
  notes: 'Deliberate exception to the orange-body rule: while he crosses the moon, the cells of him in front of it are drawn as a dark silhouette; everywhere else he keeps his normal colours.',
});

// ── Costume and rig ──────────────────────────────────────────────────────────

const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: m.hoodie });
const SIL = C.charcoal;                     // the silhouette colour

// The moon: centre and radius (null = not up).
const MOON = { cx: 27, cy: 18, r: 15 };
const inMoon = (x, y, mo) => mo && (x - mo.cx) ** 2 + (y - mo.cy) ** 2 <= (mo.r - 0.25) ** 2 + 0.5;

// Rider + bike. step 0..4 picks the walk-cycle pose (his legs pedal) and the
// crank angle. Cells over the moon `mo` go dark. Clipped to columns 3..51.
const walk = k.CYCLES.walk.map(([p]) => p);
function rig(g, bx, by, step, { mo = null, eyes = null } = {}) {
  return m.layer(g, L => {
    m.bikeBack(L, bx, by, { spin: step });
    const P = him(L, walk[step % walk.length], { dx: bx, dy: by - 3, eyes });
    m.bikeFront(L, bx, by, { spin: step, crank: step });
    return P;
  }, (x, y, c) => (x < 3 || x > 51 ? null : inMoon(x, y, mo) ? SIL : c));
}

function sky(g, mo, { stars = true } = {}) {
  if (stars) for (const [x, y] of [[6, 8], [47, 5], [49, 17], [7, 21], [45, 26]]) put(g, x, y, C.ivory);
  if (mo) m.moon(g, mo.cx, mo.cy, mo.r);
}
// The moon low on the horizon (rising / setting): only rows above the floor.
const LOW = { cx: 27, cy: 32, r: 15 };

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puff = (g, ph) => {
  k.poof(g, P0.centre.x, P0.centre.y - 3, ph);
  k.poof(g, 43, 27, ph, { scale: 0.45 });
};

// Idle bookend.
sc.frame(600, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: hoodie; he's sitting on a bike with a basket.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { rig(g, 0, 0, 0); puff(g, 1); });
sc.frame(100, g => { rig(g, 0, 0, 0); puff(g, 2); });
sc.frame(90, g => { rig(g, 0, 0, 0); puff(g, 3); });
sc.frame(450, g => rig(g, 0, 0, 0, { eyes: 'up' }));

// He pedals off to the right; the moon comes up.
sc.frame(220, g => { sky(g, LOW); rig(g, 20, 0, 1, { mo: LOW }); });
sc.frame(400, g => sky(g, MOON));

// Loop: back in from the left, up into the air, across the moon, down
// and out to the right.
sc.loopStart();
const path = [[-32, 0], [-21, -3], [-10, -7], [1, -9], [12, -8], [23, -5], [34, -2]];
path.forEach(([bx, by], i) => sc.frame(i === 3 ? 380 : 220, g => {
  sky(g, MOON);
  rig(g, bx, by, i, { mo: MOON });
}));
sc.loopEnd();

// The moon sets; he rolls back to his spot.
sc.frame(240, g => { sky(g, LOW); rig(g, -12, 0, 3, { mo: LOW }); });
sc.frame(450, g => rig(g, 0, 0, 0, { eyes: 'happy' }));

// Poof off.
sc.frame(90, g => { rig(g, 0, 0, 0); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
