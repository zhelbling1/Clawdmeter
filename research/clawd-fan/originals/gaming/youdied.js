#!/usr/bin/env node
/**
 * "YOU DIED → Praise the Sun": made for this fork, AI-drawn with the
 * originals kit. References the punishing dark-fantasy action games: a
 * bucket-helmed knight with a sun on his tabard, the red death caption on a
 * dark band, the bonfire checkpoint and the arms-up sun salute. Slapstick:
 * he dies to a pebble. No logos, no game sprites.
 *
 * Story: idle → poof (helmet, armour, sun tabard) → he strides off and trips
 * over a pebble, lands on his back, legs in the air → "YOU DIED" fades in →
 * the screen empties; he respawns at a little bonfire → loop: the sun
 * salute, a sun blazing between his raised arms → poof → idle.
 *
 * Usage: node gaming/youdied.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, line, disc, caption } = k;
const { tumble, eyesX, layer } = require('./props');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-YouDied.gif', name: 'you died', mood: 'heavy', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Dark Souls (2011): the red "YOU DIED" caption, bonfire checkpoints, a sun-emblem knight and the "Praise the Sun" salute.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

// Bucket helmet (no plume), steel pauldrons and sabatons, a white tabard
// with a gold sun. His arms and legs stay orange.
function knight({ x = false } = {}) {
  return (g, P) => {
    const [x0, x1] = k.headSpan(P);
    k.recolour(g, P, (xx, y) => y === P.chin && (xx < x0 || xx > x1), C.steel, C.slate);   // pauldrons
    k.recolour(g, P, (xx, y) => y === P.feet, C.slate, C.slate);                          // sabatons
    const m = k.midCol(P);
    for (let y = P.chin; y <= P.waist + 1; y++) for (let xx = m - 3; xx <= m + 4; xx++) k.onBody(g, P, xx, y, C.ivory);
    k.sparkle(g, m + 1, P.chin + 3, 3, C.gold, C.amber);
    if (x) eyesX(g, P);
    k.knightHelmet(g, P, { plume: null });
    if (x) for (const e of P.eyes) {         // keep the X eyes on top of the visor slit
      const cx = e.x + (e.x < P.head.cx ? 0 : 1), cy = e.y + e.h - 1;
      for (const [u, v] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) if (P.at(cx + u, cy + v)) g.put(cx + u, cy + v, C.eye);
    }
  };
}
// The salute (over arms_up): his raised arms stay in front of the helmet,
// and steel gauntlets carry them up and out into a V.
function salute(g, P) {
  for (const [xx, y, t] of P.cells) if (y < P.head.top - 0 && (xx < P.head.x0 + 4 || xx > P.head.x1 - 4)) g.put(xx, y, t === 's' ? C.shade : C.body);
  for (const [h, d] of [[P.handL, -1], [P.handR, 1]]) {
    const x = d < 0 ? h.x0 : h.x1 - 1;
    for (let i = 1; i <= 3; i++) rect(g, x + d * i, h.y - i, x + d * i + 1, h.y - i, C.steel);
    rect(g, x + d * 4, h.y - 5, x + d * 4 + 1, h.y - 4, C.slate);
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

const pebble = (g) => { rect(g, 42, 36, 44, 36, C.gray); put(g, 43, 35, C.gray); };

// Bonfire: ash mound, the coiled sword, flames. phase 0/1 flickers.
function bonfire(g, phase = 0, lit = true) {
  rect(g, 41, 36, 51, 36, C.charcoal);
  rect(g, 42, 35, 50, 35, C.charcoal);
  rect(g, 44, 34, 48, 34, C.gray);
  rect(g, 46, 23, 46, 34, C.steel);                       // blade
  put(g, 45, 26, C.slate); put(g, 47, 26, C.slate);       // coil
  put(g, 45, 29, C.slate); put(g, 47, 29, C.slate);
  rect(g, 44, 22, 48, 22, C.slate);                       // crossguard
  rect(g, 46, 20, 46, 21, C.brown);                       // grip
  if (!lit) return;
  const f = phase ? [[43, 33, 31], [44, 33, 29], [45, 33, 30], [47, 33, 28], [48, 33, 30], [49, 33, 32]]
    : [[43, 33, 32], [44, 33, 30], [45, 33, 28], [47, 33, 29], [48, 33, 31], [49, 33, 32]];
  for (const [x, y0, y1] of f) rect(g, x, y1, x, y0, C.red);
  for (const [x, y0, y1] of f) if (y0 - y1 >= 2) rect(g, x, y1 + 2, x, y0, C.gold);
  rect(g, 45, 33, 47, 33, C.glow);
}

// The death caption on a dark band; c fades it in.
function youDied(g, c) {
  rect(g, 10, 10, 43, 18, C.charcoal);
  caption(g, 'YOU DIED', 27, 12, c, { align: 'center' });
}

// The sun between his raised arms; phase pulses the rays.
function sun(g, phase) {
  const cx = 26.5, cy = 10;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  dirs.forEach(([u, v], i) => {
    const long = (i < 4) === (phase === 0);
    const r1 = long ? 5 : 4;
    for (let r = 3; r <= r1; r++) {
      const x = Math.round(cx + u * r * (u && v ? 0.75 : 1) - 0.5 * (u < 0 ? 1 : 0)), y = Math.round(cy + v * r * (u && v ? 0.75 : 1));
      put(g, x, y, r === r1 ? C.glow : C.gold);
    }
  });
  disc(g, cx, cy, 2, C.gold);
  rect(g, 26, 9, 27, 10, C.glow);
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: knight() });
const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 3, ph);

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: armour up.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { him(g, 'idle'); pebble(g); puff(g, 1); });
sc.frame(100, g => { him(g, 'idle'); pebble(g); puff(g, 2); });
sc.frame(90, g => { him(g, 'idle'); pebble(g); puff(g, 3); });
sc.frame(350, g => { him(g, 'idle', { eyes: 'right' }); pebble(g); });

// A brave stride… and the pebble.
const walk = ['walk_0', 'walk_2'];
walk.forEach((p, i) => sc.frame(150, g => { him(g, p, { dx: 2 * i + 2 }); pebble(g); }));
sc.frame(120, g => { tumble(g, 'idle', 40, { over: knight(), eyes: 'wide', dx: 6, dy: -3 }); pebble(g);
  caption(g, '!', 41, 10, C.ivory); });
sc.frame(110, g => { tumble(g, 'idle', 120, { over: knight(), eyes: 'wide', dx: 7, dy: -4 }); pebble(g); });
sc.frame(420, g => { tumble(g, 'idle', 180, { over: knight({ x: true }), dx: 7 }); pebble(g);
  k.dust(g, 25, 36, 0); k.dust(g, 42, 36, 0); });

// YOU DIED.
sc.frame(300, g => { tumble(g, 'idle', 180, { over: knight({ x: true }), dx: 7 }); pebble(g); youDied(g, C.maroon); });
sc.frame(1300, g => { tumble(g, 'idle', 180, { over: knight({ x: true }), dx: 7 }); pebble(g); youDied(g, C.red); });
sc.frame(250, g => { youDied(g, C.maroon); });
sc.frame(250, g => { bonfire(g, 0, false); });

// Respawn at the bonfire: it catches, he shimmers back in.
sc.frame(140, g => {
  bonfire(g, 1);
  // A glowing outline of him, sparkling.
  const L = layer(0, h => him(h, 'crouch'));
  const edge = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => !L.get(x + u, y + v));
  for (let y = 0; y < 37; y++) for (let x = 0; x < 55; x++) if (L.get(x, y) && edge(x, y)) put(g, x, y, C.glow);
  k.sparkle(g, 22, 26, 2, C.glow); k.sparkle(g, 31, 30, 2, C.gold);
});
sc.frame(380, g => { him(g, 'crouch', { eyes: 'closed' }); bonfire(g, 0); });
sc.frame(200, g => { him(g, 'idle'); bonfire(g, 1); });

// Loop: PRAISE THE SUN.
sc.loopStart();
for (let i = 0; i < 4; i++) sc.frame(220, g => {
  sun(g, i % 2);
  k.clawd(g, 'arms_up', { eyes: i === 3 ? 'closed' : 'happy', over: [knight(), salute] });
  bonfire(g, i % 2);
});
sc.loopEnd();

sc.frame(350, g => { him(g, 'idle', { eyes: 'happy' }); bonfire(g, 1); });

// Poof off (the bonfire goes with him).
sc.frame(90, g => { him(g, 'idle'); bonfire(g, 0); puff(g, 0); k.poof(g, 44, 30, 0, { scale: 0.4 }); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); k.poof(g, 44, 30, 1, { scale: 0.4 }); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); k.poof(g, 44, 30, 2, { scale: 0.4 }); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); k.poof(g, 44, 30, 3, { scale: 0.4 }); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
