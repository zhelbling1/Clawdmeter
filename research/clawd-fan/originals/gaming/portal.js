#!/usr/bin/env node
/**
 * "Portal fall": made for this fork, AI-drawn with the originals kit.
 * References the infinite-fall trick from Portal (2007): a blue portal on
 * the floor, an orange one straight above it on the ceiling, and whoever
 * drops in keeps falling out of the ceiling and back into the floor, faster
 * every pass. No logos, no game UI, no cake.
 *
 * Story: idle → both portals shoot open (blue under his feet, orange on the
 * ceiling) → a cartoon hover, "!" → he drops in, his feet already poking out
 * of the ceiling → each pass faster (eyes wide, arms flung up, speed lines)
 * → loop: the top-speed fall, two passes, seamless through the portals →
 * the floor portal snaps shut, he shoots out of the ceiling one last time,
 * the orange one fizzles out, SPLAT → dizzy stars → idle.
 *
 * The fall is drawn on a closed track: the visible column between the two
 * portal planes (rows CY..FY-1) is one lap of D rows, and anything that
 * passes the floor plane comes out of the ceiling plane (y - D). So the cut
 * through the floor and the cut through the ceiling always line up.
 *
 * Usage: node gaming/portal.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, line, put } = k;
const { layer } = require('./props');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-PortalFall.gif', name: 'portal fall', mood: 'active', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'Portal (2007): the infinite fall between a blue floor portal and an orange ceiling portal, faster every pass. Generic oval portals; no logos, game UI or cake.',
});

// ── Portals ──────────────────────────────────────────────────────────────────

// A portal orange well clear of Clawd's body orange: brighter and yellower,
// with a pale glow edge and a dark inside, so he never melts into it.
const ORANGE = [0xFF, 0x9C, 0x1A];
const BLUE = { rim: C.blue, glow: C.sky, hole: C.charcoal };
const ORNG = { rim: ORANGE, glow: C.glow, hole: C.charcoal };

const CX = 26.5;
const FLOOR_CY = 33, CEIL_CY = 3;    // portal centre rows
const FY = 34, CY = 3;               // planes: he shows on rows CY..FY-1
const D = FY - CY;                   // one lap of the fall

// An oval seen almost edge-on (a flat ellipse), 30 cells wide at size 1.
// part: 'all' | 'back' (the far rim and the hole) | 'front' (the near rim).
// near: +1 if the near rim is the lower one (a floor), -1 (a ceiling).
function portal(g, cy, col, { size = 1, part = 'all', near = 1 } = {}) {
  const a = 14.6 * size, b = 3.6 * Math.max(size, 0.4);
  for (let y = Math.floor(cy - b - 1); y <= Math.ceil(cy + b + 1); y++)
    for (let x = Math.floor(CX - a - 1); x <= Math.ceil(CX + a + 1); x++) {
      const u = (x - CX) / a, v = (y - cy) / b, d = u * u + v * v;
      if (d > 1) continue;
      const isNear = (y - cy) * near > 0;
      if (part === 'front' && !isNear) continue;
      // Rim: the outer band; glow: a band just inside it; hole: the rest.
      const inner = (x - CX) ** 2 / Math.max(a - 2.2, 0.5) ** 2 + (y - cy) ** 2 / Math.max(b - 1, 0.4) ** 2;
      const glowB = (x - CX) ** 2 / Math.max(a - 4.2, 0.5) ** 2 + (y - cy) ** 2 / Math.max(b - 1.6, 0.4) ** 2;
      const c = inner > 1 ? col.rim : glowB > 1 ? col.glow : col.hole;
      if (part === 'front' && c !== col.rim) continue;
      if (part === 'back' && isNear && c === col.rim) continue;
      g.put(x, y, c);
    }
}
// Opening / closing: a bright slit with sparks flying off its ends.
function slit(g, cy, col, w = 6) {
  line(g, CX - w, cy, CX + w, cy, col.rim);
  line(g, CX - w + 2, cy, CX + w - 2, cy, col.glow);
}
function sparks(g, cy, col, phase, spread = 1) {
  const pts = phase % 2 ? [[-11, -3], [11, -3], [-14, 2], [14, 2], [-6, 4], [6, -4]] : [[-13, -2], [13, -2], [-9, 3], [9, 3], [-14, 0], [14, 0]];
  for (const [u, v] of pts) put(g, Math.max(12, Math.min(41, Math.round(CX + u * spread))), Math.max(0, Math.round(cy + v * spread)), phase % 2 ? col.glow : col.rim);
}

// ── Clawd on the track ───────────────────────────────────────────────────────

// Wrap a virtual row onto the visible column between the planes.
const wrap = (y) => CY + (((y - CY) % D) + D) % D;

// Clawd in `pose`, feet on virtual row `feet` (36 = standing on the floor),
// with `lines` speed streaks trailing above him, drawn through the portals.
// out: the floor portal has shut, so nothing wraps: he is drawn at feet
// (a screen row) and only clipped by the ceiling plane while `ceiling`.
function faller(g, pose, feet, { eyes = null, lines = 0, len = 0, out = false, ceiling = true } = {}) {
  const P = k.place(pose);
  const lift = feet - P.feet;
  const L = layer(11, h => {
    k.clawd(h, pose, { eyes });
    // Speed streaks above his head, staggered; the outer ones longer.
    const top = Math.min(...P.cells.map(c => c[1]));
    const cols = [[P.head.x0 - 2, 2], [P.head.x0 + 3, 0], [Math.floor(P.head.cx), 1], [P.head.x1 - 3, 0], [P.head.x1 + 2, 2]];
    cols.slice(0, lines).forEach(([x, st], i) => {
      const l = Math.max(2, len - st);
      line(h, x, top - 1 - st, x, top - st - l, i % 2 ? C.gray : C.ivory);
    });
  });
  for (let y = L.top; y < k.STAGE_H; y++) for (let x = 0; x < k.W; x++) {
    const c = L.get(x, y); if (!c) continue;
    if (!out) g.put(x, wrap(y + lift), c);
    else if (!ceiling || y + lift >= CY) g.put(x, y + lift, c);
  }
}
// One fall frame: ceiling portal, the floor portal's back, him, its front.
function fallFrame(g, pose, feet, opts = {}) {
  portal(g, CEIL_CY, ORNG, { near: -1 });
  portal(g, FLOOR_CY, BLUE, { part: 'back' });
  faller(g, pose, feet, opts);
  portal(g, FLOOR_CY, BLUE, { part: 'front' });
}

// Dizzy stars orbiting above his head (phase 0..3).
function dizzy(g, P, phase) {
  const cx = P.head.cx, y = P.head.top - 3;
  const orbit = [[-7, 0], [-4, -2], [0, -2.6], [4, -2], [7, 0], [4, 1.6], [0, 2], [-4, 1.6]];
  [0, 3, 6].forEach((o, i) => {
    const [u, v] = orbit[(o + phase * 2) % orbit.length];
    const front = v > 0;
    k.sparkle(g, cx + u, y + v, front ? 2 : 1, i === 1 ? C.sky : C.gold, C.glow);
  });
}

// ── Storyboard ───────────────────────────────────────────────────────────────

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(220, g => k.clawd(g, 'idle'));

// Both portals shoot open: blue under his feet, orange right above.
sc.frame(90, g => { portal(g, CEIL_CY, ORNG, { size: 0.45, near: -1 }); portal(g, FLOOR_CY, BLUE, { size: 0.45 });
  sparks(g, CEIL_CY, ORNG, 0, 0.7); sparks(g, FLOOR_CY, BLUE, 0, 0.7); k.clawd(g, 'idle', { eyes: 'wide' }); });
sc.frame(110, g => { portal(g, CEIL_CY, ORNG, { near: -1 }); portal(g, FLOOR_CY, BLUE);
  sparks(g, CEIL_CY, ORNG, 1); sparks(g, FLOOR_CY, BLUE, 1); k.clawd(g, 'idle', { eyes: 'wide' }); });

// The cartoon hover: standing on nothing, he looks up at the orange one…
sc.frame(380, g => { portal(g, CEIL_CY, ORNG, { near: -1 }); portal(g, FLOOR_CY, BLUE); k.clawd(g, 'idle', { eyes: 'up' }); });
// …and realises. "!"
sc.frame(420, g => { portal(g, CEIL_CY, ORNG, { near: -1 }); portal(g, FLOOR_CY, BLUE); k.clawd(g, 'idle', { eyes: 'wide' }); k.exclaim(g, 26, 12, C.ivory); });

// The drop: gravity takes over, each pass faster.
const ACCEL = [  // [feet row, pose, eyes, ms, streaks, streak length]
  [38, 'idle', 'wide', 120, 0, 0],
  [41, 'jump_fall', 'wide', 110, 0, 0],
  [45, 'jump_fall', 'wide', 100, 0, 0],
  [50, 'jump_fall', 'wide', 90, 2, 3],
  [56, 'jump_fall', 'wide', 80, 3, 4],
  [63, 'arms_up', 'wide', 70, 5, 5],
  [71, 'arms_up_2', 'wide', 70, 5, 7],
];
for (const [feet, pose, eyes, ms, lines, len] of ACCEL)
  sc.frame(ms, g => fallFrame(g, pose, feet, { eyes, lines, len }));

// Loop: top speed, two laps of four frames, seamless through the portals.
sc.loopStart();
const V0 = 79, LAPS = 2, PER = 4;
for (let i = 0; i < LAPS * PER; i++) {
  const feet = V0 + Math.round(i * D / PER);
  sc.frame(60, g => fallFrame(g, i % 2 ? 'arms_up_2' : 'arms_up', feet, { eyes: i === 6 ? 'happy' : 'wide', lines: 5, len: 9 }));
}
sc.loopEnd();

// Out: the floor portal snaps shut under him; he shoots out of the ceiling
// one last time and the orange one fizzles out behind him.
sc.frame(70, g => {
  portal(g, CEIL_CY, ORNG, { near: -1 }); slit(g, FLOOR_CY, BLUE, 5); sparks(g, FLOOR_CY, BLUE, 1);
  faller(g, 'arms_up', 16, { eyes: 'wide', out: true });
});
sc.frame(70, g => {
  slit(g, CEIL_CY, ORNG, 4); sparks(g, CEIL_CY, ORNG, 0, 0.8);
  faller(g, 'arms_up_2', 27, { eyes: 'wide', lines: 5, len: 6, out: true, ceiling: false });
});
// SPLAT.
sc.frame(170, g => { sparks(g, CEIL_CY, ORNG, 1, 1); k.clawd(g, 'jump_land'); k.dust(g, 26, 36, 0); });
sc.frame(140, g => { k.clawd(g, 'squash', { eyes: 'closed' }); k.dust(g, 26, 36, 1); });
sc.frame(160, g => { k.clawd(g, 'jump_recover', { eyes: 'closed' }); k.dust(g, 26, 36, 2); });
// Dizzy.
for (let i = 0; i < 4; i++) sc.frame(140, g => {
  const P = k.clawd(g, 'idle', { eyes: i === 3 ? 'closed' : 'wide' });
  dizzy(g, P, i);
});
sc.hold(140);
sc.frame(240, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(500, g => k.clawd(g, 'idle'));

sc.finish();
