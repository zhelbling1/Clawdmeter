#!/usr/bin/env node
/**
 * "The Bernie": made for this fork, AI-drawn with the originals kit.
 * References the late-2010s "Bernie lean" party dance: leaning way back,
 * arms hanging loose, swaying like the most relaxed guest at the party.
 * Costume: sunglasses, a loud shirt worn open. Two more Clawds join in the
 * background. No lyrics, no song title.
 *
 * Story: idle → poof (shades, open shirt) → he sinks back into the lean →
 * two friends pop up behind him → loop: all three sway in the lean, arms
 * swinging loose, notes drifting → friends pop away → he straightens,
 * ^‿^ → poof → idle.
 *
 * Usage: node music/bernie.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props');
const { C } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-Bernie.gif', name: 'the bernie', mood: 'active', headroom: 0,
  credit: m.CREDIT,
  references: 'The Bernie lean, the late-2010s party dance: leaning way back, arms loose, swaying; sunglasses and a loud open shirt.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

function dressed(g, P) {
  m.openShirt(g, P);
  k.shades(g, P);
}
const him = (g, pose, o = {}) => k.clawd(g, pose, { ...o, over: dressed });

// His friend, a row further back on the right: shades and a bandana.
const PAL = { dx: 12, dy: -1 };
function pal(g, pose, o = {}) {
  return k.clawd(g, pose, { ...PAL, ...o, over: (g2, P) => {
    k.shades(g2, P);
    k.bandana(g2, P, { c: C.pink, knot: C.gold, phase: o.phase || 0 });
  } });
}
const HOME = -9;     // his spot while they dance side by side

// ── Lean poses: head and shoulders thrown back, hips forward, arms loose ─────

const lean = (id, l, o = {}) => m.derive('bn_' + id, 'idle', { lean: l, hips: 1, block: 4, armL: [1, 3], armR: [-2, 3], ...o });
const B = {
  l2: lean('l2', -2, { drop: 1, armL: [1, 2], armR: [-1, 2] }),
  l3: lean('l3', -3),
  l4: lean('l4', -4),
  l5: lean('l5', -5, { drop: 1, armL: [1, 4], armR: [-2, 4] }),
  sw: lean('sw', -4, { drop: 1, armL: [0, 1], armR: [-1, 1] }),     // arms swing up
};

// ── Storyboard ───────────────────────────────────────────────────────────────

m.open(sc, g => him(g, 'idle'));

// He slides left to make room; his friend pops up on the right.
sc.frame(110, g => him(g, 'crab_2', { flip: true, dx: -4 }));
sc.frame(110, g => him(g, 'crab_5', { flip: true, dx: -9 }));
sc.frame(90, g => { him(g, 'idle', { dx: HOME }); k.poof(g, 26.5 + PAL.dx, 25, 0, { scale: 0.7 }); });
sc.frame(110, g => { pal(g, 'idle'); him(g, 'idle', { dx: HOME }); k.poof(g, 26.5 + PAL.dx, 25, 2, { scale: 0.7 }); });
// Both sink back into the lean.
sc.frame(200, g => { pal(g, B.l2, { eyes: 'up' }); him(g, B.l2, { dx: HOME, eyes: 'up' }); });

// Loop: the lean, swaying in time, arms hanging loose.
sc.loopStart();
const beat = [B.l3, B.l4, B.l5, B.sw, B.l4, B.l3, B.l2, B.l3];
beat.forEach((p, i) => sc.frame(i % 2 ? 200 : 170, g => {
  pal(g, beat[(i + 7) % 8], { eyes: 'up', phase: i });    // a beat behind him
  him(g, p, { dx: HOME, eyes: 'up' });
  if (i === 1 || i === 2) k.note(g, 27 + i, 15 - i, C.gold);
  if (i === 5 || i === 6) k.note(g, 3 + i, 17 - i, C.sky, { flip: true });
}));
sc.loopEnd();

// Friend pops away, he straightens and slides home, content.
sc.frame(110, g => { him(g, 'idle', { dx: HOME }); k.poof(g, 26.5 + PAL.dx, 26, 1, { scale: 0.75 }); });
sc.frame(90, g => { him(g, 'idle', { dx: HOME }); k.poof(g, 26.5 + PAL.dx, 25, 3, { scale: 0.7 }); });
sc.frame(110, g => him(g, 'crab_2', { dx: -8 }));
sc.frame(110, g => him(g, 'crab_5', { dx: -3 }));
// Shades slide down his face: ^‿^ over the top of them.
sc.frame(160, g => k.clawd(g, 'idle', { over: (g2, P) => { m.openShirt(g2, P); k.shades(g2, { ...P, eyeY: P.eyeY + 1 }); } }));
sc.frame(560, g => k.clawd(g, 'idle', { eyes: 'happy', over: (g2, P) => { m.openShirt(g2, P); k.shades(g2, { ...P, eyeY: P.eyeY + 2 }); } }));

m.close(sc, g => him(g, 'idle'));

sc.finish();
