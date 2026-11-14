#!/usr/bin/env node
/**
 * "The cake is a lie": made for this fork, AI-drawn with the originals kit.
 * References the 2007 test-chamber puzzle game: an orange jumpsuit tied at
 * the waist over a white tank top, spring-heeled long-fall boots, a blue
 * portal on the ceiling and the promised cake that turns out to be a
 * hologram. No logos, no game sprites.
 *
 * Story: idle → poof (tank top, jumpsuit, boots, a fork) → a blue portal
 * opens overhead and a cake drops onto a test pedestal → he reaches over and
 * takes one blissful bite → the cake flickers like a hologram and is gone →
 * loop: he stares at his empty fork ("THE CAKE / IS A LIE") → sigh → poof → idle.
 *
 * Usage: node gaming/cake.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, stamp, caption } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-CakeIsALie.gif', name: 'the cake is a lie', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Portal (2007): orange jumpsuit tied at the waist, white tank top, long-fall boots, a ceiling portal and the cake that was a lie.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

// Orange jumpsuit (a redder orange than his body; his head stays official),
// a white tank top at the collar, the sleeves knotted at the waist, grey
// long-fall boots with a spring heel.
function testSubject(g, P) {
  const [x0, x1] = k.headSpan(P), m = k.midCol(P);
  k.recolour(g, P, (x, y) => y >= P.chin && y < P.feet - 1, C.ginger, C.maroon);
  k.recolour(g, P, (x, y) => y >= P.feet - 1, C.steel, C.slate);
  // The white tank top shows in a V at the open collar.
  for (let y = P.chin; y <= P.chin + 2; y++) {
    const w = 2 - (y - P.chin);
    for (let x = m - w; x <= m + 1 + w; x++) k.onBody(g, P, x, y, C.ivory);
  }
  // Top half's sleeves knotted round the waist.
  k.recolour(g, P, (x, y) => y === P.waist && x >= x0 && x <= x1, C.maroon, C.maroon);
  // The spring blades: a slate hook behind each outer boot.
  for (const [x, d] of [[P.feetX[0] - 1, -1], [P.feetX[1] + 1, 1]]) {
    put(g, x, P.feet - 2, C.slate); put(g, x, P.feet - 1, C.slate); put(g, x + d, P.feet, C.slate);
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

// Fork. 'up': held upright beside a hand at (hx, hy); 'out': pointing right
// from a hand at (hx, hy). bit: a forkful of cake on the tines.
function fork(g, hx, hy, dir = 'up', bit = false) {
  if (dir === 'up') {
    rect(g, hx + 1, hy - 3, hx + 1, hy + 1, C.steel);
    rect(g, hx, hy - 4, hx + 2, hy - 4, C.steel);
    put(g, hx, hy - 5, C.steel); put(g, hx + 2, hy - 5, C.steel); put(g, hx, hy - 6, C.steel); put(g, hx + 2, hy - 6, C.steel);
    if (bit) { rect(g, hx, hy - 7, hx + 2, hy - 6, C.brown); rect(g, hx, hy - 8, hx + 2, hy - 8, C.ivory); put(g, hx + 1, hy - 9, C.red); }
  } else {
    rect(g, hx + 1, hy, hx + 3, hy, C.steel);
    rect(g, hx + 4, hy - 1, hx + 4, hy + 1, C.steel);
    rect(g, hx + 5, hy - 1, hx + 6, hy - 1, C.steel); rect(g, hx + 5, hy + 1, hx + 6, hy + 1, C.steel);
  }
}

// Test pedestal (white column) the cake sits on.
function pedestal(g) {
  rect(g, 46, 29, 53, 29, C.steel);
  rect(g, 47, 30, 52, 36, C.ivory);
  rect(g, 47, 30, 47, 36, C.gray);
  rect(g, 46, 36, 53, 36, C.steel);
}

// Black forest cake, 8 wide, top-left at (46, y). bite takes a chunk from
// its left shoulder. mode 'solid' | 'holo' (blue scanlines, shifted).
const CAKE = [
  '....f...',
  '....w...',
  '.r.w.wr.',
  'wwwwwwww',
  'bbbbbbbb',
  'wwwwwwww',
  'bbbbbbbb',
  'bbbbbbbb',
];
function cake(g, { y = 21, bite = false, mode = 'solid', shift = 0, phase = 0 } = {}) {
  let rows = CAKE.slice();
  if (bite) rows = rows.map((r, i) => (i >= 2 && i <= 4 ? '...' + r.slice(3) : r));
  if (mode === 'solid') {
    stamp(g, 46, y, rows, { f: C.gold, w: C.ivory, r: C.red, b: C.brown });
  } else {
    rows.forEach((r, i) => {
      if ((i + phase) % 2) return;
      stamp(g, 46 + (i % 4 === 0 ? shift : 0), y + i, [r], { f: C.sky, w: C.sky, r: C.blue, b: C.blue });
    });
  }
}

// Blue portal on the ceiling: open 0 (shut) .. 2 (full).
function portal(g, open) {
  if (!open) return;
  if (open === 1) { rect(g, 47, 12, 52, 12, C.blue); rect(g, 48, 12, 51, 12, C.sky); return; }
  rect(g, 47, 11, 52, 11, C.blue);
  rect(g, 46, 12, 53, 12, C.blue); rect(g, 47, 12, 52, 12, C.sky);
  rect(g, 47, 13, 52, 13, C.blue);
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: testSubject });
const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 3, ph);
const forkIdle = (g, P, bit) => fork(g, P.handR.x, P.handR.y0 - 1, 'up', bit);

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: suited up, fork in hand, the pedestal arrives too.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); k.poof(g, 50, 31, 0, { scale: 0.5 }); });
sc.frame(110, g => { const P = him(g, 'idle'); forkIdle(g, P); pedestal(g); puff(g, 1); k.poof(g, 50, 31, 1, { scale: 0.5 }); });
sc.frame(100, g => { const P = him(g, 'idle'); forkIdle(g, P); pedestal(g); puff(g, 2); k.poof(g, 50, 31, 2, { scale: 0.5 }); });
sc.frame(90, g => { const P = him(g, 'idle'); forkIdle(g, P); pedestal(g); puff(g, 3); k.poof(g, 50, 31, 3, { scale: 0.5 }); });

// A portal opens overhead; the cake drops through onto the pedestal.
sc.frame(200, g => { const P = him(g, 'idle', { eyes: 'up' }); forkIdle(g, P); pedestal(g); portal(g, 1); });
sc.frame(90, g => { const P = him(g, 'idle', { eyes: 'right' }); forkIdle(g, P); pedestal(g); portal(g, 2); cake(g, { y: 15 }); k.line(g, 44, 14, 44, 17, C.gray); k.line(g, 45, 10, 45, 12, C.gray); });
sc.frame(140, g => { const P = him(g, 'idle', { eyes: 'wide' }); forkIdle(g, P); pedestal(g); portal(g, 1); cake(g); k.dust(g, 49, 28, 0); });
sc.frame(380, g => { const P = him(g, 'idle', { eyes: 'wide' }); forkIdle(g, P); pedestal(g); cake(g);
  k.sparkle(g, 45, 19, 2, C.gold); k.sparkle(g, 53, 22, 2, C.gold); });

// He leans over and takes a forkful.
sc.frame(200, g => { him(g, 'turn', { eyes: 'right' }); pedestal(g); cake(g); });
sc.frame(130, g => { const P = him(g, 'point_1'); pedestal(g); cake(g); fork(g, P.handR.x, P.handR.y, 'out'); });
sc.frame(220, g => { const P = him(g, 'point'); pedestal(g); cake(g); fork(g, P.handR.x, P.handR.y, 'out'); });
sc.frame(200, g => { const P = him(g, 'turn', { eyes: 'wide' }); pedestal(g); cake(g, { bite: true }); fork(g, P.handR.x - 1, P.handR.y + 1, 'up', true); });
// Bliss.
sc.frame(160, g => { const P = him(g, 'squash', { eyes: 'closed' }); pedestal(g); cake(g, { bite: true }); forkIdle(g, P); });
sc.frame(520, g => { const P = him(g, 'idle', { eyes: 'happy' }); pedestal(g); cake(g, { bite: true }); forkIdle(g, P);
  caption(g, '*', 12, 16, C.red); caption(g, '*', 38, 12, C.red); });

// The cake flickers like a hologram and switches off.
sc.frame(110, g => { const P = him(g, 'idle', { eyes: 'happy' }); pedestal(g); cake(g, { bite: true, mode: 'holo', shift: 1 }); forkIdle(g, P); });
sc.frame(90, g => { const P = him(g, 'idle', { eyes: 'right' }); pedestal(g); cake(g, { bite: true, mode: 'holo', shift: -1, phase: 1 }); forkIdle(g, P); });
sc.frame(80, g => { const P = him(g, 'idle', { eyes: 'right' }); pedestal(g); rect(g, 46, 25, 53, 25, C.sky); forkIdle(g, P); });
sc.frame(280, g => { const P = him(g, 'idle', { eyes: 'wide' }); pedestal(g); forkIdle(g, P); });

// Loop: he stares at the empty fork.
sc.loopStart();
const lie = (g, c) => { caption(g, 'THE CAKE', 22, 9, c, { align: 'center' }); caption(g, 'IS A LIE', 22, 15, c, { align: 'center' }); };
sc.frame(700, g => { const P = him(g, 'idle', { eyes: 'right' }); pedestal(g); lie(g, C.ivory); forkIdle(g, P); });
sc.frame(130, g => { const P = him(g, 'idle', { eyes: 'closed' }); pedestal(g); lie(g, C.ivory); forkIdle(g, P); });
sc.frame(600, g => { const P = him(g, 'idle', { eyes: 'right' }); pedestal(g); lie(g, C.gray); forkIdle(g, P); });
sc.loopEnd();

// Sigh.
sc.frame(200, g => { const P = him(g, 'crouch', { eyes: 'closed' }); pedestal(g); forkIdle(g, P); });
sc.frame(400, g => { const P = him(g, 'idle', { eyes: 'closed' }); pedestal(g); forkIdle(g, P); });

// Poof off.
sc.frame(90, g => { const P = him(g, 'idle'); forkIdle(g, P); pedestal(g); puff(g, 0); k.poof(g, 50, 31, 0, { scale: 0.5 }); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); k.poof(g, 50, 31, 1, { scale: 0.5 }); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); k.poof(g, 50, 31, 2, { scale: 0.5 }); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); k.poof(g, 50, 31, 3, { scale: 0.5 }); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
