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
 * wide behind the tint → loop: he grips the wheel, the car bounces, bats
 * swarm round his head, "BAT COUNTRY" → the bats are gone, a long relieved
 * puff of smoke → poof → idle.
 *
 * Usage: node movies/bat_country.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props_m1');
const { C } = k;

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

// The driver at the wheel: car seat, him ('point': hand on the wheel),
// the car over his lower half. by bounces the whole car.
function drive(g, t, { by = 0, eyes = null, smoke = 0 } = {}) {
  m.desert(g, t);
  m.carBack(g, 0, by);
  const P = k.clawd(g, 'point', { dx: -3, dy: by - 4, eyes, over: dressed({ smoke }) });
  m.carFront(g, 0, by, { spin: t });
  return P;
}

// Three bats circling his head; f = 0..3 goes a quarter of the way round.
function bats(g, f, n = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 2 * (f / 4 + i / 3) + 0.4;
    m.bat(g, Math.round(27 + 21 * Math.cos(a)), Math.round(12 + 3 * Math.sin(a)), (f + i) % 2);
  }
}

const CAP = (g) => k.caption(g, 'BAT COUNTRY', 27, 2, C.ivory, { align: 'center', shadow: C.charcoal });

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puff = (g, ph) => {
  k.poof(g, P0.centre.x, P0.centre.y - 3, ph);
  k.poof(g, 9, 29, ph, { scale: 0.45 });
  k.poof(g, 44, 29, ph, { scale: 0.45 });
};

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: dressed, at the wheel, in the desert.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { drive(g, 0); puff(g, 1); });
sc.frame(100, g => { drive(g, 1); puff(g, 2); });
sc.frame(90, g => { drive(g, 2); puff(g, 3); });

// Cruising. A bat flaps in. Eyes go wide.
let t = 3;
sc.frame(380, g => drive(g, t++, { smoke: 1 }));
sc.frame(220, g => { drive(g, t++, { by: -1, smoke: 2 }); m.bat(g, 48, 9, 0); });
sc.frame(300, g => { drive(g, t++, { eyes: 'wide' }); m.bat(g, 40, 12, 1); k.exclaim(g, 12, 10, C.gold); });

// Loop: gripping the wheel, the car bouncing, bats everywhere.
sc.loopStart();
for (let f = 0; f < 4; f++)
  sc.frame(170, g => { drive(g, t++, { by: f % 2 ? -1 : 0, eyes: 'wide' }); bats(g, f); CAP(g); });
sc.loopEnd();

// They're gone. A long, relieved puff of smoke.
sc.frame(260, g => { drive(g, t++, { eyes: 'wide' }); m.bat(g, 49, 6, 1); });
sc.frame(520, g => { drive(g, t++, { eyes: 'closed', smoke: 2 }); m.exhaust(g, 41, 7, 2); });

// Poof off.
sc.frame(90, g => { drive(g, t++); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
