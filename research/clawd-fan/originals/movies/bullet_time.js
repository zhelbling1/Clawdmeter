#!/usr/bin/env node
/**
 * "Bullet time": made for this fork, AI-drawn with the originals kit.
 * References the slow-motion rooftop dodge from a 1999 sci-fi film: tiny
 * black shades, a long black coat, green code falling behind, bullets
 * crawling past with ripples in the air. Caricature only, no likeness, no
 * logos.
 *
 * Story: idle → poof (coat, shades; green code rain behind) → a bullet comes
 * in → in slow motion he bends way back, arms flung out, coat flaring →
 * loop: slow frames, bullets crawl over him trailing ripples → snaps back
 * upright, a glint off his shades → poof → idle.
 *
 * Usage: node movies/bullet_time.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props_m1');
const { C, line, put, rect } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-BulletTime.gif', name: 'bullet time', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The slow-motion bullet dodge from The Matrix (1999): tiny black shades, long black coat, falling green code, bullets crawling past with ripples in the air.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

const dressed = (g, P) => { m.openCoat(g, P); m.tinyShades(g, P); };
const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: dressed });

// Coat tails flaring out to both sides as he bends (spread 1..3).
function coatTails(g, P, spread) {
  const [x0, x1] = k.headSpan(P), y = P.waist;
  for (let i = 1; i <= 3; i++) {
    const yy = Math.min(36, y + i);
    rect(g, x0 - i * spread, yy, x0, yy, C.charcoal);
    rect(g, x1, yy, x1 + i * spread, yy, C.charcoal);
  }
  put(g, x0 - 3 * spread, Math.min(36, y + 3), C.slate); put(g, x1 + 3 * spread, Math.min(36, y + 3), C.slate);
}
// The swoosh of his head going back: a slate arc over where it was.
function swoosh(g, n = 7) {
  const arcs = [[[35, 22], [34, 20], [32, 19], [30, 18]], [[18, 22], [19, 20], [21, 19], [23, 18]]];
  for (const a of arcs) a.slice(0, Math.ceil(n / 2)).forEach(([x, y]) => put(g, x, y, C.gray));
}

// ── Background ───────────────────────────────────────────────────────────────

let T = 0;                                   // code-rain clock (advanced per frame)
const rain = (g, dt = 1) => { T += dt; m.codeRain(g, Math.floor(T), { y0: 7 }); };

// Bullets flying left over him at two heights; f = 0..3 steps them 12
// cells, so four steps bring the stream back where it started.
function bullets(g, f) {
  for (const [y, ph] of [[17, 0], [22, 2]]) {
    const x = 50 - 12 * ((f + ph) % 4);
    m.bullet(g, x, y, { dir: -1, rings: 2 });
  }
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 3, ph);

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: coat and shades; the code starts falling.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { rain(g); him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { rain(g); him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { rain(g); him(g, 'idle'); puff(g, 3); });
sc.frame(420, g => { rain(g); him(g, 'idle'); });

// A bullet comes in from the right at head height. Slow motion: he bends
// way back, arms out, coat flaring.
sc.frame(200, g => { rain(g); him(g, 'idle'); m.bullet(g, 51, 22, { dir: -1, rings: 0 }); });
sc.frame(300, g => { rain(g, 0.5); const P = him(g, 'crouch'); coatTails(g, P, 1); swoosh(g, 3); m.bullet(g, 45, 22, { dir: -1, rings: 1 }); });
sc.frame(400, g => { rain(g, 0.5); const P = him(g, 'jump_crouch'); coatTails(g, P, 2); swoosh(g, 7); m.bullet(g, 38, 22, { dir: -1, rings: 2 }); });

// Loop: slow frames, the bullets crawl over him, ripples trailing.
sc.loopStart();
for (let f = 0; f < 4; f++)
  sc.frame(300, g => { rain(g, 0.5); bullets(g, f); const P = him(g, 'jump_crouch'); coatTails(g, P, f % 2 ? 3 : 2); });
sc.loopEnd();

// Snaps back upright, full speed; touches his shades, cool.
sc.frame(80, g => { rain(g); him(g, 'stretch', { dy: 3, eyes: 'open' }); k.motionLines(g, 15, 22, { dir: 'down', len: 4, count: 1 }); k.motionLines(g, 38, 22, { dir: 'down', len: 4, count: 1 }); });
sc.frame(300, g => { rain(g); him(g, 'idle'); });
sc.frame(380, g => { rain(g); const P = him(g, 'idle'); k.sparkle(g, P.eyeL.x - 1, P.eyeY, 2, C.ivory, C.ivory); });
sc.frame(250, g => { rain(g); him(g, 'idle'); });

// Poof off.
sc.frame(90, g => { rain(g); him(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
