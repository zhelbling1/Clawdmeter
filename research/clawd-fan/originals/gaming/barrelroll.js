#!/usr/bin/env node
/**
 * "Do a barrel roll": made for this fork, AI-drawn with the originals kit.
 * References the 1997 space-shooter catchphrase: told to barrel roll, he
 * turns into a little starfighter and does it. Generic ship, no copied
 * ships or characters, no logos.
 *
 * The ship IS Clawd: his official idle frame turned on its side (one
 * cell-exact 90° rotation), so his body is the orange fuselage, his eyes
 * look out of the front, his arm nubs are the fins and his four legs are
 * four engine nozzles, each with its own flame. Drawn around him: a nose
 * cone, a canopy bubble, swept wing roots, wingtip cannons.
 *
 * Story: idle → "DO A BARREL ROLL!" → a determined nod → poof → the ship,
 * stars streaking past → loop: cruise, then a full roll (the ship turns over
 * through edge-on and back, the helix trail spiralling off the wingtips) →
 * poof → idle.
 *
 * The roll is a vertical squash and flip of the whole ship (Clawd's cells
 * resampled as one block, like the rotation): cos 0° … 180° … 360°, with
 * the canopy on top, then underneath, then on top again.
 *
 * Usage: node gaming/barrelroll.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, line, put, tri, caption } = k;
const { layer, blitRotated } = require('./props');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-BarrelRoll.gif', name: 'barrel roll', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Star Fox 64 (1997): the "Do a barrel roll!" catchphrase. He turns into a generic Clawd-shaped starfighter (his own body as the fuselage, legs as engines) and rolls; no ships or characters copied.',
});

// ── The ship ─────────────────────────────────────────────────────────────────

// Clawd's idle frame turned 90° clockwise and lifted 6 rows: head to the
// right (the front), legs to the left (the engines). Fuselage rows 15..30,
// fins (his arms) x 27..30 up to row 11 and down to row 34, eyes at
// x 31..32, engine legs x 19..22 on rows 15-16, 19-20, 25-26, 29-30.
const SHIP_CY = 22.5;
const LEGS = [15, 19, 25, 29];

function ship(flame = 0) {
  const src = layer(0, h => k.clawd(h, 'idle'));
  return layer(0, g => {
    // Swept wing roots: steel fillets from each fin back along the hull.
    for (const s of [-1, 1]) {
      const y = (r) => Math.round(SHIP_CY + s * r);
      tri(g, [26, y(11.5)], [26, y(7.5)], [19, y(7.5)], C.steel);
      line(g, 20, y(7.5), 26, y(7.5), C.slate);
      // Wingtip cannon: a barrel forward off each fin tip, a red muzzle.
      line(g, 31, y(10.5), 35, y(10.5), C.slate);
      put(g, 36, y(10.5), C.red);
    }
    blitRotated(g, src, 90, 26.5, 28.5, { dy: -6 });
    // Nose cone off the front (his head top), ivory over a steel underside.
    for (let x = 35; x <= 43; x++) {
      const half = Math.max(0, 7.5 - (x - 35) * 0.95);
      for (let y = Math.ceil(SHIP_CY - half); y <= Math.floor(SHIP_CY + half); y++)
        put(g, x, y, y > SHIP_CY + 1 ? C.steel : C.ivory);
    }
    rect(g, 35, 15, 35, 30, C.slate);                       // the seam
    put(g, 44, 22, C.red); put(g, 44, 23, C.red);           // tip light
    // Canopy bubble on top, behind the fin: the asymmetry that shows the roll.
    rect(g, 31, 13, 34, 14, C.sky); rect(g, 32, 12, 33, 12, C.sky); put(g, 32, 13, C.ivory);
    // Engine flames out of each leg, flickering.
    LEGS.forEach((y, i) => {
      const len = [5, 3, 4, 6][(i + flame) % 4];
      rect(g, 18 - len + 1, y, 18, y + 1, C.gold);
      rect(g, 18 - len + 3, y, 18, y + 1, C.glow);
      put(g, 18 - len, y + ((i + flame) % 2), C.ginger);
    });
  });
}
const SHIPS = [ship(0), ship(1)];

// The ship with its roll factor s (1 upright, -1 upside down, small =
// edge-on) and a vertical offset dy (the barrel roll's corkscrew).
function drawShip(g, flame, s = 1, dy = 0) {
  const L = SHIPS[flame % 2];
  for (let y = 0; y < k.STAGE_H; y++) {
    const sy = Math.round(SHIP_CY + (y - SHIP_CY - dy) / s);
    if (sy < 0 || sy >= k.STAGE_H) continue;
    for (let x = 0; x < k.W; x++) { const c = L.get(x, sy); if (c) g.put(x, y, c); }
  }
}

// Stars streaking past to the left: two speeds; the loop (10 frames) moves
// every star a whole number of laps across x 6..45, so it joins.
const STARS = [[8, 3, 1], [30, 6, 2], [17, 9, 1], [41, 12, 2], [12, 33, 2], [36, 35, 1], [24, 2, 2], [44, 31, 1],
  [6, 18, 1], [47, 26, 2]];
function stars(g, t) {
  for (const [x0, y, sp] of STARS) {
    const v = sp * 4, x = 6 + (((x0 - 6 - t * v) % 40) + 40) % 40;
    put(g, x, y, sp === 2 ? C.ivory : C.gray);
    if (t >= 0) line(g, x + 1, y, x + (sp === 2 ? 4 : 2), y, sp === 2 ? C.gray : C.slate);
  }
}

// The corkscrew trail off both wingtips while rolling: each strand is where
// a wingtip was a moment ago (further back = earlier in the roll), joined
// up; the half of the turn nearer the viewer is bright.
function helix(g, phase, dy, len = 21) {
  for (const off of [0, 180]) {
    let prev = null;
    for (let i = 0; i <= len; i++) {
      const a = (phase + off - i * 11) * Math.PI / 180;
      const p = [27 - i, Math.round(SHIP_CY + dy * Math.max(0, 1 - i / 10) - 11 * Math.cos(a))];
      if (prev) line(g, prev[0], prev[1], p[0], p[1], Math.sin(a) > 0 ? C.ivory : C.gray);
      prev = p;
    }
  }
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 4, ph);
const order = (g, c) => { caption(g, 'DO A', 26.5, 0, c, { align: 'center' }); caption(g, 'BARREL ROLL!', 26.5, 6, c, { align: 'center' }); };

// Idle bookend; the order comes in.
sc.frame(450, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(700, g => { k.clawd(g, 'idle', { eyes: 'up' }); order(g, C.ivory); });
sc.frame(220, g => { k.clawd(g, 'crouch', { eyes: 'happy' }); order(g, C.gray); });

// Poof: he becomes the ship, and space arrives with him.
sc.frame(90, g => { k.clawd(g, 'crouch'); puff(g, 0); });
sc.frame(110, g => { drawShip(g, 0); puff(g, 1); });
sc.frame(100, g => { stars(g, -2); drawShip(g, 1); puff(g, 2); });
sc.frame(90, g => { stars(g, -1); drawShip(g, 0); puff(g, 3); });

// Loop: cruise, then the barrel roll (eight 45° steps).
sc.loopStart();
let t = 0;
for (let i = 0; i < 2; i++, t++) sc.frame(150, g => { stars(g, t); drawShip(g, t); });
for (let i = 0; i < 8; i++, t++) {
  const deg = i * 45, rad = deg * Math.PI / 180;
  let s = Math.cos(rad);
  if (Math.abs(s) < 0.3) s = 0.3 * (deg < 180 ? -1 : 1);   // edge-on: turning over
  const dy = Math.round(-3 * Math.sin(rad));
  sc.frame(80, g => { stars(g, t); if (i) helix(g, deg, dy); drawShip(g, t, s, dy); });
}
sc.loopEnd();

// Poof back into Clawd, pleased.
sc.frame(160, g => { stars(g, t); drawShip(g, t); });
sc.frame(90, g => { stars(g, t + 1); drawShip(g, t + 1); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle', { eyes: 'happy' }); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle', { eyes: 'happy' }); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle', { eyes: 'happy' }); puff(g, 3); });
sc.frame(350, g => k.clawd(g, 'idle', { eyes: 'happy' }));
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
