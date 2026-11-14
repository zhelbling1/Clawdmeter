#!/usr/bin/env node
/**
 * "Selling lobbies": made for this fork, AI-drawn with the originals kit.
 * References old-school fantasy MMO fishing: cage-fishing lobsters off the
 * shore and the endless trade-chat cry "selling lobbies". The joke: a crab
 * fishing for lobsters. Generic fisherman costume (sou'wester, bib
 * overalls, yellow wellies); no game sprites, no UI rips.
 *
 * Story: idle → poof (sou'wester, overalls; the sea laps in) → he lowers a
 * lobster pot into the water on a rope, waits, feels a tug → hauls it up
 * with a lobster inside → loop: he holds the lobster up proudly, "SELLING
 * LOBBIES" → poof → idle.
 *
 * Usage: node gaming/lobbies.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, line, stamp, caption } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-SellingLobbies.gif', name: 'selling lobbies', mood: 'calm', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Old School RuneScape: cage-fishing lobsters and the "selling lobbies" trade-chat cry. Generic fisherman costume, no game sprites.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

// Sou'wester: rain hat with a brim that slopes down at the sides.
function souwester(g, P) {
  const [x0, x1] = k.headSpan(P), t = P.head.top;
  rect(g, x0 + 3, t - 3, x1 - 3, t - 3, C.gold);
  rect(g, x0 + 1, t - 2, x1 - 1, t - 1, C.gold);
  rect(g, x0 + 1, t - 1, x1 - 1, t - 1, C.amber);                 // seam
  rect(g, x0 - 1, t, x1 + 1, t, C.gold);
  rect(g, x0 - 2, t + 1, x0, t + 1, C.gold); rect(g, x1, t + 1, x1 + 2, t + 1, C.gold);
  put(g, x0 - 3, t + 2, C.amber); put(g, x1 + 3, t + 2, C.amber);
}
// Navy bib overalls with straps and brass buttons, yellow wellies.
function overalls(g, P) {
  const m = k.midCol(P);
  k.recolour(g, P, (x, y) => y >= P.chin + 2 && y <= P.waist && x >= m - 4 && x <= m + 5, C.navy, C.navy);
  k.recolour(g, P, (x, y) => y > P.waist && y < P.feet, C.navy, C.navy);
  k.recolour(g, P, (x, y) => y >= P.chin && y < P.chin + 2 && (x === m - 4 || x === m + 5), C.navy, C.navy);
  k.onBody(g, P, m - 3, P.chin + 2, C.gold); k.onBody(g, P, m + 4, P.chin + 2, C.gold);
  k.recolour(g, P, (x, y) => y === P.feet, C.gold, C.amber);
}
const fisher = [overalls, souwester];

// ── Props ────────────────────────────────────────────────────────────────────

const SEA = 30;                          // water surface row
// The sea off a sloping shore, out to the stage edge; phase (0..3) rolls the
// little wave crests along and moves the glints.
function sea(g, phase = 0) {
  for (let y = SEA + 1; y <= 36; y++) rect(g, 44 - Math.floor((y - SEA) / 2), y, 53, y, C.blue);
  for (let x = 44; x <= 53; x++) {
    const p = (x + phase) % 5;
    if (p === 0 || p === 1) put(g, x, SEA, C.sky);
    if (p === 2) put(g, x, SEA + 1, C.sky);
  }
  for (const [x, y] of [[47, 34], [51, 33], [49, 36]]) put(g, x + (phase % 2), y, C.sky);
}
// Lobster pot (7×5), top-left at (x, y): brown hoops, tan netting. Cells
// below the water line show navy (submerged). catch: a lobster inside.
function pot(g, x, y, { catchIt = false } = {}) {
  const rows = ['.bbbbb.', 'bnbnbnb', 'b.n.n.b', 'bnbnbnb', 'bbbbbbb'];
  const inside = catchIt ? ['.......', '.......', '..rrr..', '.r.r.r.', '.......'] : null;
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    let c = ch === 'b' ? C.brown : ch === 'n' ? C.tan : null;
    if (inside && inside[j][i] === 'r') c = C.red;
    if (!c) return;
    if (y + j > SEA && g.get(x + i, y + j)) { if (ch === 'n') return; c = c === C.red ? C.maroon : C.navy; }
    put(g, x + i, y + j, c);
  }));
}
// Rope from a hand to the pot's top centre.
const rope = (g, hx, hy, px, py) => line(g, hx + 1, hy, px, py, C.tan);

// Lobster held up by the tail, claws down. claws 0 open / 1 pinched.
function lobster(g, x, y, claws = 0) {
  const body = [
    '...mrm...',
    '....r....',
    '...rrr...',
    '...rmr...',
    '...rrr...',
    '..rrrrr..',
    '.r.rmr.r.',
  ];
  const cl = claws ? ['.rr...rr.', '.rm...mr.', '..r...r..'] : ['rr.....rr', 'rm.....mr', 'r.r...r.r'];
  stamp(g, x, y, body.concat(cl), { r: C.red, m: C.maroon });
}

const splash = (g, x, ph) => {
  const pts = ph ? [[x - 2, SEA - 2], [x + 6, SEA - 3], [x + 2, SEA - 4], [x + 8, SEA - 1]] : [[x, SEA - 1], [x + 5, SEA - 2], [x + 2, SEA - 2]];
  for (const [u, v] of pts) put(g, u, v, C.ivory);
};

// ── Storyboard ───────────────────────────────────────────────────────────────

const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: fisher });
const P0 = k.place('idle');
const puff = (g, ph) => { k.poof(g, P0.centre.x, P0.centre.y - 3, ph); k.poof(g, 48, 32, ph, { scale: 0.45 }); };
const PX = 45;                            // the pot's left column over the water

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: kitted out, the sea laps in.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { sea(g); him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { sea(g); him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { sea(g); him(g, 'idle'); puff(g, 3); });

// The pot goes over the side on its rope.
sc.frame(450, g => { sea(g); const P = him(g, 'turn'); pot(g, PX, 23); rope(g, P.handR.x, P.handR.y, PX + 3, 23); });
sc.frame(220, g => { sea(g, 1); const P = him(g, 'turn', { eyes: 'right' }); pot(g, PX, 28); rope(g, P.handR.x, P.handR.y, PX + 3, 28); splash(g, PX, 0); });
sc.frame(220, g => { sea(g, 2); const P = him(g, 'turn', { eyes: 'right' }); pot(g, PX, 32); rope(g, P.handR.x, P.handR.y, PX + 3, 32); splash(g, PX, 1); });
// He waits. Patience.
sc.frame(700, g => { sea(g, 3); const P = him(g, 'turn', { eyes: 'closed' }); pot(g, PX, 32); rope(g, P.handR.x, P.handR.y, PX + 3, 32); });
// A tug!
sc.frame(250, g => { sea(g, 0); const P = him(g, 'turn', { eyes: 'wide' }); pot(g, PX, 32); rope(g, P.handR.x, P.handR.y + 1, PX + 3, 32);
  splash(g, PX + 1, 0); k.exclaim(g, 40, 14, C.gold); });
// Haul it up: a lobster inside.
sc.frame(160, g => { sea(g, 1); const P = him(g, 'crouch', { eyes: 'wide' }); pot(g, PX, 28, { catchIt: true }); rope(g, P.handR.x, P.handR.y, PX + 3, 28); splash(g, PX, 1); });
sc.frame(320, g => { sea(g, 2); const P = him(g, 'turn', { eyes: 'wide' }); pot(g, PX, 22, { catchIt: true }); rope(g, P.handR.x, P.handR.y, PX + 3, 22);
  for (const [x, y] of [[PX + 1, 28], [PX + 5, 29]]) put(g, x, y, C.sky); });

// Loop: he holds it up proudly. The lobster waves its claws.
sc.loopStart();
const sell = (g) => { caption(g, 'SELLING', 26, 4, C.gold, { align: 'center' }); caption(g, 'LOBBIES', 26, 10, C.gold, { align: 'center' }); };
for (let i = 0; i < 4; i++) sc.frame(300, g => {
  sea(g, i);
  const P = him(g, 'wave_1', { eyes: i === 3 ? 'closed' : 'happy' });
  lobster(g, P.handR.x1 + 1, P.handR.y - 1, i % 2);
  sell(g);
  if (i % 2 === 0) k.sparkle(g, P.handR.x1 + 11, P.handR.y + 2 + i, 2, C.ivory, C.ivory);
});
sc.loopEnd();

sc.frame(450, g => { sea(g, 0); const P = him(g, 'idle', { eyes: 'happy' }); lobster(g, P.handR.x - 1, P.handR.y - 6, 1); });

// Poof off (the sea goes too).
sc.frame(90, g => { sea(g, 1); const P = him(g, 'idle'); lobster(g, P.handR.x - 1, P.handR.y - 6, 1); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
