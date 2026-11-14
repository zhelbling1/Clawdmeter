#!/usr/bin/env node
/**
 * "Thumbs up in lava": made for this fork, AI-drawn with the originals kit.
 * References the molten-steel farewell from a 1991 sci-fi sequel: leather
 * jacket, dark shades, a slow sink with one hand left above the surface
 * giving a thumbs-up. Played as slapstick ("this is fine"), and he pops
 * straight back out. Caricature only, no likeness, no logos.
 *
 * Story: idle → poof (jacket, shades; he's standing in a lava pool) → he
 * sinks slowly, calm, raising one gloved fist → loop: only the thumbs-up
 * is left above the bubbling surface → it slips under, one bubble, bloop →
 * he pops back out unharmed → poof → idle.
 *
 * Usage: node movies/lava_thumbs.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props_m1');
const { C, put } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-LavaThumbs.gif', name: 'thumbs up in lava', mood: 'heavy', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The thumbs-up in molten steel from Terminator 2 (1991): leather jacket, dark shades, a slow sink with one hand left giving a thumbs-up. Cartoon slapstick: he pops back out fine.',
});

const TOP = 31;                                   // the lava surface row

// ── Costume ──────────────────────────────────────────────────────────────────

function dressed({ thumb = false } = {}) {
  return (g, P) => {
    k.leatherJacket(g, P);
    k.shades(g, P);
    if (thumb) m.thumbsUp(g, P);                 // a white cartoon glove
  };
}
const him = (g, pose, opts = {}) => {
  const { thumb, ...rest } = opts;
  return k.clawd(g, pose, { ...rest, over: dressed({ thumb }) });
};

// Him in the pool: pool behind, him, then the surface over his lower half.
function wading(g, pose, dy, { phase = 0, thumb = false, bubbles = [] } = {}) {
  m.lavaPool(g, TOP, phase);
  const P = him(g, pose, { dy, thumb });
  m.lavaSurface(g, TOP, phase);
  for (const [x, s] of bubbles) m.lavaBubble(g, x, TOP, s);
  // a ring of ripples where he meets the surface
  if (dy < 20) { put(g, 17, TOP, C.glow); put(g, 18, TOP, C.glow); put(g, 35, TOP, C.glow); put(g, 36, TOP, C.glow); }
  return P;
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 3, ph);

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: jacket and shades, and the floor is lava.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { wading(g, 'idle', 0); puff(g, 1); });
sc.frame(100, g => { wading(g, 'idle', 0, { phase: 1 }); puff(g, 2); });
sc.frame(90, g => { wading(g, 'idle', 0, { phase: 1 }); puff(g, 3); });

// Calm. He sinks, slowly, and raises one fist.
sc.frame(450, g => wading(g, 'idle', 0, { phase: 2, bubbles: [[9, 1]] }));
sc.frame(380, g => wading(g, 'idle', 2, { phase: 3, bubbles: [[44, 2]] }));
sc.frame(380, g => wading(g, 'wave_1', 4, { phase: 0, thumb: true, bubbles: [[10, 1]] }));
sc.frame(380, g => wading(g, 'wave_1', 6, { phase: 1, thumb: true, bubbles: [[42, 1]] }));
sc.frame(420, g => wading(g, 'wave_1', 8, { phase: 2, thumb: true, bubbles: [[12, 2]] }));

// Loop: only the thumbs-up is left, the lava bubbling round it.
sc.loopStart();
sc.frame(330, g => wading(g, 'wave_1', 10, { phase: 3, thumb: true, bubbles: [[22, 1], [44, 2]] }));
sc.frame(330, g => wading(g, 'wave_1', 10, { phase: 0, thumb: true, bubbles: [[20, 2], [9, 1]] }));
sc.frame(330, g => wading(g, 'wave_1', 9, { phase: 1, thumb: true, bubbles: [[21, 3], [40, 1]] }));
sc.frame(330, g => wading(g, 'wave_1', 10, { phase: 2, thumb: true, bubbles: [[12, 2]] }));
sc.loopEnd();

// It slips under. One bubble. Bloop.
sc.frame(380, g => wading(g, 'wave_1', 12, { phase: 3, thumb: true }));
sc.frame(380, g => wading(g, 'wave_1', 14, { phase: 0, thumb: true, bubbles: [[44, 1]] }));
sc.frame(300, g => { m.lavaPool(g, TOP, 1); m.lavaBubble(g, 32, TOP, 2); });
sc.frame(260, g => { m.lavaPool(g, TOP, 2); m.lavaBubble(g, 32, TOP, 3); });
sc.frame(420, g => { m.lavaPool(g, TOP, 3); });

// He pops straight back out, fine, and the pool poofs away.
sc.frame(110, g => { m.lavaPool(g, TOP, 0); him(g, 'stretch', { dy: -2, eyes: 'open' });
  for (const [x, y] of [[14, 27], [39, 26], [18, 22], [36, 21], [26, 18]]) { put(g, x, y, C.red); put(g, x, y - 1, C.gold); } });
sc.frame(260, g => { m.lavaPool(g, TOP, 1); him(g, 'jump_fall', { dy: -2 });
  for (const [x, y] of [[11, 24], [42, 23], [16, 17], [38, 16]]) { put(g, x, y, C.red); put(g, x + 1, y, C.gold); } });
sc.frame(90, g => { m.lavaPool(g, TOP, 2); him(g, 'jump_fall'); k.poof(g, P0.centre.x, P0.centre.y - 4, 0); });
sc.frame(110, g => { m.lavaPool(g, TOP, 3); k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
