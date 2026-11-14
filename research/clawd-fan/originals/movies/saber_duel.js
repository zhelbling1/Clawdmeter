#!/usr/bin/env node
/**
 * "Saber duel": made for this fork, AI-drawn with the originals kit.
 * References the cloud-city laser-sword duel from a 1980 space-opera
 * sequel: a farm-boy hero with a blue blade against a dark armoured lord in
 * a black helmet-mask and cape with a red blade. Caricature only: no
 * likeness, no logos, no lines from the film.
 *
 * Staging: the two Clawds hold the far ends of the stage and fight with
 * their sword arms raised, so the middle stays open and every clash
 * happens there, in clear black space. The villain's sword arm is a steel
 * gauntlet with a dark gap around it, so it reads in front of his helmet.
 *
 * Story: idle → poof (shaggy hair, fatigues, a hilt) → he sidesteps left; a
 * dark puff on the right leaves an armoured Clawd in a cape → the red blade
 * hisses up, then the blue one → loop: on guard; the villain lunges and the
 * blades meet high in the middle; the hero thrusts and is parried low; the
 * blades lock overhead; back on guard → they part; the villain lowers his
 * blade and reaches out... "..." (nothing more) → the hero bows → poof →
 * idle.
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
// grille, a chest box with lights, a belt, and a cape behind. His arms are
// gauntlets (slate, steel at the hand), painted after the helmet so they
// stay in front of it; a raised arm gets a one-cell dark gap cut into the
// helmet dome on either side, so it reads against the black.
function villainCostume({ wind = 0, phase = 0, breath = false } = {}) {
  return {
    under: (g, P) => k.cape(g, P, { c: C.charcoal, lining: C.maroon, wind, phase }),
    over: (g, P) => {
      k.recolour(g, P, () => true, C.charcoal, C.charcoal, { eyes: true });
      const m = k.midCol(P);
      // Armour sheen across the chest, a belt with a buckle.
      k.recolour(g, P, (x, y) => y === P.chin && Math.abs(x - m - 0.5) <= 6.5, C.slate, C.slate);
      k.recolour(g, P, (x, y) => y === P.waist, C.slate, C.slate);
      k.onBody(g, P, m, P.waist, C.steel); k.onBody(g, P, m + 1, P.waist, C.steel);
      // Chest box: three lights.
      rect(g, m - 2, P.chin + 2, m + 3, P.chin + 3, C.slate);
      put(g, m - 1, P.chin + 2, C.red); put(g, m + 1, P.chin + 2, C.blue); put(g, m + 2, P.chin + 3, C.glow);
      k.villainHelmet(g, P, { c: C.charcoal, sheen: C.slate, lens: C.gray, grille: C.steel });
      for (const e of P.eyes) put(g, e.x, P.eyeY, C.red);               // red glint in the lenses
      // Arms in front of the helmet.
      const [hx0, hx1] = k.headSpan(P), top = P.head.top;
      const raised = P.cells.filter(([, y]) => y < top);
      for (const [x, y] of raised) {                                    // gap in the dome
        for (const u of [-1, 1]) if (!P.at(x + u, y)) put(g, x + u, y, null);
      }
      const armTop = raised.length ? Math.min(...raised.map(c => c[1])) : 0;
      for (const [x, y] of raised) put(g, x, y, y <= armTop + 1 ? C.steel : C.slate);
      for (const [x, y] of P.cells) {
        if (y < top || y >= P.legTop || (x >= hx0 && x <= hx1)) continue;
        const tip = x < hx0 ? x <= P.handL?.x + 1 : x >= P.handR?.x - 1;
        put(g, x, y, tip ? C.steel : C.slate);
      }
      if (breath) {                                       // steam from the vent
        const [x0, x1] = k.headSpan(P), f = P.facing === 'left' ? -1 : 1;
        const bx = f < 0 ? x0 - 4 : x1 + 4;
        put(g, bx, P.eyeY + 3, C.gray); put(g, bx + f, P.eyeY + 2, C.gray); put(g, bx + 2 * f, P.eyeY + 3, C.gray);
      }
    },
  };
}

// The sword grip: the top of a raised hand, or the tip of a side arm.
const grip = (h) => h.dir === 'up' ? [Math.round(h.x), h.y] : [h.x, h.y0];
const swordHand = (P, side) => side === 'R' ? P.handR : P.handL;
// The angle from a grip to a point (for aiming blades at a clash point).
const aim = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;

// blade: [deg, len] or { at: [x, y], over } (aim at a point, overshoot it).
// hum 0/1 jitters the tip a cell, the blade's flicker.
function drawBlade(g, P, side, blade, style, hum) {
  if (!blade) return null;
  const h = grip(swordHand(P, side));
  let deg, len;
  if (Array.isArray(blade)) [deg, len] = blade;
  else { deg = aim(h, blade.at); len = Math.round(Math.hypot(blade.at[0] - h[0], blade.at[1] - h[1])) + (blade.over ?? 2) - 1; }
  if (len) len += hum ? 1 : 0;
  m2.saber(g, h[0], h[1], deg, len, style);
  return { h, deg, len };
}

function hero(g, pose, { blade = null, eyes = null, dx = HX, hum = 0 } = {}) {
  return k.clawd(g, pose, { dx, eyes, over: [heroCostume, (g2, P) => drawBlade(g2, P, 'R', blade, BLUE, hum)] });
}
function villain(g, pose, { blade = null, dx = VX, wind = 0, phase = 0, breath = false, hand = 'L', hum = 0 } = {}) {
  const v = villainCostume({ wind, phase, breath });
  // Flipped, his sword hand is the screen-left one.
  return k.clawd(g, pose, { dx, flip: true, under: v.under, over: [v.over, (g2, P) => drawBlade(g2, P, hand, blade, RED, hum)] });
}

// ── Storyboard ───────────────────────────────────────────────────────────────

// Positions (dx HX / VX): the hero's raised sword hand is at x 17-19 (his
// body ends at x 20); the villain's side sword hand at x 25-28 (body from
// x 33). Every clash point sits between them, in the open.

const P0 = k.place('idle');
m2.idleIntro(sc);

// Poof on: hero costume, hilt in hand.
m2.poofSwap(sc, g => k.clawd(g, 'idle'), g => hero(g, 'idle', { dx: 0 }),
  [[P0.centre.x, P0.centre.y - 3]]);

// Sidestep left (crab), clearing the stage.
sc.frame(200, g => hero(g, 'crab_2', { dx: -7 }));

// A dark puff on the right: the villain.
const VP = k.place('turn', { dx: VX, flip: true });
const dark = { c: C.slate, edge: C.charcoal };
[1, 3].forEach((ph, i) => sc.frame([180, 130][i], g => {
  hero(g, 'idle', { eyes: 'wide' });
  if (ph > 1) villain(g, 'turn', { wind: 1 });
  k.poof(g, VP.centre.x, VP.centre.y - 3, ph, dark);
}));
// The red blade hisses up, then the blue one answers overhead.
const UP_H = [-90, 7], UP_V = [-90, 10];
sc.frame(520, g => { hero(g, 'idle', { eyes: 'wide' }); villain(g, 'turn', { blade: UP_V, breath: true }); });
sc.frame(400, g => { hero(g, 'wave_2', { blade: UP_H }); villain(g, 'turn', { blade: UP_V, hum: 1 }); });

// Loop: guard; his lunge, blocked high; the hero winds up and leaps in;
// blades locked overhead; they spring apart. Guards are straight up and the
// strikes are at 45 degrees, the angles where a pixel blade stays clean.
sc.loopStart();
const beats = [
  // ms, hero, villain, clash [x, y, phase] or null
  [200, { pose: 'wave_2', blade: [-90, 7] },
        { pose: 'turn', blade: [-90, 10], breath: true }, null],
  [150, { pose: 'wave_1', blade: [-45, 8], eyes: 'wide', hum: 1 },
        { pose: 'point', blade: [-90, 11], dx: VX - 1, wind: 2, phase: 1 }, [24, 12, 0]],
  [150, { pose: 'wave_3', blade: [-135, 7] },
        { pose: 'turn', blade: [-90, 10], phase: 2, hum: 1 }, null],
  [260, { pose: 'wave_reach', blade: [-45, 7], dx: HX + 1, hum: 1 },
        { pose: 'point_1', blade: [-90, 12], wind: 2, phase: 3, breath: true }, [26, 12, 0]],
  [170, { pose: 'wave_2', blade: [-90, 7], eyes: 'wide', hum: 1 },
        { pose: 'turn', blade: [-90, 10], hum: 1, wind: 1, phase: 0 }, [26, 12, 2]],
];
beats.forEach(([ms, h, v, cl]) => sc.frame(ms, g => {
  hero(g, h.pose, h);
  villain(g, v.pose, v);
  if (cl && cl[2] < 2) m2.clash(g, cl[0], cl[1], cl[2]);
  else if (cl) for (const [u, w] of [[-3, -2], [3, -3], [-2, 3], [4, 1]]) put(g, cl[0] + u, cl[1] + w, C.glow);
}));
sc.loopEnd();

// They part. The villain lowers his blade and reaches out... nothing more.
const REACH = { blade: [120, 0], hand: 'R' };          // blade unlit in the back hand
sc.frame(560, g => { hero(g, 'wave_2', { blade: UP_H, eyes: 'wide', hum: 1 }); villain(g, 'point', { ...REACH, breath: true }); });
sc.frame(700, g => { hero(g, 'wave_2', { blade: UP_H, eyes: 'wide' });
  villain(g, 'point', REACH);
  caption(g, '...', 40, 8, C.ivory, { align: 'center', scale: 2 }); });
// The hero shrugs it off and bows.
sc.frame(520, g => { hero(g, 'crouch', { eyes: 'happy' }); villain(g, 'point', { ...REACH, breath: true }); });

// Poof off: both vanish, Clawd is back on his spot.
const VPe = k.place('point', { dx: VX, flip: true });
m2.poofSwap(sc,
  g => { hero(g, 'idle'); villain(g, 'point', REACH); },
  g => k.clawd(g, 'idle'),
  [[P0.centre.x - 6, P0.centre.y - 3], [VPe.centre.x + 2, VPe.centre.y - 3, dark]]);
m2.idleOutro(sc);

sc.finish();
