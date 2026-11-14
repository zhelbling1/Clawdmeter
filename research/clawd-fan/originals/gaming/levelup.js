#!/usr/bin/env node
/**
 * "Level up!": made for this fork, AI-drawn with the originals kit.
 * References the woodcutting grind of old-school fantasy MMOs: chop a yew in
 * chunky hits until the level-up fireworks go off. A generic lumberjack look
 * (beanie, plaid shirt, axe); no game sprites, no logos, no UI rips.
 *
 * Story: idle → poof (beanie, plaid shirt, axe; a yew tree arrives) → he
 * squares up to the tree and chops: thunk, thunk, THUNK, wood chips flying →
 * "LEVEL UP!" and fireworks burst over him → loop: he waves the axe while the
 * fireworks keep popping → poof → idle.
 *
 * Usage: node gaming/levelup.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, line, disc, caption } = k;
const { firework } = require('./props');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-LevelUp.gif', name: 'level up', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Old School RuneScape woodcutting: chopping a yew, the level-up fireworks. Generic lumberjack costume, no game sprites.',
});

const YEW = [0x2C, 0x64, 0x3A];         // dark yew green (own colour)

// ── Costume ──────────────────────────────────────────────────────────────────

// Beanie: knitted dome with a turned-up cuff and a bobble.
function beanie(g, P) {
  const [x0, x1] = k.headSpan(P), t = P.head.top;
  rect(g, x0 + 2, t - 3, x1 - 2, t - 3, C.green);
  rect(g, x0 + 1, t - 2, x1 - 1, t - 2, C.green);
  rect(g, x0, t - 1, x1, t, YEW);                                   // cuff
  for (let x = x0 + 1; x <= x1; x += 3) put(g, x, t - 1, C.green);   // rib
  const cx = Math.floor(P.head.cx);
  rect(g, cx, t - 5, cx + 1, t - 4, C.ivory);                       // bobble
}
// Red plaid flannel shirt, sleeves and all.
function plaid(g, P) {
  k.jacket(g, P, { c: C.red, dark: C.maroon });
  const [x0, x1] = k.headSpan(P);
  k.recolour(g, P, (x, y) => y <= P.waist && (y >= P.chin || x < x0 || x > x1) && (x % 4 === 1 || y % 4 === 3), C.maroon, C.maroon);
  for (let y = P.chin + 1; y <= P.waist; y += 2) k.onBody(g, P, k.midCol(P) + 1, y, C.ivory);     // buttons
}
const lumberjack = [plaid, beanie];

// Axe. 'down': hanging from a side hand; 'up': raised from a hand overhead;
// 'out': swung level to the right, the blade biting the trunk.
function axe(g, P, mode) {
  if (mode === 'down') {
    const h = P.handR;
    rect(g, h.x + 1, h.y - 2, h.x + 1, h.y + 4, C.brown);
    rect(g, h.x + 2, h.y + 3, h.x + 3, h.y + 5, C.steel); put(g, h.x + 4, h.y + 4, C.gray);
  } else if (mode === 'up') {
    const h = P.handR;
    line(g, h.x0 + 1, h.y - 1, h.x0 - 2, h.y - 6, C.brown);
    rect(g, h.x0 - 4, h.y - 8, h.x0 - 2, h.y - 6, C.steel); rect(g, h.x0 - 5, h.y - 8, h.x0 - 5, h.y - 6, C.gray);
  } else {
    const h = P.handR;
    rect(g, h.x + 1, h.y, h.x + 2, h.y, C.brown);
    rect(g, h.x + 2, h.y - 3, h.x + 3, h.y + 2, C.steel); rect(g, h.x + 3, h.y - 3, h.x + 3, h.y + 2, C.gray);
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

// The yew: thick trunk at x 45..48, dense dark canopy. sway shifts the canopy;
// notch cuts a bite into the trunk (0..3).
function tree(g, { sway = 0, notch = 0 } = {}) {
  rect(g, 45, 22, 48, 36, C.brown);
  put(g, 44, 36, C.brown); put(g, 49, 36, C.brown); put(g, 50, 36, C.brown);
  rect(g, 47, 24, 47, 33, C.tan);                                     // bark line
  for (let i = 0; i < notch; i++) put(g, 45 + (i > 1 ? 1 : 0), 23 + i, C.tan);
  const s = sway;
  for (const [x, y, r] of [[47, 16, 6], [42, 19, 4], [52, 18, 4], [47, 10, 4.5], [43, 13, 3.5], [51, 12, 3.5]])
    disc(g, x + s, y, r, YEW);
  for (const [x, y] of [[44, 11], [49, 9], [41, 17], [46, 14], [51, 15], [44, 20], [49, 19]]) rect(g, x + s, y, x + s + 1, y, C.green);
}

// Wood chips flying off the bite, and the impact flash.
const chips = (g, n) => {
  const pts = [[44, 20], [41, 19], [47, 19], [39, 21], [43, 17]].slice(0, n);
  for (const [x, y] of pts) rect(g, x, y, x + 1, y, C.tan);
  k.sparkle(g, 46, 24, n > 3 ? 3 : 2, C.ivory, C.ivory);
};

// ── Storyboard ───────────────────────────────────────────────────────────────

const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: lumberjack });
const P0 = k.place('idle');
const puff = (g, ph) => { k.poof(g, P0.centre.x, P0.centre.y - 3, ph); k.poof(g, 47, 22, ph, { scale: 0.6 }); };

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: kitted out; the yew appears.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { tree(g); const P = him(g, 'idle'); axe(g, P, 'down'); puff(g, 1); });
sc.frame(100, g => { tree(g); const P = him(g, 'idle'); axe(g, P, 'down'); puff(g, 2); });
sc.frame(90, g => { tree(g); const P = him(g, 'idle'); axe(g, P, 'down'); puff(g, 3); });
sc.frame(300, g => { tree(g); const P = him(g, 'idle', { eyes: 'right' }); axe(g, P, 'down'); });

// Chop, chop, CHOP.
for (let i = 0; i < 3; i++) {
  sc.frame(i ? 150 : 220, g => { tree(g, { notch: i }); const P = him(g, 'wave_1', { eyes: 'right' }); axe(g, P, 'up'); });
  sc.frame(i === 2 ? 260 : 170, g => {
    tree(g, { notch: i + 1, sway: i === 2 ? 1 : 0 }); const P = him(g, 'point', { eyes: i === 2 ? 'closed' : null }); axe(g, P, 'out');
    chips(g, 2 + i);
  });
}

// LEVEL UP!
const title = (g, c) => caption(g, 'LEVEL UP!', 26, 2, c, { align: 'center', shadow: C.maroon });
sc.frame(160, g => { tree(g, { notch: 3 }); const P = him(g, 'squash', { eyes: 'wide' }); axe(g, P, 'down');
  title(g, C.gold); firework(g, 12, 13, 0, C.gold, C.ivory); firework(g, 36, 11, 0, C.sky, C.ivory); });

// Loop: waving the axe, fireworks popping in turn.
sc.loopStart();
const FW = [[12, 13, C.gold], [36, 11, C.sky], [24, 14, C.lime]];
for (let i = 0; i < 3; i++) sc.frame(240, g => {
  tree(g, { notch: 3 });
  const P = him(g, i % 2 ? 'wave_3' : 'wave_2', { eyes: 'happy' }); axe(g, P, 'up');
  FW.forEach(([x, y, c], j) => firework(g, x, y, 1 + (i + j) % 3, c, C.ivory));
  title(g, i === 1 ? C.ivory : C.gold);
});
sc.loopEnd();

sc.frame(400, g => { tree(g, { notch: 3 }); const P = him(g, 'idle', { eyes: 'happy' }); axe(g, P, 'down'); });

// Poof off (the tree goes too).
sc.frame(90, g => { tree(g, { notch: 3 }); const P = him(g, 'idle'); axe(g, P, 'down'); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
