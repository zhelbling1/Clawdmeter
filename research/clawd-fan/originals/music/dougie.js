#!/usr/bin/env node
/**
 * "The Dougie": made for this fork, AI-drawn with the originals kit.
 * References the 2010-era dance craze: one hand sliding back over the side
 * of the head while the body leans and rocks side to side on bouncing
 * knees. Costume: fitted cap worn backwards, gold chain. No lyrics, no
 * song title.
 *
 * Story: idle → poof (cap, chain) → he flips the cap brim round → loop:
 * right hand over the right side of his head leaning right, bounce, then
 * the left side leaning left → he dusts the chain, ^‿^ → poof → idle.
 *
 * Usage: node music/dougie.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props');
const { C } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-Dougie.gif', name: 'the dougie', mood: 'active', headroom: 0,
  credit: m.CREDIT,
  references: 'The Dougie, the 2010-era dance craze: hand sliding over the side of the head, leaning and rocking side to side; backwards fitted cap and gold chain.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

// The brim sticks out behind (screen left); a hand passing over it covers it.
const brim = (g, P) => m.capBrim(g, P, { side: -1 });
function dressed({ glint = 0, bands = true } = {}) {
  return (g, P) => {
    m.goldChain(g, P);
    m.capBack(g, P, { brim: null });
    if (bands) for (const side of ['L', 'R']) {
      const h = side === 'L' ? P.handL : P.handR;
      if (h && (h.dir === 'up' || h.y1 < P.chin + 1)) m.wristband(g, P, { side, row: true });
    }
    if (glint) k.sparkle(g, k.midCol(P) + 3, P.chin + 5, glint);
  };
}
const him = (g, pose, { glint, ...o } = {}) => k.clawd(g, pose, { ...o, under: brim, over: dressed({ glint }) });

// ── Dance poses (right-hand side; the left side is the mirror image) ──────────

const D = {
  // hand comes up over the top of the head
  up:   m.derive('dg_up', 'idle', { armR: [-4, -8], armL: [0, 1], lean: 1 }),
  // hand slides down over the side of the head, knees bend, lean in
  side: m.derive('dg_side', 'idle', { armR: [-2, -6], armL: [-1, 2], lean: 4, hips: -1, drop: 1 }),
  // hand passes the jaw, body still leaning
  jaw:  m.derive('dg_jaw', 'idle', { armR: [-2, -3], armL: [-1, 3], lean: 3, hips: -1, drop: 1 }),
  // arms swing low through the middle, bounce
  mid:  m.derive('dg_mid', 'idle', { armR: [0, 2], armL: [0, 2], drop: 1 }),
};

// ── Storyboard ───────────────────────────────────────────────────────────────

m.open(sc, g => him(g, 'idle'));

// Hand to the cap: spins the brim round to the back.
sc.frame(200, g => him(g, 'wave_1'));
sc.frame(220, g => { him(g, 'wave_2', { eyes: 'closed' }); k.motionLines(g, 14, 20, { dir: 'left', len: 3, count: 2, gap: 2 }); });
sc.frame(140, g => him(g, D.mid));

// Loop: the Dougie, right side then left side.
sc.loopStart();
for (const flip of [false, true]) {
  const d = flip ? -1 : 1;
  const nx = flip ? 15 : 37;            // notes on the leaning side
  sc.frame(130, g => him(g, D.up, { flip, dx: d }));
  sc.frame(170, g => { him(g, D.side, { flip, dx: d, eyes: 'happy' }); k.note(g, nx + d * 4, 12, C.gold, { flip }); });
  sc.frame(150, g => { him(g, D.jaw, { flip, dx: d, eyes: 'happy' }); k.note(g, nx + d * 6, 10, C.gold, { flip }); });
  sc.frame(130, g => him(g, D.mid, { flip }));
}
sc.loopEnd();

// Reaction: straighten up, brush the chain, content.
sc.frame(150, g => him(g, 'idle'));
sc.frame(220, g => him(g, 'wave_down', { eyes: 'happy' }));
sc.frame(520, g => him(g, 'idle', { eyes: 'happy', glint: 3 }));

m.close(sc, g => him(g, 'idle'));

sc.finish();
