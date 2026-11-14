#!/usr/bin/env node
/**
 * "Bat country": made for this fork, AI-drawn with the originals kit.
 * References the desert-drive opening of a 1998 road-trip film: bucket hat,
 * tinted aviators, a long cigarette holder, a loud Hawaiian shirt, a red
 * convertible on a desert road, and cartoon bats swooping round the driver.
 * Caricature only, no likeness, no logos.
 *
 * Story: idle → poof (hat, aviators, holder, shirt; he's at the wheel of a
 * red convertible in the desert) → cruising → a bat flaps in, his eyes go
 * wide behind the tint → loop: he grips the wheel, the car bounces, three
 * bats wheel lazily round him (one swinging back and forth over his hat,
 * one looping on each side), "BAT COUNTRY" → the bats are gone, a long
 * relieved puff of smoke → poof → idle.
 *
 * The bats keep clear of his head, hat and cigarette holder: finish()
 * refuses to build if a bat cell lands on or next to them.
 *
 * Usage: node movies/bat_country.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props_m1');
const { C, put } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-BatCountry.gif', name: 'bat country', mood: 'heavy', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The desert drive from Fear and Loathing in Las Vegas (1998): bucket hat, tinted aviators, cigarette holder, Hawaiian shirt, a red convertible, cartoon bats and the two-word caption "bat country".',
});

// ── Costume ──────────────────────────────────────────────────────────────────

function dressed({ smoke = 0 } = {}) {
  return (g, P) => {
    m.hawaiian(g, P, { c: C.sky, flower: C.red, centre: C.gold });
    k.bucketHat(g, P, { c: C.tan, dark: C.brown });
    m.tintedAviators(g, P);
    const tip = m.cigHolder(g, P, { holder: C.charcoal, cig: C.ivory, ember: C.red });
    // smoke curling up from the tip
    const wisps = [[[1, -1], [0, -2]], [[1, -1], [2, -3], [1, -4]], [[1, -2], [0, -3], [1, -5], [2, -6]]][smoke] || [];
    for (const [u, v] of wisps) k.put(g, tip.x + u, tip.y + v, C.gray);
  };
}

// The road surface: pebbles under the car sliding left 2 cells a frame,
// tiled every 16 cells (eight frames bring them back). The mesas stand
// still on the horizon, far away.
function ground(g, t) {
  m.desert(g, 0, { pebbles: false });
  for (const [px, py] of [[2, 34], [9, 36], [13, 33], [6, 35]])
    for (let x = ((px - 2 * t) % 16 + 16) % 16 + 2; x <= 52; x += 16) put(g, x, py, C.brown);
}

// The driver at the wheel: car seat, him ('point': hand on the wheel),
// the car over his lower half. by bounces the whole car.
const DRIVER = { dx: -3, dy: -4 };
function drive(g, t, { by = 0, eyes = null, smoke = 0 } = {}) {
  ground(g, t);
  m.carBack(g, 0, by);
  const P = k.clawd(g, 'point', { dx: DRIVER.dx, dy: DRIVER.dy + by, eyes, over: dressed({ smoke }) });
  m.carFront(g, 0, by, { spin: t });
  return P;
}

// ── Bats ─────────────────────────────────────────────────────────────────────

// Three bats on slow paths, eight frames round: one swings back and forth
// over the hat (eased like a pendulum), one loops beside the tail fin, one
// beside the windshield. f = 0..7; wings beat every frame.
const LOOP = 8;
const BOUNCE = (f) => (f % 4 === 1 ? -1 : 0);     // the car hits a rut every other beat
function batSpots(f) {
  const th = 2 * Math.PI * f / LOOP;
  const u = 0.5 - 0.5 * Math.cos(th);                       // 0 → 1 → 0, eased
  return [
    [Math.round(16 + 18 * u), 8],
    [Math.round(7 + 1.2 * Math.cos(th + Math.PI)), Math.round(11 + 2 * Math.sin(th + Math.PI))],
    [Math.round(47.6 + 0.8 * Math.cos(-th)), Math.round(10.5 + 2.2 * Math.sin(-th))],
  ];
}
function bats(g, f) {
  batSpots(f).forEach(([x, y], i) => m.bat(g, x, y, (f + i) % 2));
}

// Clearance check: no bat cell on or next to anything of the driver's
// (hat, head, holder, smoke, shirt) or another bat, and none off the stage.
function checkBats() {
  for (let f = 0; f < LOOP; f++) {
    { const by = BOUNCE(f), smoke = 0;
      const body = new k.Canvas(0);
      k.clawd(body, 'point', { dx: DRIVER.dx, dy: DRIVER.dy + by, eyes: 'wide', over: dressed({ smoke }) });
      m.carBack(body, 0, by);
      const near = (x, y) => { for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (body.get(x + u, y + v)) return true; return false; };
      const owner = new Map();
      batSpots(f).forEach(([bx, by2], i) => {
        const L = new k.Canvas(0); m.bat(L, bx, by2, (f + i) % 2);
        for (let y = 0; y < 37; y++) for (let x = 0; x < 55; x++) {
          if (!L.get(x, y)) continue;
          if (near(x, y)) throw new Error(`bat ${i} at frame ${f} touches the driver at (${x},${y})`);
          if (x < 2 || x > 52 || y < 7) throw new Error(`bat ${i} at frame ${f} strays to (${x},${y})`);
          for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
            const o = owner.get((x + u) + ',' + (y + v));
            if (o !== undefined && o !== i) throw new Error(`bats ${o} and ${i} collide at frame ${f}`);
          }
        }
        for (let y = 0; y < 37; y++) for (let x = 0; x < 55; x++) if (L.get(x, y)) owner.set(x + ',' + y, i);
      });
    }
  }
}
checkBats();

const CAP = (g) => k.caption(g, 'BAT COUNTRY', 27, 1, C.ivory, { align: 'center' });

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

// Poof on: dressed, at the wheel, in the desert.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { drive(g, 0); puff(g, 1); });
sc.frame(100, g => { drive(g, 1); puff(g, 2); });
sc.frame(90, g => { drive(g, 2); puff(g, 3); });

// Cruising, a lazy puff. A bat flaps in; eyes go wide.
sc.frame(560, g => { drive(g, 4, { by: -1, smoke: 2 }); m.bat(g, 48, 9, 0); });
sc.frame(340, g => { drive(g, 5, { eyes: 'wide' }); m.bat(g, 47, 11, 1); k.exclaim(g, 10, 10, C.gold); });

// Loop: gripping the wheel, the car bouncing on the ruts, bats wheeling.
sc.loopStart();
for (let f = 0; f < LOOP; f++)
  sc.frame(300, g => { drive(g, 6 + f, { by: BOUNCE(f), eyes: 'wide' }); bats(g, f); CAP(g); });
sc.loopEnd();

// They're gone. A long, relieved puff of smoke.
sc.frame(560, g => { drive(g, 14, { eyes: 'closed', smoke: 2 }); m.exhaust(g, 44, 6, 3); });

// Poof off.
sc.frame(90, g => { drive(g, 15); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
