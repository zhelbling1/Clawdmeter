#!/usr/bin/env node
/**
 * "Crank That": made for this fork, AI-drawn with the originals kit.
 * References the 2007 dance craze: the crank (fists rolling a throttle on a
 * bouncing step), the jump-and-lean on one leg, and the leap with one fist
 * punched out like a flying superhero. Costume: an oversized white tee and
 * a bucket hat. No lyrics, no song title.
 *
 * Story: idle → poof (tee, hat) → he tugs the hat brim → loop: crank,
 * crank, lean-hop right, lean-hop left, crouch, the flying punch, land →
 * ^‿^ → poof → idle.
 *
 * Usage: node music/crank.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props');
const { C } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-CrankThat.gif', name: 'crank that', mood: 'active', headroom: 0,
  credit: m.CREDIT,
  references: 'The 2007 "Crank That" dance craze: the crank, the jump-and-lean on one leg and the flying superhero punch; an oversized white tee and a bucket hat.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

function dressed(g, P) {
  m.bigTee(g, P);
  k.bucketHat(g, P, { c: C.red, dark: C.maroon });
}
const him = (g, pose, o = {}) => k.clawd(g, pose, { ...o, over: dressed });

// ── Moves ────────────────────────────────────────────────────────────────────

const K = {
  // the crank: fists at the chest, one rolls up, then the other
  c1: m.derive('ck_c1', 'idle', { armL: [0, -3], armR: [0, 1], drop: 1 }),
  c2: m.derive('ck_c2', 'idle', { armL: [0, 1], armR: [0, -3] }),
  // jump-and-lean: leaning right on the right leg, left knee up, arm flung out
  lean: m.derive('ck_lean', 'idle', { lean: 3, hips: 0, block: 4, kick: { leg: 0, dx: -4, dy: -1 }, armL: [0, -4], armR: [0, 2] }),
};

// ── Storyboard ───────────────────────────────────────────────────────────────

m.open(sc, g => him(g, 'idle'));

// Tugs the hat brim down: ready.
sc.frame(200, g => him(g, 'wave_1'));
sc.frame(240, g => him(g, 'wave_2', { eyes: 'closed' }));

sc.loopStart();
// The crank, bouncing.
for (let i = 0; i < 4; i++) sc.frame(i % 2 ? 130 : 140, g => {
  him(g, i % 2 ? K.c2 : K.c1);
  if (i === 1) k.note(g, 40, 14, C.sky);
  if (i === 3) k.note(g, 12, 14, C.gold, { flip: true });
});
// Lean right on one leg and hop; then lean left.
for (const flip of [false, true]) {
  sc.frame(160, g => him(g, K.lean, { flip }));
  sc.frame(180, g => { him(g, K.lean, { flip, dy: -3 }); k.dust(g, flip ? 22 : 31, 36, 1); });
}
// Crouch... the flying punch... land.
sc.frame(140, g => him(g, 'jump_crouch'));
sc.frame(420, g => {
  him(g, 'point_3', { dy: -7, eyes: 'wide' });
  k.motionLines(g, 12, 15, { dir: 'left', len: 4, count: 3, gap: 3 });
  k.sparkle(g, 46, 17, 3);
});
sc.frame(110, g => { him(g, 'jump_land'); k.dust(g, 26, 36, 0); });
sc.loopEnd();

// Content.
sc.frame(200, g => him(g, 'jump_recover'));
sc.frame(560, g => him(g, 'idle', { eyes: 'happy' }));

m.close(sc, g => him(g, 'idle'));

sc.finish();
