#!/usr/bin/env node
/**
 * "Party hat drop": made for this fork, AI-drawn with the originals kit.
 * References the legendary holiday item drop of old-school fantasy MMOs:
 * paper-crown party hats raining down, everyone scrambling, one lucky
 * winner. Generic paper crown in blue; no game sprites, no UI rips.
 *
 * Story: idle → poof (bow tie) → blue party hats start raining; two more
 * Clawds (in shadow, in the background) rush in and leap for them → a hat
 * lands square on his head → loop: smug, adjusting his crown while the
 * others scramble and confetti falls → they run off → poof → idle.
 *
 * Usage: node gaming/partyhat.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, stamp } = k;
const { inFront } = require('./props');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-PartyHat.gif', name: 'party hat drop', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Old School RuneScape: the rare blue party hat, the holiday item drop and the scramble for it. Generic paper crown, no game sprites.',
});

// ── Costume and props ────────────────────────────────────────────────────────

// Bow tie at the chin.
function bowTie(g, P) {
  const m = k.midCol(P), y = P.chin;
  rect(g, m - 2, y, m - 1, y + 1, C.pink); rect(g, m + 2, y, m + 3, y + 1, C.pink);
  rect(g, m, y, m + 1, y, C.maroon);
}
// Paper party crown (15 wide, 5 tall), bottom row at y, left at x.
const CROWN = [
  '#.....#.....#..',
  '##...###...##..',
  '###.#####.###..',
  '#####s#####s###',
  '###############',
];
function crown(g, x, y) {
  stamp(g, x, y - 4, CROWN.map(r => r.padEnd(15, '.')), { '#': C.blue, s: C.sky });
  rect(g, x + 14, y - 1, x + 14, y, C.navy);     // shaded back
  rect(g, x, y - 1, x + 14, y - 1, C.sky);       // band highlight
  for (const i of [2, 6, 10]) put(g, x + i, y - 1, C.blue);
}
// The crown worn on his head.
function wearCrown(dy = 0) {
  return (g, P) => { const [x0] = k.headSpan(P); crown(g, x0, P.head.top - 1 - dy); };
}
// A small hat tumbling in the distance (7×3); tilt 0/1 alternates.
function smallHat(g, x, y, tilt = 0) {
  const rows = tilt ? ['#.#.#..', '######.', '.s#####'] : ['#..#..#', '#######', '##s####'];
  stamp(g, x, y, rows, { '#': C.blue, s: C.sky });
}
// Other Clawds in the background: the same official cells, in his shade.
function rival(g, pose, opts = {}) {
  const P = k.place(pose, opts);
  for (const [x, y, t] of P.cells) put(g, x, y, t === 'e' ? C.eye : C.shade);
  return P;
}
const confetti = (g, ph) => {
  const pts = [[8, 10, C.pink], [18, 7, C.gold], [36, 9, C.lime], [45, 12, C.pink], [13, 16, C.lime], [41, 6, C.gold], [27, 7, C.pink]];
  pts.forEach(([x, y, c], i) => put(g, x + ((ph + i) % 2), y + ph * 2 + (i % 3), c));
};

// ── Storyboard ───────────────────────────────────────────────────────────────

// He is drawn in front of the rivals with a dark gap around him.
const him = (g, pose, opts = {}) => {
  let P;
  inFront(g, h => { P = k.clawd(h, pose, { ...opts, over: [bowTie].concat(opts.hat ? [wearCrown(opts.hatLift || 0)] : []) }); });
  return P;
};
const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 3, ph);
const L = -12, R = 12;          // the rivals' offsets (behind him, half hidden)

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: dressed for the party.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { him(g, 'idle'); puff(g, 3); });

// Hats start to fall. The rivals rush in.
sc.frame(350, g => { him(g, 'idle', { eyes: 'up' }); k.sparkle(g, 27, 9, 3, C.gold); });
sc.frame(160, g => { him(g, 'idle', { eyes: 'up' }); smallHat(g, 10, 9); smallHat(g, 39, 10, 1); crown(g, 19, 13); });
sc.frame(160, g => { rival(g, 'crab_1', { dx: L - 6, eyes: 'up' }); rival(g, 'crab_5', { dx: R + 6, flip: true, eyes: 'up' });
  him(g, 'idle', { eyes: 'wide' }); smallHat(g, 9, 13, 1); smallHat(g, 41, 14); crown(g, 19, 15); k.motionLines(g, 26, 9, { dir: 'up', len: 2, count: 2, gap: 3 }); });
sc.frame(150, g => { rival(g, 'jump_up', { dx: L, eyes: 'up' }); rival(g, 'jump_up', { dx: R, flip: true, eyes: 'up' });
  him(g, 'idle', { eyes: 'up' }); smallHat(g, 8, 17); smallHat(g, 42, 18, 1); crown(g, 19, 17); });
sc.frame(150, g => { rival(g, 'jump_top', { dx: L, eyes: 'up' }); rival(g, 'jump_top', { dx: R, flip: true, eyes: 'up' });
  him(g, 'crouch', { eyes: 'up' }); smallHat(g, 6, 23, 1); smallHat(g, 44, 24); crown(g, 19, 19); });
// BONK: right on his head.
sc.frame(150, g => { rival(g, 'jump_fall', { dx: L, eyes: 'wide' }); rival(g, 'jump_fall', { dx: R, flip: true, eyes: 'wide' });
  him(g, 'squash', { eyes: 'closed', hat: true }); k.sparkle(g, 18, 15, 2, C.gold); k.sparkle(g, 36, 16, 2, C.gold); });
sc.frame(260, g => { rival(g, 'jump_land', { dx: L, eyes: 'wide' }); rival(g, 'jump_land', { dx: R, flip: true, eyes: 'wide' });
  him(g, 'idle', { eyes: 'wide', hat: true }); });

// Loop: smug. He adjusts his crown; the others scramble for the leftovers.
sc.loopStart();
const crab = ['crab_0', 'crab_2', 'crab_4', 'crab_6'];
for (let i = 0; i < 4; i++) sc.frame(220, g => {
  rival(g, crab[i], { dx: L - 2 + (i % 2), eyes: 'right' }); rival(g, crab[(i + 2) % 4], { dx: R + 2 - (i % 2), flip: true, eyes: 'left' });
  if (i < 2) him(g, 'wave_1', { eyes: 'closed', hat: true });
  else him(g, 'idle', { eyes: 'closed', hat: true });
  confetti(g, i);
  if (i % 2 === 0) k.sparkle(g, 20 + i * 4, 13, 3, C.ivory, C.ivory);
});
sc.loopEnd();

// The rivals give up and run off.
sc.frame(160, g => { rival(g, 'crab_3', { dx: L - 10, flip: true, eyes: 'closed' }); rival(g, 'crab_7', { dx: R + 10, eyes: 'closed' });
  him(g, 'idle', { eyes: 'happy', hat: true }); });
sc.frame(400, g => { him(g, 'idle', { eyes: 'happy', hat: true }); });

// Poof off.
sc.frame(90, g => { him(g, 'idle', { hat: true }); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
