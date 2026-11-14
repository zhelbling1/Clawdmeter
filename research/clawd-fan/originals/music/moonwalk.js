#!/usr/bin/env node
/**
 * "Moonwalk": made for this fork, AI-drawn with the originals kit.
 * References the famous backwards glide from 1980s pop performances: a white
 * fedora, one sparkly glove, the glide, a toe stand and a tip of the hat.
 * Caricature only, no likeness, no lyrics.
 *
 * Story: idle → poof (white fedora, one glove) → hand to the hat → loop: he
 * walks forward while gliding backwards, spins, and glides back the other
 * way → toe stand, glove sparkles → tips his hat → poof → idle.
 *
 * Usage: node music/moonwalk.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-Moonwalk.gif', name: 'moonwalk', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The moonwalk and its stagecraft from 1980s pop performances: white fedora, a single sparkly glove, toe stand, hat tip.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

const HAT = { c: C.ivory, band: C.charcoal };
// The glove stays on the same hand: screen right unflipped, screen left
// when the pose is mirrored. `twinkle` adds a sparkle off its tip.
function dressed({ lift = 0, tilt = 0, twinkle = 0 } = {}) {
  return (g, P) => {
    k.fedora(g, P, { ...HAT, lift, tilt });
    const side = P.flip ? 'L' : 'R';
    const tip = k.glove(g, P, { side });
    if (tip && twinkle) {
      const d = side === 'R' ? 1 : -1;
      k.sparkle(g, tip.x + d * 2, tip.y - 2, twinkle, twinkle > 2 ? C.glow : C.gold);
    }
  };
}
function him(g, pose, opts = {}) {
  const { lift, tilt, twinkle, ...rest } = opts;
  return k.clawd(g, pose, { ...rest, over: dressed({ lift, tilt, twinkle }) });
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 4, ph);

// Idle bookend.
sc.frame(450, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(200, g => k.clawd(g, 'idle'));

// Poof on.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { him(g, 'idle', { twinkle: 2 }); puff(g, 3); });

// Hand to the hat brim, a sharp pose; glove flashes.
sc.frame(160, g => him(g, 'wave_1', { twinkle: 3 }));
sc.frame(260, g => him(g, 'wave_2', { twinkle: 2 }));
sc.frame(160, g => him(g, 'crouch'));

// Loop: the glide. He walks forward (facing right) while sliding left,
// spins through the front, then the mirror image back to his spot.
sc.loopStart();
const GLIDE = 8;
const walk = k.CYCLES.walk.map(([p]) => p);
for (let i = 0; i < GLIDE; i++)
  sc.frame(85, g => {
    const dx = -(i + 1);
    him(g, walk[i % walk.length], { dx, twinkle: i % 3 === 0 ? 2 : 0 });
    k.motionLines(g, 40 + dx, 31, { dir: 'right', len: 2 + (i % 2), count: 2, gap: 3, c: C.gray });
  });
sc.frame(120, g => him(g, 'idle', { dx: -GLIDE, eyes: 'closed', twinkle: 3 }));   // the spin
for (let i = 0; i < GLIDE; i++)
  sc.frame(85, g => {
    const dx = -GLIDE + i + 1;
    him(g, walk[i % walk.length], { dx, flip: true, twinkle: i % 3 === 0 ? 2 : 0 });
    k.motionLines(g, 13 + dx, 31, { dir: 'left', len: 2 + (i % 2), count: 2, gap: 3, c: C.gray });
  });
sc.frame(120, g => him(g, 'idle', { eyes: 'closed', twinkle: 3 }));
sc.loopEnd();

// Toe stand: up on his toes, frozen, glove blazing.
sc.frame(90, g => him(g, 'crouch'));
sc.frame(640, g => him(g, 'stretch', { dy: 3, twinkle: 3 }));
// Tip of the hat, happy.
sc.frame(140, g => him(g, 'wave_1', { eyes: 'happy' }));
sc.frame(460, g => him(g, 'wave_2', { eyes: 'happy', lift: 4, twinkle: 3 }));
sc.frame(140, g => him(g, 'wave_1', { eyes: 'happy', lift: 1 }));
sc.frame(260, g => him(g, 'idle', { eyes: 'happy' }));

// Poof off.
sc.frame(90, g => { him(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
