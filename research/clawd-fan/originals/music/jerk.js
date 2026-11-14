#!/usr/bin/env node
/**
 * "The Jerk": made for this fork, AI-drawn with the originals kit.
 * References the late-2000s West Coast street dance: one foot kicks out
 * in front while the body jerks back, then the other foot steps back as he
 * rocks forward, over and over. Costume: skinny jeans, loud high-tops, a
 * flat-brim cap and neon-rimmed shades. No lyrics, no song title.
 *
 * Story: idle → poof (jeans, high-tops, cap, shades) → he checks his kicks → loop:
 * kick out, jerk back, step back, rock forward, then the same facing the
 * other way → he lands it, ^‿^ → poof → idle.
 *
 * Usage: node music/jerk.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props');
const { C } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-Jerk.gif', name: 'the jerk', mood: 'active', headroom: 0,
  credit: m.CREDIT,
  references: 'The Jerk, the late-2000s West Coast street dance: kicking one foot out while jerking the body back, stepping back and rocking forward; skinny jeans and bright high-tops.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

function dressed(g, P) {
  const face = P.facing === 'left' ? -1 : P.facing === 'right' ? 1 : 0;
  m.skinnyJeans(g, P);
  m.hiTops(g, P, { dir: face });
  m.flatBrim(g, P, { side: face || 1 });
  k.shades(g, P, { c: C.charcoal, glint: C.lime });
}
const him = (g, pose, o = {}) => k.clawd(g, pose, { ...o, over: dressed });

// ── The step (3/4 view facing right; flip faces left) ────────────────────────

const J = {
  // front foot kicks out, toe up, body jerks back
  kick: m.derive('jk_kick', 'turn', { kick: { leg: 3, dx: 4, dy: -1 }, lean: -3, block: 4, armR: [0, -2], armL: [0, 1] }),
  // feet together, knees bend
  bob:  m.derive('jk_bob', 'turn', { drop: 1, armR: [0, 1], armL: [0, 1] }),
  // back foot steps back, body rocks forward over the front foot
  back: m.derive('jk_back', 'turn', { kick: { leg: 0, dx: -4, dy: -1 }, lean: 3, block: 4, armR: [-1, 2], armL: [1, -2] }),
};

// ── Storyboard ───────────────────────────────────────────────────────────────

m.open(sc, g => him(g, 'idle'));

// He looks down at the high-tops, pleased.
sc.frame(160, g => him(g, 'crouch'));
sc.frame(300, g => {
  him(g, 'crouch', { eyes: 'happy' });
  k.sparkle(g, 16, 33, 2); k.sparkle(g, 37, 33, 3);
});
sc.frame(140, g => him(g, 'turn'));

// Loop: kick-jerk, bob, step back-rock, bob; then the same facing left.
sc.loopStart();
for (const flip of [false, true]) {
  const d = flip ? -1 : 1;
  sc.frame(170, g => {
    him(g, J.kick, { flip, eyes: 'happy' });
    k.motionLines(g, flip ? 35 : 18, 21, { dir: flip ? 'right' : 'left', len: 3, count: 2, gap: 2 });
  });
  sc.frame(120, g => him(g, J.bob, { flip, dy: 0 }));
  sc.frame(170, g => {
    him(g, J.back, { flip, eyes: 'happy' });
    k.note(g, flip ? 14 : 38, 12, flip ? C.lime : C.pink, { flip });
  });
  sc.frame(120, g => him(g, J.bob, { flip }));
}
sc.loopEnd();

// Lands it: a little hop, then content.
sc.frame(120, g => him(g, 'jump_crouch'));
sc.frame(180, g => him(g, 'jump_up', { dy: 2 }));
sc.frame(100, g => { him(g, 'crouch'); k.dust(g, 26, 36, 0); });
sc.frame(560, g => him(g, 'idle', { eyes: 'happy' }));

m.close(sc, g => him(g, 'idle'));

sc.finish();
