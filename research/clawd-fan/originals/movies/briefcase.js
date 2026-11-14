#!/usr/bin/env node
/**
 * "The briefcase": made for this fork, AI-drawn with the originals kit.
 * References the glowing-briefcase scene from a 1994 crime film: slicked
 * hair, skinny black tie, a case that lights up the face of whoever opens
 * it, contents never shown. Caricature only, no likeness, no logos.
 *
 * Story: idle → poof (hair, tie, a case on a side table) → he turns to the
 * case, reaches out, CLICK → the lid swings up and golden light floods his
 * face (loop: the light shimmers) → he slowly closes it, satisfied nod →
 * poof → idle.
 *
 * Usage: node movies/briefcase.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, line, put, caption } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-Briefcase.gif', name: 'the briefcase', mood: 'calm', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The glowing briefcase from Pulp Fiction (1994): slicked-back hair, skinny black tie, golden light from an unseen inside.',
});

// ── Props ────────────────────────────────────────────────────────────────────

// Side table at hand height right of Clawd; the case sits on it.
function table(g) {
  rect(g, 41, 29, 53, 29, C.brown);
  rect(g, 42, 30, 43, 36, C.brown);
  rect(g, 51, 30, 52, 36, C.brown);
}

// The case, x 43..52 on the table. lid: 0 shut, 1 / 2 opening, 3 open (lid
// stands up behind it, hinged at the far right). latches 'down' | 'up'.
function briefcase(g, { lid = 0, latches = 'down', inside = C.glow } = {}) {
  const x0 = 43, x1 = 52;
  rect(g, x0, 27, x1, 28, C.charcoal);                   // base
  rect(g, x0, 28, x1, 28, C.slate);                      // base edge
  if (lid === 0) {
    rect(g, x0, 25, x1, 26, C.charcoal);                 // lid, shut
    rect(g, x0, 25, x1, 25, C.slate);
    rect(g, 46, 23, 49, 23, C.charcoal);                 // handle
    put(g, 46, 24, C.charcoal); put(g, 49, 24, C.charcoal);
    const ly = latches === 'up' ? 25 : 26;
    for (const x of [44, 51]) rect(g, x, ly, x, ly + 1, C.gold);
    return;
  }
  // Open: the inside of the base shows, lit.
  rect(g, x0 + 1, 26, x1 - 1, 26, inside);
  for (const x of [44, 51]) put(g, x, 27, C.gold);
  // The lid swings about its hinge at (52, 26).
  const tip = { 1: [44, 22], 2: [47, 18], 3: [52, 16] }[lid];
  line(g, 52, 26, tip[0], tip[1], C.charcoal);
  line(g, 51, 26, tip[0] - 1, tip[1] + (lid === 3 ? 0 : 1), C.charcoal);
  line(g, 52, 25, tip[0], tip[1] - 1 + (lid === 3 ? 1 : 0), C.slate);
}

// Golden light from the open case onto his face. level 1 (a glimmer),
// 2 (rising), 3 (full); shift 0/1 moves the rays a cell for the shimmer.
// The rays pass above his reaching arm and end on the lit side of his face.
function light(g, P, level, shift = 0) {
  const rays = [                     // [from, to, colour]
    [[45, 25], [35, 21 + shift], C.glow],
    [[47, 25], [36, 18 - shift], C.gold],
    [[44, 25], [37, 23], C.gold],
    [[49, 24], [39 + shift, 14], C.glow],
  ];
  const n = { 1: 2, 2: 3, 3: 4 }[level];
  const t = level === 1 ? 0.5 : 1;
  rays.slice(0, n).forEach(([a, b, c], i) => {
    const tt = level === 2 && i === 2 ? 0.6 : t;
    line(g, a[0], a[1], Math.round(a[0] + (b[0] - a[0]) * tt), Math.round(a[1] + (b[1] - a[1]) * tt), c);
  });
  // His face catches it: a warm patch on the side turned to the case.
  if (level >= 2) for (const [x, y] of [[34, 21], [34, 22], [33, 22], [34, 23]]) g.tint(x, y, C.glow);
  if (level === 3) for (const [x, y] of [[33, 21], [32 - shift, 21], [34, 24]]) g.tint(x, y, C.gold);
  // Keep his eyes on top of the light.
  for (const [x, y, tp] of P.cells) if (tp === 'e') g.put(x, y, C.eye);
}

// ── Costume ──────────────────────────────────────────────────────────────────

const dressed = (g, P) => { k.slick(g, P); k.tie(g, P); };
const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: dressed });

// ── Storyboard ───────────────────────────────────────────────────────────────

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: the suit-up, and the table + case arrive in a puff of their own.
const P0 = k.place('idle');
sc.frame(90, g => { k.clawd(g, 'idle'); k.poof(g, P0.centre.x, P0.centre.y - 3, 0); k.poof(g, 47, 27, 0, { scale: 0.6 }); });
sc.frame(110, g => { him(g, 'idle'); table(g); briefcase(g); k.poof(g, P0.centre.x, P0.centre.y - 3, 1); k.poof(g, 47, 27, 1, { scale: 0.6 }); });
sc.frame(100, g => { him(g, 'idle'); table(g); briefcase(g); k.poof(g, P0.centre.x, P0.centre.y - 3, 2); k.poof(g, 47, 27, 2, { scale: 0.6 }); });
sc.frame(90, g => { him(g, 'idle'); table(g); briefcase(g); k.poof(g, P0.centre.x, P0.centre.y - 3, 3); k.poof(g, 47, 27, 3, { scale: 0.6 }); });

// He eyes the case, turns to it, reaches: CLICK.
sc.frame(350, g => { him(g, 'idle', { eyes: 'right' }); table(g); briefcase(g); });
sc.frame(250, g => { him(g, 'turn'); table(g); briefcase(g); });
sc.frame(130, g => { him(g, 'point_1'); table(g); briefcase(g); });
sc.frame(160, g => { him(g, 'point'); table(g); briefcase(g, { latches: 'up' });
  k.sparkle(g, 44, 23, 2, C.gold); k.sparkle(g, 51, 23, 2, C.gold); caption(g, 'CLICK', 43, 14, C.ivory, { align: 'center' }); });
sc.frame(200, g => { him(g, 'turn'); table(g); briefcase(g, { latches: 'up' }); caption(g, 'CLICK', 43, 14, C.gray, { align: 'center' }); });

// The lid swings up; the light rises onto his face.
sc.frame(140, g => { const P = him(g, 'turn'); table(g); briefcase(g, { lid: 1 }); light(g, P, 1); });
sc.frame(140, g => { const P = him(g, 'turn', { eyes: 'wide' }); table(g); briefcase(g, { lid: 2 }); light(g, P, 2); });
sc.frame(260, g => { const P = him(g, 'turn', { eyes: 'wide' }); table(g); briefcase(g, { lid: 3 }); light(g, P, 3); });

// Loop: the light shimmers, sparkles drift up out of the case.
sc.loopStart();
const sparks = [[[45, 21], [50, 13]], [[48, 19], [42, 15]], [[46, 15], [51, 20]], [[49, 16], [44, 18]]];
sparks.forEach(([a, b], i) => sc.frame(170, g => {
  const P = him(g, 'turn', { eyes: i === 2 ? 'happy' : 'wide' }); table(g); briefcase(g, { lid: 3 });
  light(g, P, 3, i % 2);
  k.sparkle(g, a[0], a[1], i % 2 ? 2 : 3, C.glow); k.sparkle(g, b[0], b[1], 1, C.gold);
}));
sc.loopEnd();

// He slowly closes it; the light sinks back in. Satisfied.
sc.frame(320, g => { const P = him(g, 'turn', { eyes: 'happy' }); table(g); briefcase(g, { lid: 2 }); light(g, P, 2); });
sc.frame(320, g => { const P = him(g, 'turn', { eyes: 'happy' }); table(g); briefcase(g, { lid: 1 }); light(g, P, 1); });
sc.frame(380, g => { him(g, 'turn', { eyes: 'closed' }); table(g); briefcase(g, { latches: 'up' }); });
sc.frame(160, g => { him(g, 'crouch', { eyes: 'happy' }); table(g); briefcase(g); });    // the nod
sc.frame(380, g => { him(g, 'idle', { eyes: 'happy' }); table(g); briefcase(g); });

// Poof off.
sc.frame(90, g => { him(g, 'idle'); table(g); briefcase(g); k.poof(g, P0.centre.x, P0.centre.y - 3, 0); k.poof(g, 47, 27, 0, { scale: 0.6 }); });
sc.frame(110, g => { k.clawd(g, 'idle'); k.poof(g, P0.centre.x, P0.centre.y - 3, 1); k.poof(g, 47, 27, 1, { scale: 0.6 }); });
sc.frame(100, g => { k.clawd(g, 'idle'); k.poof(g, P0.centre.x, P0.centre.y - 3, 2); k.poof(g, 47, 27, 2, { scale: 0.6 }); });
sc.frame(90, g => { k.clawd(g, 'idle'); k.poof(g, P0.centre.x, P0.centre.y - 3, 3); k.poof(g, 47, 27, 3, { scale: 0.6 }); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
