#!/usr/bin/env node
/**
 * "Zombie dance": made for this fork, AI-drawn with the originals kit.
 * References the famous early-80s horror music video's group dance: a full
 * moon, a stiff shuffle with arms out, the sideways claw dance, shoulder
 * shrugs and a bow. Costume: red jacket with black V stripes and shoulder
 * pads. Cartoon only: no gore, no likeness, no lyrics, no title.
 *
 * Story: idle → poof (jacket; the full moon comes up behind) → he lurches
 * along with zombie arms → loop: claws up on the right, step, claws on the
 * left, step, shrug, shrug → a deep bow, ^‿^ → poof (moon gone) → idle.
 *
 * Usage: node music/zombie.js [--fast] [--no-preview]
 */
const k = require('../kit');
const m = require('./props');
const { C } = k;

const sc = k.scene({
  dir: __dirname, file: 'Clawd-ZombieDance.gif', name: 'zombie dance', mood: 'active', headroom: 0,
  credit: m.CREDIT,
  references: 'The famous early-80s horror music video dance: full moon, zombie shuffle, sideways claw dance, shoulder shrugs; red jacket with black V stripes and shoulder pads.',
});

// ── Costume and set ──────────────────────────────────────────────────────────

const MOON = [40, 11];
const sky = (g) => m.moon(g, MOON[0], MOON[1], 6);

// Hands raised high (above the eyes) come out of the sleeve orange, with
// three white claw tips.
function claws(g, P) {
  for (const h of [P.handL, P.handR]) {
    if (!h || h.y0 >= P.eyeY) continue;
    const x0 = h.dir === 'up' ? h.x0 : h.dir < 0 ? h.x : h.x - 3;
    for (let y = h.y0; y <= h.y0 + 1; y++) for (let x = x0; x <= x0 + 3; x++) if (P.at(x, y)) g.put(x, y, C.body);
    for (const dx of [0, 2, 3]) g.put(x0 + dx, h.y0 - 1, C.ivory);
  }
}
function dressed(g, P) {
  k.redJacket(g, P);
  m.shoulderPads(g, P);
  claws(g, P);
}
const him = (g, pose, o = {}) => k.clawd(g, pose, { ...o, over: dressed });

// ── Moves ────────────────────────────────────────────────────────────────────

const Z = {
  // the lurch: walking legs, the pointing arm stuck out in front
  walk: [0, 1, 2, 3].map(i => m.derive('zb_w' + i, 'walk_' + i, { graft: [{ pose: 'point_3', side: 1, dx: 0 }] })),
  // claws up on the right: right hand high, left at the shoulder, leaning in
  claw: m.derive('zb_claw', 'idle', { armR: [0, -6], armL: [0, -3], lean: 2, block: 4 }),
  clawStep: m.derive('zb_claw2', 'idle', { armR: [0, -5], armL: [0, -2], lean: 3, block: 4, drop: 1, kick: { leg: 3, dx: 2 } }),
  // shoulder shrugs
  shrugL: m.derive('zb_sl', 'idle', { armL: [0, -2], armR: [0, 1] }),
  shrugUp: m.derive('zb_su', 'idle', { armL: [0, -2], armR: [0, -2], drop: 1 }),
};

// ── Storyboard ───────────────────────────────────────────────────────────────

m.open(sc, g => { sky(g); him(g, 'idle'); });

// The lurch: stiff steps to the right, arm out.
Z.walk.forEach((p, i) => sc.frame(170, g => { sky(g); him(g, p, { dx: i, eyes: i % 2 ? 'up' : null }); }));
sc.frame(160, g => { sky(g); him(g, 'idle', { dx: 3, eyes: 'closed' }); });

// Loop: claw dance right, claw dance left, shrug, shrug.
sc.loopStart();
sc.frame(150, g => { sky(g); him(g, Z.claw, { dx: 2 }); });
sc.frame(170, g => { sky(g); him(g, Z.clawStep, { dx: 3 }); k.dust(g, 37, 36, 0, { dir: 1 }); });
sc.frame(150, g => { sky(g); him(g, Z.claw, { dx: -2, flip: true }); });
sc.frame(170, g => { sky(g); him(g, Z.clawStep, { dx: -3, flip: true }); k.dust(g, 16, 36, 0, { dir: -1 }); });
sc.frame(140, g => { sky(g); him(g, Z.shrugL); });
sc.frame(140, g => { sky(g); him(g, Z.shrugL, { flip: true }); });
sc.frame(170, g => { sky(g); him(g, Z.shrugUp); k.note(g, 12, 13, C.sky, { flip: true }); });
sc.frame(150, g => { sky(g); him(g, 'idle', { dx: 1 }); });
sc.loopEnd();

// The bow, then content.
sc.frame(180, g => { sky(g); him(g, 'crouch', { eyes: 'closed' }); });
sc.frame(420, g => { sky(g); him(g, 'jump_crouch', { eyes: 'closed' }); });
sc.frame(520, g => { sky(g); him(g, 'idle', { eyes: 'happy' }); });

m.close(sc, g => { sky(g); him(g, 'idle'); });

sc.finish();
