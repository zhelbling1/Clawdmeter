#!/usr/bin/env node
/**
 * "King of the world": made for this fork, AI-drawn with the originals kit.
 * References the ship's-bow scene from a 1997 ocean-liner romance: floppy
 * blond hair whipped by the wind, an open white shirt and braces, arms flung
 * wide at the very front of the ship over the sea. Caricature only, no
 * likeness, no logos, no quote.
 *
 * Story: idle → poof (hair, shirt, braces; the ship's bow rises around him)
 * → he steps up onto the rail and flings his arms wide (loop: wind streams
 * his hair, spray at the bow, a gull sails past) → the gull lands on his
 * head; he looks up, delighted → poof → idle.
 *
 * Usage: node movies/king_of_the_world.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, line, put } = k;
const m2 = require('./props_m2');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-KingOfTheWorld.gif', name: 'king of the world', mood: 'calm', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The arms-wide moment at the bow of the ship in Titanic (1997): floppy blond hair in the wind, open white shirt and braces, sea spray, a passing gull.',
});

// ── Props ────────────────────────────────────────────────────────────────────

// The bow, seen side-on, pointing right: the hull's top edge rises toward
// the stem; a white rail runs above it. Covers his legs (he stands on deck).
const topEdge = (x) => Math.round(33 - (x / 53) * 4);
const stemX = (y) => Math.round(53 - (y - 29) * 0.9);
function ship(g) {
  for (let x = 1; x <= 53; x++) for (let y = topEdge(x); y <= 36; y++) {
    if (x > stemX(y)) continue;
    put(g, x, y, y >= 36 ? C.red : C.charcoal);
  }
  // Rail and posts.
  for (let x = 1; x <= 52; x++) put(g, x, topEdge(x) - 3, C.ivory);
  for (let x = 3; x <= 51; x += 6) rect(g, x, topEdge(x) - 2, x, topEdge(x) - 1, C.ivory);
  // Portholes.
  for (const x of [8, 44]) put(g, x, topEdge(x) + 3, C.glow);
}

// The sea at the stem: a cresting bow wave and spray; phase 0..2.
function sea(g, phase = 0) {
  const o = phase % 3;
  for (let x = 1; x <= 53; x++) {
    const crest = (x + o * 2) % 6 < 2;
    if (x > stemX(36)) put(g, x, 36, C.blue);
    if (x > stemX(35) && crest) put(g, x, 35, C.blue);
  }
  // Spray off the stem.
  const sp = [[[51, 31], [53, 30], [52, 33]], [[52, 30], [53, 32], [51, 32]], [[53, 29], [51, 31], [53, 33]]][o];
  for (const [x, y] of sp) put(g, x, y, C.sky);
  put(g, stemX(34) + 1, 34, C.sky); put(g, stemX(35) + 2, 35, C.ivory);
}

// Wind streaks flying past (right to left); phase shifts them.
function wind(g, phase) {
  const rows = [[12, 6, 4], [18, 40, 5], [24, 10, 3], [15, 46, 3]];
  for (const [y, x0, len] of rows) {
    const x = ((x0 - phase * 7) % 52 + 52) % 52 + 1;
    line(g, x, y, Math.min(53, x + len - 1), y, C.gray);
  }
}

// ── Costume ──────────────────────────────────────────────────────────────────

function outfit({ windy = 0, phase = 0 } = {}) {
  return (g, P) => {
    k.jacket(g, P, { c: C.ivory, dark: C.gray, shirt: C.body });
    const m = k.midCol(P);
    for (const x of [m - 4, m + 5]) for (let y = P.chin; y <= P.waist; y++) k.onBody(g, P, x, y, C.brown);   // braces
    m2.floppyHair(g, P, { c: C.gold, dark: C.amber, wind: windy, phase });
    m2.armsOver(g, P);
    m2.eyesOnTop(g, P);
  };
}
const him = (g, pose, opts = {}) => {
  const { windy, phase, ...rest } = opts;
  return k.clawd(g, pose, { ...rest, over: outfit({ windy, phase }) });
};

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const scene = (g, ph = 0) => { ship(g); sea(g, ph); };
const puffs = [[P0.centre.x, P0.centre.y - 4], [8, 32, { scale: 0.6 }], [46, 31, { scale: 0.6 }]];
m2.idleIntro(sc);
m2.poofSwap(sc, g => k.clawd(g, 'idle'), g => { him(g, 'idle', { windy: 1 }); scene(g); }, puffs);

// He looks out to sea, steps up, flings his arms wide.
sc.frame(420, g => { wind(g, 0); him(g, 'idle', { eyes: 'right', windy: 1 }); scene(g, 1); });
sc.frame(150, g => { wind(g, 1); him(g, 'crouch', { windy: 1 }); scene(g, 2); });
sc.frame(200, g => { wind(g, 2); him(g, 'idle', { dy: -3, eyes: 'wide', windy: 2, phase: 1 }); scene(g, 0); });

// Loop: arms wide, eyes shut in bliss, wind and spray; a gull sails past.
sc.loopStart();
const GULL = [[50, 12, 'up'], [43, 10, 'flat'], [36, 11, 'down'], [29, 9, 'up'], [22, 10, 'flat'], [15, 11, 'down']];
GULL.forEach(([gx, gy, w], i) => sc.frame(150, g => {
  wind(g, i + 3);
  him(g, 'idle', { dy: -3, eyes: i === 2 ? 'wide' : 'happy', windy: 2, phase: i });
  scene(g, i);
  m2.gull(g, gx, gy, w, { flip: true });
}));
sc.loopEnd();

// The gull circles back and lands on his head. He looks up, delighted.
sc.frame(160, g => { him(g, 'idle', { dy: -3, eyes: 'up', windy: 2 }); scene(g, 0); m2.gull(g, 34, 9, 'up', { flip: true }); });
sc.frame(160, g => { const P = him(g, 'idle', { eyes: 'up', windy: 1 }); scene(g, 1); m2.gull(g, 29, 13, 'down', { flip: true }); });
sc.frame(560, g => { const P = him(g, 'idle', { eyes: 'up', windy: 1 }); scene(g, 2); perched(g, P); });
sc.frame(420, g => { const P = him(g, 'idle', { eyes: 'happy', windy: 1 }); scene(g, 0); perched(g, P); });

function perched(g, P) {
  // Standing gull on top of his hair: body, folded wing, beak, little legs.
  const x = Math.floor(P.head.cx) + 1, y = P.head.top - 4;
  rect(g, x - 2, y - 1, x + 1, y, C.ivory);
  rect(g, x - 1, y - 3, x, y - 2, C.ivory);
  put(g, x - 2, y - 2, C.gold);
  rect(g, x, y - 1, x + 2, y - 1, C.gray);
  put(g, x - 1, y - 3, C.eye);
  put(g, x - 1, y + 1, C.gold); put(g, x, y + 1, C.gold);
}

// Poof off (the ship goes too).
m2.poofSwap(sc, g => { const P = him(g, 'idle', { windy: 1 }); scene(g); perched(g, P); }, g => k.clawd(g, 'idle'), puffs);
m2.idleOutro(sc);

sc.finish();
