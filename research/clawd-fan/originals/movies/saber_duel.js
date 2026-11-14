#!/usr/bin/env node
/**
 * "Saber duel": made for this fork, AI-drawn with the originals kit.
 * References the cloud-city laser-sword duel from a 1980 space-opera
 * sequel: a farm-boy hero with a blue blade against a dark armoured lord in
 * a black helmet-mask and cape with a red blade. Caricature only: no
 * likeness, no logos, no lines from the film.
 *
 * Story: idle → poof (shaggy hair, fatigues, a hilt) → he sidesteps left; a
 * dark puff on the right leaves an armoured Clawd in a cape → red blade,
 * then blue blade → loop: clash, parry, clash, parry, sparks → they part;
 * the villain lowers his blade and reaches out... "..." (nothing more) →
 * the hero bows → poof → idle.
 *
 * Usage: node movies/saber_duel.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, caption } = k;
const m2 = require('./props_m2');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-SaberDuel.gif', name: 'saber duel', mood: 'heavy', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The laser-sword duel from The Empire Strikes Back (1980): hero with a blue blade, a dark lord in a black helmet-mask, breathing vent and cape with a red blade, the dramatic reach. No lines quoted.',
});

const HX = -14, VX = 14;              // hero / villain shift from the idle spot
const BLUE = { glow: C.blue }, RED = { glow: C.red };

// ── Costumes ─────────────────────────────────────────────────────────────────

// Hero: shaggy blond hair, tan fatigues, dark boots, a belt.
function heroCostume(g, P) {
  k.jumpsuit(g, P, { c: C.tan, dark: C.brown, boots: C.charcoal });
  k.recolour(g, P, (x, y) => y === P.waist, C.brown, C.brown);
  m2.shaggyHair(g, P, { c: C.gold, dark: C.brown });
  m2.armsOver(g, P);
}

// Villain: all-black armour, flared helmet with lenses and a breathing
// grille, a chest box with lights, a belt, and a cape behind.
function villainCostume({ wind = 0, phase = 0, breath = false } = {}) {
  return {
    under: (g, P) => k.cape(g, P, { c: C.charcoal, lining: C.maroon, wind, phase }),
    over: (g, P) => {
      k.recolour(g, P, () => true, C.charcoal, C.charcoal, { eyes: true });
      const m = k.midCol(P);
      // Armour sheen down the chest and on the shoulders.
      k.recolour(g, P, (x, y) => y === P.chin && Math.abs(x - m - 0.5) <= 6.5, C.slate, C.slate);
      const [hx0, hx1] = k.headSpan(P);
      k.recolour(g, P, (x) => x < hx0 || x > hx1, C.slate, C.slate);            // gauntlets
      k.recolour(g, P, (x, y) => y === P.waist, C.slate, C.slate);                // belt
      k.onBody(g, P, m, P.waist, C.steel); k.onBody(g, P, m + 1, P.waist, C.steel);
      // Chest box: three lights.
      rect(g, m - 2, P.chin + 2, m + 3, P.chin + 3, C.slate);
      put(g, m - 1, P.chin + 2, C.red); put(g, m + 1, P.chin + 2, C.blue); put(g, m + 2, P.chin + 3, C.glow);
      k.villainHelmet(g, P, { c: C.charcoal, sheen: C.slate, lens: C.gray, grille: C.steel });
      // Red glint in the lenses.
      for (const e of P.eyes) put(g, e.x, P.eyeY, C.red);
      // A raised arm stays in front of the helmet.
      const arm = new Set(P.cells.filter(c => c[1] < P.head.top).map(c => c[0] + ',' + c[1]));
      for (const key of arm) { const [x, y] = key.split(',').map(Number); put(g, x, y, C.slate); }
      if (breath) {                                       // steam from the vent
        const [x0, x1] = k.headSpan(P), f = P.facing === 'left' ? -1 : 1;
        const bx = f < 0 ? x0 - 4 : x1 + 4;
        put(g, bx, P.eyeY + 1, C.gray); put(g, bx + f, P.eyeY, C.gray); put(g, bx + 2 * f, P.eyeY - 1, C.gray);
      }
    },
  };
}

// The sword grip: the tip of a side arm, or the top of a raised hand.
const grip = (h) => h.dir === 'up' ? [Math.round(h.x), h.y] : [h.x, h.y0];

function hero(g, pose, { blade = null, eyes = null, dx = HX, flip = false } = {}) {
  return k.clawd(g, pose, { dx, flip, eyes, over: [heroCostume, (g2, P) => {
    if (!blade) return;
    m2.saber(g2, ...grip(P.handR), blade[0], blade[1], BLUE);
  }] });
}
function villain(g, pose, { blade = null, dx = VX, wind = 0, phase = 0, breath = false, hand = 'R' } = {}) {
  const v = villainCostume({ wind, phase, breath });
  return k.clawd(g, pose, { dx, flip: true, under: v.under, over: [v.over, (g2, P) => {
    if (!blade) return;
    const h = hand === 'R' ? P.handL : P.handR;        // flipped: his sword hand is on screen left
    m2.saber(g2, ...grip(h), blade[0], blade[1], RED);
  }] });
}

// Where two blades cross (for the spark): segment intersection.
function cross(a, b) {
  const [x1, y1, x2, y2] = a, [x3, y3, x4, y4] = b;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  return [Math.round(x1 + t * (x2 - x1)), Math.round(y1 + t * (y2 - y1))];
}
const seg = (x, y, deg, len) => [x, y, x + Math.cos(deg * Math.PI / 180) * (len + 2), y + Math.sin(deg * Math.PI / 180) * (len + 2)];

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
m2.idleIntro(sc);

// Poof on: hero costume, hilt in hand.
m2.poofSwap(sc, g => k.clawd(g, 'idle'), g => hero(g, 'idle', { dx: 0 }),
  [[P0.centre.x, P0.centre.y - 3]]);

// Sidestep left (crab), clearing the stage.
[[-7, 'crab_2'], [HX, 'crab_6']].forEach(([dx, p]) =>
  sc.frame(130, g => hero(g, p, { dx })));

// A dark puff on the right: the villain.
const VP = k.place('turn', { dx: VX, flip: true });
const dark = { c: C.slate, edge: C.charcoal };
[1, 3].forEach((ph, i) => sc.frame([180, 130][i], g => {
  hero(g, 'turn', { eyes: 'wide' });
  if (ph > 1) villain(g, 'turn', { wind: 1 });
  k.poof(g, VP.centre.x, VP.centre.y - 3, ph, dark);
}));
// Red blade hisses out, then the blue one.
sc.frame(520, g => { hero(g, 'turn', { eyes: 'wide' }); villain(g, 'turn', { blade: [-100, 12], breath: true }); });
sc.frame(400, g => { hero(g, 'turn', { blade: [-80, 12] }); villain(g, 'turn', { blade: [-100, 12] }); });

// Loop: clash, parry, clash, parry.
const L = 13;                          // blade length in the fight
const moves = [
  // [hero pose, hero blade, villain pose, villain blade, hero eyes]
  ['turn', [-60, L], 'wave_2', [165, L], 'wide'],      // he chops down, hero blocks
  ['turn', [-85, L], 'turn', [-95, L], null],          // apart, on guard
  ['wave_2', [15, L], 'turn', [-120, L], null],        // hero chops, he blocks
  ['wave_2', [-30, L], 'wave_2', [-150, L], 'wide'],   // blades locked overhead
];
sc.loopStart();
moves.forEach(([hp, hb, vp, vb, he], i) => sc.frame(i % 2 ? 190 : 150, g => {
  const Ph = hero(g, hp, { blade: hb, eyes: he });
  const Pv = villain(g, vp, { blade: vb, wind: 1 + (i % 2), phase: i, breath: i === 3 });
  const a = seg(...grip(Ph.handR), hb[0], hb[1]), b = seg(...grip(Pv.handL), vb[0], vb[1]);
  const [cx, cy] = cross(a, b);
  if (i !== 1) m2.clash(g, cx, cy, i === 3 ? 0 : 1);
  else { put(g, 26, 14, C.glow); put(g, 27, 17, C.glow); }
}));
sc.loopEnd();

// They part. The villain lowers his blade, reaches out... nothing more.
sc.frame(260, g => { hero(g, 'turn', { blade: [-80, 12], eyes: 'wide' }); villain(g, 'turn', { blade: [115, 10], dx: VX + 1 }); });
sc.frame(560, g => { hero(g, 'turn', { blade: [-80, 12], eyes: 'wide' });
  villain(g, 'point', { blade: [-60, 0], dx: VX + 2, hand: 'L', breath: true }); });
sc.frame(700, g => { hero(g, 'turn', { blade: [-80, 12], eyes: 'wide' });
  villain(g, 'point', { blade: [-60, 0], dx: VX + 2, hand: 'L' });
  caption(g, '...', 41, 3, C.ivory, { align: 'center', scale: 2 }); });
// The hero shrugs it off and bows.
sc.frame(520, g => { hero(g, 'crouch', { eyes: 'happy' }); villain(g, 'point', { blade: [-60, 0], dx: VX + 2, hand: 'L', breath: true }); });

// Poof off: both vanish, Clawd is back on his spot.
const VPe = k.place('point', { dx: VX + 2, flip: true });
m2.poofSwap(sc,
  g => { hero(g, 'idle'); villain(g, 'point', { dx: VX + 2, hand: 'L' }); },
  g => k.clawd(g, 'idle'),
  [[P0.centre.x - 6, P0.centre.y - 3], [VPe.centre.x + 2, VPe.centre.y - 3, dark]]);
m2.idleOutro(sc);

sc.finish();
