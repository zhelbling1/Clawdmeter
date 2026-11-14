#!/usr/bin/env node
/**
 * "Cardboard box": made for this fork, AI-drawn with the originals kit.
 * References the stealth-game classic: a soldier hiding under a cardboard
 * box, sneaking about, and the red "!" alert when he's spotted. Generic
 * bandana and sneaking suit; no game sprites, no logos.
 *
 * Story: idle → poof (bandana, sneaking suit) → a cardboard box drops over
 * him; his eyes peer out of the hand-hole → the box sneaks left on little
 * legs, then back → it stops… and pops up: there he is, "!" with an alert
 * flash → loop: frozen, the "!" blaring → the box drops back over him; he
 * peers out, hopeful → poof → idle.
 *
 * Usage: node gaming/box.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-CardboardBox.gif', name: 'cardboard box', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Metal Gear Solid (1998): hiding under a cardboard box, the bandana and sneaking suit, the red "!" alert. No game sprites.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

function sneakingSuit(g, P) {
  k.jumpsuit(g, P, { c: C.charcoal, dark: C.charcoal, boots: C.slate });
  const [x0, x1] = k.headSpan(P);
  // Webbing belt with a pouch, and a collar.
  k.recolour(g, P, (x, y) => y === P.waist && x >= x0 && x <= x1, C.slate, C.slate);
  const m = k.midCol(P);
  k.onBody(g, P, m - 4, P.waist - 1, C.slate); k.onBody(g, P, m - 3, P.waist - 1, C.slate);
  for (let x = m - 2; x <= m + 3; x++) k.onBody(g, P, x, P.chin, C.slate);
}
const snake = [sneakingSuit, (g, P) => k.bandana(g, P, { c: C.navy, knot: C.blue })];

// ── The box ──────────────────────────────────────────────────────────────────

const BW = 24, BH = 12;
// Box with its top-left at (x, y). The hand-hole (x+5..x+18, row 5..6) is a
// window: whatever is under it (his eyes) shows through; empty, it's dark.
function box(g, x, y, { window = true } = {}) {
  const hole = (i, j) => window && j >= 5 && j <= 6 && i >= 5 && i <= 18;
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
    if (hole(i, j)) { if (!g.get(x + i, y + j)) put(g, x + i, y + j, C.eye); continue; }
    let c = C.tan;
    if (j === 0 || i === 0 || i === BW - 1 || j === BH - 1) c = C.brown;
    else if (j === 2) c = C.brown;                         // flap edge
    else if (j === 1 && i >= 10 && i <= 13) c = C.amber;    // tape
    else if (i === 15 && j > 2) c = C.amber;                // seam
    put(g, x + i, y + j, c);
  }
}
// Him crouched under the box at dx: only his legs (a crab-walk frame) and
// the eyes behind the hand-hole show.
function underBox(g, dx, { legs = 'crab_0', eyes = null } = {}) {
  const P = k.place('crouch', { dx, eyes });
  const L = k.place(legs, { dx });
  for (const [x, y, t] of L.cells) if (y >= 35) put(g, x, y, C.slate);        // boots
  for (const [x, y, t] of P.cells) if (y >= 28 && y <= 29) put(g, x, y, t === 'e' ? C.eye : C.body);
  box(g, 15 + dx, 23);
}
// The red "!" (2×6) and its flash: strokes out to the sides and below the
// box, never into it.
function bang(g, x, y) { rect(g, x, y, x + 1, y + 3, C.red); rect(g, x, y + 5, x + 1, y + 5, C.red); }
function flash(g, x, y, ph, c) {
  const r = 3 + ph;
  for (const s of [-1, 1]) {
    rect(g, x + s * r - (s < 0 ? 1 : 0), y + 2, x + s * r + (s > 0 ? 1 : 0), y + 2, c);
    k.line(g, x + s * (r - 1), y - 1, x + s * (r + 1), y - 2, c);
    k.line(g, x + s * (r - 1), y + 5, x + s * (r + 1), y + 6, c);
  }
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: snake });
const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 3, ph);

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { him(g, 'idle'); puff(g, 3); });
sc.frame(350, g => him(g, 'idle', { eyes: 'left' }));

// The box drops over him.
sc.frame(110, g => { him(g, 'crouch', { eyes: 'up' }); box(g, 15, 9, { window: false }); k.motionLines(g, 17, 3, { dir: 'up', len: 3, count: 2, gap: 19 }); });
sc.frame(200, g => { underBox(g, 0, { legs: 'crouch' }); k.dust(g, 15, 36, 0); k.dust(g, 38, 36, 0); });
sc.frame(350, g => underBox(g, 0, { legs: 'crouch', eyes: 'left' }));

// It sneaks left on little legs… and back.
const sneak = [[-3, 'crab_1', 'left'], [-6, 'crab_3', 'left'], [-6, 'crab_5', 'right'], [-3, 'crab_7', 'right'], [0, 'crab_1', 'right']];
for (const [dx, legs, eyes] of sneak) sc.frame(150, g => underBox(g, dx, { legs, eyes }));
sc.frame(400, g => underBox(g, 0, { legs: 'crouch', eyes: 'up' }));

// It pops up. "!"
sc.frame(110, g => { him(g, 'stretch', { eyes: 'wide' }); box(g, 15, 3, { window: false }); });
sc.loopStart();
for (let i = 0; i < 3; i++) sc.frame(i === 0 ? 300 : 220, g => {
  him(g, 'idle', { eyes: 'wide' });
  box(g, 15, 1 + (i % 2), { window: false });
  bang(g, 26, 14);
  flash(g, 26.5, 14, i % 2, i === 1 ? C.gold : C.ivory);
});
sc.loopEnd();

// The box drops back down. Maybe nobody noticed.
sc.frame(110, g => { him(g, 'crouch', { eyes: 'closed' }); box(g, 15, 14, { window: false }); });
sc.frame(200, g => { underBox(g, 0, { legs: 'crouch', eyes: 'closed' }); k.dust(g, 15, 36, 1); k.dust(g, 38, 36, 1); });
sc.frame(450, g => underBox(g, 0, { legs: 'crouch', eyes: 'right' }));

// Poof off (the box with it).
sc.frame(90, g => { underBox(g, 0, { legs: 'crouch' }); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
