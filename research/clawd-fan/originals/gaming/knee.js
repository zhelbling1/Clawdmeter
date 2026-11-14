#!/usr/bin/env node
/**
 * "Arrow to the knee": made for this fork, AI-drawn with the originals kit.
 * References the open-world fantasy RPG town guard who used to be an
 * adventurer, until he took an arrow in the knee. Generic guard costume
 * (round helmet with mail hood, mail shirt, tabard); slapstick, no blood,
 * no game sprites, no long quote.
 *
 * Story: idle → poof (guard kit) → on duty, proud → he hears something, an
 * arrow whistles in from the left → THUNK, right in the knee → he hops and
 * winces → loop: hobbling, "MY KNEE!" → a resigned sigh → poof → idle.
 *
 * Usage: node gaming/knee.js [--fast] [--no-preview]
 */
const k = require('../kit');
const { C, rect, put, line, caption } = k;
const { eyesSquint } = require('./props');

const sc = k.scene({
  dir: __dirname, file: 'Clawd-ArrowKnee.gif', name: 'arrow to the knee', mood: 'heavy', headroom: 0,
  credit: 'Made for this fork; AI-drawn with the originals kit (research/clawd-fan/originals/kit).',
  references: 'The Elder Scrolls V: Skyrim (2011): the town guard who "took an arrow in the knee". Generic guard costume, no game sprites.',
});

// ── Costume ──────────────────────────────────────────────────────────────────

// Mail shirt (sleeves and all), a maroon tabard with gold trim hanging to
// the knees, a brown belt, and the kit's guard helmet.
function guardKit({ squint = false } = {}) {
  return (g, P) => {
    k.jacket(g, P, { c: C.gray, dark: C.slate });
    const [x0, x1] = k.headSpan(P), m = k.midCol(P);
    // Mail texture.
    k.recolour(g, P, (x, y) => y <= P.waist && (y >= P.chin || x < x0 || x > x1) && (x + y) % 2 === 0, C.slate, C.slate);
    for (let y = P.chin; y <= P.waist + 1; y++) for (let x = m - 4; x <= m + 5; x++) {
      if (y > P.waist && !P.at(x, y)) continue;
      put(g, x, y, x === m - 4 || x === m + 5 ? C.gold : C.maroon);
    }
    rect(g, m - 1, P.chin + 2, m + 2, P.chin + 2, C.gold);                  // emblem bar
    rect(g, m, P.chin + 1, m + 1, P.chin + 3, C.gold);
    k.recolour(g, P, (x, y) => y === P.waist - 1 && x >= x0 && x <= x1, C.brown, C.brown);   // belt
    if (squint) eyesSquint(g, P);
    k.guardHelmet(g, P);
  };
}

// ── The arrow ────────────────────────────────────────────────────────────────

// Arrow flying right with its tip at (x, y); stuck = the head is buried.
function arrow(g, x, y, { stuck = false } = {}) {
  const tail = x - 9;
  line(g, tail + 2, y, x - (stuck ? 1 : 2), y, C.brown);
  if (!stuck) { rect(g, x - 1, y - 1, x - 1, y + 1, C.steel); put(g, x, y, C.steel); }
  put(g, tail, y - 1, C.ivory); put(g, tail + 1, y - 1, C.red);          // fletching
  put(g, tail, y + 1, C.ivory); put(g, tail + 1, y + 1, C.red);
  put(g, tail + 1, y, C.brown);
}
// The arrow stuck in his screen-left knee, wherever the pose puts it.
function inKnee(g, P) {
  const y = P.legTop + (P.feet - P.legTop >= 3 ? 1 : 0);
  arrow(g, P.feetX[0], y, { stuck: true });
}

// ── Storyboard ───────────────────────────────────────────────────────────────

const him = (g, pose, opts = {}) => k.clawd(g, pose, { ...opts, over: guardKit({ squint: opts.squint }) });
const P0 = k.place('idle');
const puff = (g, ph) => k.poof(g, P0.centre.x, P0.centre.y - 3, ph);
const ow = (g, c = C.ivory) => caption(g, 'MY KNEE!', 26, 12, c, { align: 'center' });

// Idle bookend.
sc.frame(500, g => k.clawd(g, 'idle'));
sc.frame(120, g => k.clawd(g, 'idle', { eyes: 'closed' }));
sc.frame(250, g => k.clawd(g, 'idle'));

// Poof on: on duty.
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 0); });
sc.frame(110, g => { him(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { him(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { him(g, 'idle'); puff(g, 3); });
sc.frame(450, g => him(g, 'idle', { eyes: 'closed' }));
sc.frame(300, g => him(g, 'idle', { eyes: 'left' }));

// Incoming…
sc.frame(90, g => { him(g, 'idle', { eyes: 'left' }); arrow(g, 9, 34); });
sc.frame(80, g => { him(g, 'idle', { eyes: 'wide' }); arrow(g, 16, 34); line(g, 3, 33, 5, 33, C.gray); line(g, 2, 35, 5, 35, C.gray); });
// THUNK.
sc.frame(140, g => { const P = him(g, 'stretch', { eyes: 'wide' }); inKnee(g, P);
  k.sparkle(g, P.feetX[0], P.legTop + 1, 3, C.ivory, C.ivory); caption(g, '!', 27, 6, C.red); });
sc.frame(160, g => { const P = him(g, 'squash', { squint: true }); inKnee(g, P); });
// Hop, hop.
sc.frame(200, g => { const P = him(g, 'jump_up', { squint: true, dx: 1, dy: 2 }); inKnee(g, P); put(g, 37, 18, C.sky); put(g, 38, 19, C.sky); });
sc.frame(160, g => { const P = him(g, 'crouch', { squint: true }); inKnee(g, P); });

// Loop: hobbling about. MY KNEE!
sc.loopStart();
const hob = [['idle', 0, 0, 'squint'], ['crouch', -1, 0, 'closed'], ['idle', -2, 0, 'squint'], ['crouch', -1, 0, 'closed']];
hob.forEach(([pose, dx, dy, eyes], i) => sc.frame(i % 2 ? 180 : 260, g => {
  const P = him(g, pose, { dx, squint: eyes === 'squint', eyes: eyes === 'closed' ? 'closed' : null });
  inKnee(g, P);
  ow(g, i === 2 ? C.gray : C.ivory);
  if (i % 2) { put(g, 37 + dx, P.eyeY - 2, C.sky); put(g, 37 + dx, P.eyeY - 1, C.sky); }    // sweat drop
}));
sc.loopEnd();

// He looks down at it. Sighs. That's his adventuring days over.
sc.frame(350, g => { const P = him(g, 'idle', { eyes: 'left' }); inKnee(g, P); });
sc.frame(500, g => { const P = him(g, 'crouch', { eyes: 'closed' }); inKnee(g, P); });
sc.frame(300, g => { const P = him(g, 'idle', { eyes: 'closed' }); inKnee(g, P); });

// Poof off (the arrow too).
sc.frame(90, g => { const P = him(g, 'idle'); inKnee(g, P); puff(g, 0); });
sc.frame(110, g => { k.clawd(g, 'idle'); puff(g, 1); });
sc.frame(100, g => { k.clawd(g, 'idle'); puff(g, 2); });
sc.frame(90, g => { k.clawd(g, 'idle'); puff(g, 3); });
sc.frame(400, g => k.clawd(g, 'idle'));

sc.finish();
