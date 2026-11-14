/**
 * Costume layers. Every function takes (g, P, opts) where P is a placed pose
 * (kit/poses.js place() / clawd()) and draws relative to P's anchors, so the
 * same costume follows any pose, shift or flip. Draw them AFTER Clawd,
 * except cape() and longHair()'s back strands (pass them as `under`).
 *
 * All details are ≥ 1 cell, colours default to the kit palette (C) and can
 * be overridden with { c, dark, … }. Caricature only: a fedora, not a face.
 *
 * Hair:     slick, platinum, quiff, wild, longHair
 * Hats:     fedora, bucketHat, knightHelmet, guardHelmet, partyHat,
 *           bandana, pointyCap, safariHat
 * Eyewear:  shades, aviators, roundGlasses
 * Clothes:  tie, jacket (+ presets longCoat, leatherJacket, redJacket,
 *           trench, suit), jumpsuit, cape
 * Masks:    villainHelmet
 * Hands:    glove
 */
const { C, rect, line, stamp, disc, tri } = require('./canvas');

// ── Helpers ──────────────────────────────────────────────────────────────────

// The head's 16-cell span (x0..x1) centred on the face, robust to raised arms.
function headSpan(P) {
  const h = P.head;
  if (h.x1 - h.x0 === 15) return [h.x0, h.x1];
  const x0 = Math.round(h.cx - 7.5);
  return [x0, x0 + 15];
}
// The side his back is on: -1 = left (facing right or front), +1 = right.
const backDir = (P) => (P.facing === 'left' ? 1 : -1);
// The tie column pair under the face centre.
const midCol = (P) => Math.floor(P.head.cx - 0.5);

// Recolour Clawd's own cells (body/shade, optionally eyes) that pass `pred`.
// Shade cells take `dark` so 3/4 views keep their shading.
function recolour(g, P, pred, c, dark = c, { eyes = false } = {}) {
  for (const [x, y, t] of P.cells) {
    if (t === 'e' && !eyes) continue;
    if (pred(x, y, t)) g.put(x, y, t === 's' ? dark : c);
  }
}
// Paint only where Clawd is (keeps a detail inside his silhouette).
function onBody(g, P, x, y, c) { if (P.at(x, y)) g.put(x, y, c); }

// ── Hair ─────────────────────────────────────────────────────────────────────

// Slicked-back: a glossy helmet of hair combed straight back, sheen lines
// along the comb, sideburns, and a tail at the nape on his back side.
function slick(g, P, { c = C.charcoal, sheen = C.slate } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top, b = backDir(P);
  rect(g, x0 + 2, t - 2, x1 - 2, t - 2, c);
  rect(g, x0 + 1, t - 1, x1 - 1, t - 1, c);
  rect(g, x0, t, x1, t, c);
  rect(g, x0, t + 1, x0 + 1, t + 1, c); rect(g, x1 - 1, t + 1, x1, t + 1, c);
  rect(g, x0, t + 2, x0, P.eyeBottom, c); rect(g, x1, t + 2, x1, P.eyeBottom, c);   // sideburns
  // Combed back: the hair sweeps a cell past the back of the head.
  const bx = b < 0 ? x0 - 1 : x1 + 1;
  rect(g, bx, t - 1, bx, t + 2, c);
  // Sheen: comb lines running back from the front.
  const fx = b < 0 ? x1 : x0, fd = -b;            // front edge, direction toward the front
  for (const [y, from, len] of [[t - 2, 4, 5], [t - 1, 2, 4], [t - 1, 8, 4], [t, 5, 3]]) {
    for (let i = 0; i < len; i++) g.put(fx - fd * (from + i), y, sheen);
  }
}

// Platinum crop: short bleached spikes.
function platinum(g, P, { c = C.cream, dark = C.tan } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top;
  rect(g, x0, t, x1, t, c);
  rect(g, x0, t - 1, x1, t - 1, c);
  for (let x = x0 + 1; x <= x1 - 1; x += 3) rect(g, x, t - 2, x + 1, t - 2, c);
  for (let x = x0 + 2; x <= x1 - 2; x += 3) g.put(x, t, dark);    // roots
  rect(g, x0, t + 1, x0, t + 1, c); rect(g, x1, t + 1, x1, t + 1, c);
}

// Quiff: a tall curl rolling forward over the face side.
function quiff(g, P, { c = C.ginger, dark = C.maroon } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top;
  const f = P.facing === 'left' ? -1 : 1;            // front direction (front view: to the right)
  const rows = [
    '.....##########.....',
    '...##############...',
    '..#####dd#########..',
    '.##################.',
    '..################..',
    '..################..',
  ];
  stamp(g, x0 - 2, t - 5, rows, { '#': c, d: dark }, { flip: f < 0 });
  // The curl overhangs the front.
  const fx = f > 0 ? x1 + 1 : x0 - 1;
  rect(g, fx, t - 3, fx + f, t - 2, c);
  g.put(fx + f, t - 1, dark);
  rect(g, x0, t + 1, x0, t + 1, c); rect(g, x1, t + 1, x1, t + 1, c);
}

// Wild, messy hair: spikes in every direction.
function wild(g, P, { c = C.brown, dark = C.charcoal } = {}) {
  const [x0, , ] = headSpan(P), t = P.head.top;
  const rows = [
    '..#.....#....#.....#..',
    '.##..#..##..##..#..##.',
    '..###.###########.###.',
    '#.#################..#',
    '.##################d#.',
    '##..##############..##',
    '#..##..........##...#.',
  ];
  stamp(g, x0 - 3, t - 5, rows, { '#': c, d: dark });
}

// Long hair blowing in the wind. wind 0 (hanging) .. 4 (streaming toward
// the back side); phase 0..3 ripples the ends.
function longHair(g, P, { c = C.gold, dark = C.amber, wind = 0, phase = 0 } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top, b = backDir(P);
  rect(g, x0 + 1, t - 1, x1 - 1, t - 1, c);
  rect(g, x0, t, x1, t, c);
  rect(g, x0, t + 1, x0 + 2, t + 1, c); rect(g, x1 - 2, t + 1, x1, t + 1, c);
  const len = P.chin + 4 - t;
  for (const side of [-1, 1]) {
    const base = side < 0 ? x0 - 1 : x1 + 1;
    const blow = side === b ? 1 : 0.5;
    for (let i = 0; i < len; i++) {
      const y = t + i;
      const drift = Math.round(wind * blow * b * (i / len) * 2 + (i > len / 2 ? [0, 1, 0, -1][(phase + i) % 4] * (wind ? 1 : 0) : 0));
      rect(g, base + drift - (side < 0 ? 1 : 0), y, base + drift + (side > 0 ? 1 : 0), y, i % 4 === 3 ? dark : c);
    }
  }
}

// ── Hats ─────────────────────────────────────────────────────────────────────

// Fedora: pinched crown, band, wide brim. lift raises it off the head (to
// tip it), tilt -1/0/1 slopes the brim, dx shifts it sideways.
function fedora(g, P, { c = C.charcoal, band = C.slate, lift = 0, tilt = 0, dx = 0 } = {}) {
  let [x0, x1] = headSpan(P); x0 += dx; x1 += dx;
  const y = P.head.top - 1 - lift, cx = Math.floor((x0 + x1) / 2);
  const mid = (x0 + x1) / 2;   // tilt drops one brim end and raises the other
  const sl = (x) => (tilt && Math.abs(x - mid) > 7.5 ? Math.sign(x - mid) * -tilt : 0);
  for (let x = x0 - 2; x <= x1 + 2; x++) g.put(x, y + sl(x), c);              // brim
  rect(g, x0 + 3, y - 1, x1 - 3, y - 1, band);                        // band
  rect(g, x0 + 3, y - 3, x1 - 3, y - 2, c);                           // crown
  rect(g, x0 + 4, y - 4, cx - 1, y - 4, c);                           // pinched top
  rect(g, cx + 2, y - 4, x1 - 4, y - 4, c);
}

// Bucket hat: soft dome, brim sloping down over the forehead.
function bucketHat(g, P, { c = C.olive, dark = C.brown } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top;
  rect(g, x0 + 2, t - 4, x1 - 2, t - 4, c);
  rect(g, x0 + 1, t - 3, x1 - 1, t - 1, c);
  rect(g, x0 + 1, t - 1, x1 - 1, t - 1, dark);                       // stitch line
  rect(g, x0 - 1, t, x1 + 1, t, c);
  rect(g, x0 - 2, t + 1, x0, t + 1, c); rect(g, x1, t + 1, x1 + 2, t + 1, c);
}

// Knight helmet: covers the head, the eyes look out through a visor slit.
function knightHelmet(g, P, { c = C.steel, dark = C.slate, plume = C.red } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top;
  rect(g, x0 + 1, t - 3, x1 - 1, t - 3, c);
  rect(g, x0 - 1, t - 2, x1 + 1, P.eyeBottom + 1, c);
  // Visor slit: the face shows through on the eye rows.
  for (let y = P.eyeY; y <= P.eyeBottom; y++)
    for (let x = x0 + 1; x <= x1 - 1; x++) { const k = P.at(x, y); if (k) g.put(x, y, k === 'e' ? C.eye : C.body); }
  rect(g, x0 - 1, P.eyeY - 1, x1 + 1, P.eyeY - 1, dark);              // visor ridge
  rect(g, Math.floor(P.head.cx), t - 2, Math.floor(P.head.cx) + 1, P.eyeY - 2, dark);   // crest
  for (let x = x0 + 2; x <= x1 - 2; x += 3) g.put(x, P.eyeBottom + 1, dark);              // breaths
  if (plume) {
    const px = Math.floor(P.head.cx);
    rect(g, px, t - 6, px + 1, t - 4, plume);
    rect(g, px + 2 * backDir(P), t - 7, px + 1 + 2 * backDir(P), t - 5, plume);
  }
}

// Guard helmet: round steel cap, nose guard, mail hood down the sides.
function guardHelmet(g, P, { c = C.steel, mail = C.gray, dark = C.slate } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top;
  rect(g, x0 + 2, t - 3, x1 - 2, t - 3, c);
  rect(g, x0, t - 2, x1, t, c);
  rect(g, x0 - 1, t, x1 + 1, t, dark);                                 // rim
  const cx = Math.floor(P.head.cx);
  rect(g, cx, t + 1, cx + 1, P.eyeBottom, c);                          // nose guard
  for (const s of [-1, 1]) {
    const x = s < 0 ? x0 - 1 : x1 - 1;
    for (let y = t + 1; y <= P.chin + 1; y++) rect(g, x, y, x + 2, y, (x + y) % 2 ? mail : dark);
  }
}

// Party hat: striped cone with a pom-pom. tilt shifts the tip sideways.
function partyHat(g, P, { c = C.pink, stripe = C.sky, pom = C.gold, tilt = 0 } = {}) {
  const cx = Math.floor(P.head.cx), t = P.head.top;
  const H = 8;
  for (let i = 0; i < H; i++) {
    const y = t - 1 - i, half = Math.floor((H - 1 - i) / 2);
    const o = Math.round(tilt * i / H * 2);
    for (let x = cx - half; x <= cx + 1 + half; x++) g.put(x + o, y, (i + x) % 4 < 2 ? c : stripe);
  }
  const o = Math.round(tilt * 2);
  rect(g, cx + o, t - H - 2, cx + 1 + o, t - H - 1, pom);
}

// Bandana: headband across the forehead, knot and tails flying behind.
// phase 0..3 flaps the tails.
function bandana(g, P, { c = C.navy, knot = C.blue, phase = 0, wind = 1 } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top, b = backDir(P);
  rect(g, x0, t, x1, t + 1, c);
  const kx = b < 0 ? x0 - 1 : x1 + 1;
  rect(g, kx, t, kx, t + 1, knot);
  const wav = [0, 1, 1, 0][phase % 4], wav2 = [1, 0, 1, 1][phase % 4];
  for (let i = 1; i <= 5; i++) {
    g.put(kx + b * i, t + 1 + Math.floor(i / 2) - (wind ? Math.round(i / 3) : 0) + (i > 2 ? wav : 0), c);
    g.put(kx + b * i, t + 2 + Math.floor(i / 2) + (i > 3 ? wav2 : 0), c);
  }
}

// Pointy cap (wizard / gnome): tall cone bending back, with a brim.
function pointyCap(g, P, { c = C.purple, band = C.gold, star = C.glow, bend = 1 } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top, b = backDir(P);
  rect(g, x0 - 1, t - 1, x1 + 1, t - 1, c);                            // brim
  const H = 9, cx = (x0 + x1) / 2;
  for (let i = 0; i < H; i++) {
    const y = t - 2 - i, half = Math.max(0, Math.round(6 - i * 6.5 / H));
    const o = i > H / 2 ? Math.round(b * bend * (i - H / 2) * 0.7) : 0;
    rect(g, Math.round(cx - half) + o, y, Math.round(cx + half) + o, y, c);
  }
  rect(g, x0 + 1, t - 2, x1 - 1, t - 2, band);
  if (star) { g.put(Math.round(cx) - 2, t - 5, star); g.put(Math.round(cx) + 2, t - 7, star); }
}

// Safari (pith) helmet: dome, band, wide brim.
function safariHat(g, P, { c = C.tan, band = C.brown } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top;
  rect(g, x0 + 3, t - 5, x1 - 3, t - 5, c);
  rect(g, x0 + 1, t - 4, x1 - 1, t - 3, c);
  rect(g, x0 + 1, t - 2, x1 - 1, t - 2, band);
  rect(g, x0 - 2, t - 1, x1 + 2, t - 1, c);
  g.put(x0 - 3, t, c); g.put(x1 + 3, t, c);
}

// ── Eyewear ──────────────────────────────────────────────────────────────────

// Shades: solid lenses over both eyes, a bridge, a glint.
function shades(g, P, { c = C.charcoal, glint = C.slate } = {}) {
  const [eL, eR] = P.eyes, y = P.eyeY;
  for (const e of [eL, eR]) {
    rect(g, e.x - 1, y, e.x + Math.max(e.w, 2), y + 1, c);
    g.put(e.x - 1, y, glint);
  }
  rect(g, eL.x + Math.max(eL.w, 2) + 1, y, eR.x - 2, y, c);
}

// Aviators: gold frames, dark teardrop lenses.
function aviators(g, P, { frame = C.gold, lens = C.charcoal } = {}) {
  const [eL, eR] = P.eyes, y = P.eyeY;
  for (const e of [eL, eR]) {
    rect(g, e.x - 1, y - 1, e.x + 2, y - 1, frame);
    rect(g, e.x - 1, y, e.x + 2, y + 1, lens);
    rect(g, e.x, y + 2, e.x + 1, y + 2, lens);
  }
  rect(g, eL.x + 3, y - 1, eR.x - 2, y - 1, frame);
}

// Round glasses: rings around the eyes (eyes stay visible inside).
function roundGlasses(g, P, { c = C.charcoal } = {}) {
  const [eL, eR] = P.eyes, y = P.eyeY;
  for (const e of [eL, eR]) {
    rect(g, e.x, y - 1, e.x + 1, y - 1, c); rect(g, e.x, y + 2, e.x + 1, y + 2, c);
    rect(g, e.x - 1, y, e.x - 1, y + 1, c); rect(g, e.x + 2, y, e.x + 2, y + 1, c);
  }
  rect(g, eL.x + 3, y, eR.x - 2, y, c);
}

// ── Clothes ──────────────────────────────────────────────────────────────────

// Skinny tie from the chin to the waist, with an optional shirt collar.
function tie(g, P, { c = C.charcoal, knot = null, collar = C.ivory, width = 2 } = {}) {
  const x = midCol(P) + (width === 1 ? 1 : 0), y0 = P.chin, y1 = P.waist;
  for (let y = y0; y <= y1; y++) for (let i = 0; i < width; i++) onBody(g, P, x + i, y, c);
  if (knot) for (let i = 0; i < width; i++) onBody(g, P, x + i, y0, knot);
  if (collar) {
    onBody(g, P, x - 2, y0, collar); onBody(g, P, x - 1, y0, collar); onBody(g, P, x - 1, y0 + 1, collar);
    onBody(g, P, x + width, y0, collar); onBody(g, P, x + width + 1, y0, collar); onBody(g, P, x + width, y0 + 1, collar);
  }
}

/**
 * jacket(g, P, opts): recolours his torso (and arms, unless sleeves: false)
 * from the chin to the waist, then adds front details.
 *   c, dark      cloth colour, and the colour for his shaded side
 *   shirt        colour of a V of shirt at the neck (null = closed)
 *   lapel        colour of lapel lines beside the V
 *   zip          colour of a centre zip line
 *   belt         colour of a belt on the waist row
 *   long         rows of coat skirt below the waist (over the tops of his legs)
 *   sleeves      false leaves the arms orange (a vest)
 *   stripes      [colour] two V stripes across the chest (the red-jacket look)
 */
function jacket(g, P, { c = C.charcoal, dark = null, shirt = null, lapel = null, zip = null, belt = null,
  long = 0, sleeves = true, stripes = null, buttons = null } = {}) {
  dark = dark || c;
  const [x0, x1] = headSpan(P);
  const arm = (x, y) => x < x0 || x > x1 || y < P.head.top;
  recolour(g, P, (x, y) => y <= P.waist && (y >= P.chin ? (sleeves || !arm(x, y)) : sleeves && arm(x, y)), c, dark);
  const m = midCol(P);
  if (long) {
    for (let i = 1; i <= long; i++) {
      const y = P.waist + i, fl = i >= long - 0 ? 1 : 0;
      rect(g, x0 - fl, y, x1 + fl, y, c);
      if (P.facing !== 'front') {                                      // the shaded back edge
        const bx = backDir(P) < 0 ? x0 - fl : x1 + fl;
        rect(g, bx, y, bx + (backDir(P) < 0 ? 1 : -1), y, dark);
      }
    }
    for (let y = P.waist + 1; y <= P.waist + long; y++) g.put(m + (P.facing === 'left' ? 0 : 1), y, dark);  // coat split
  }
  if (shirt) {
    for (let x = m - 1; x <= m + 2; x++) onBody(g, P, x, P.chin, shirt);
    onBody(g, P, m, P.chin + 1, shirt); onBody(g, P, m + 1, P.chin + 1, shirt);
    if (lapel) {
      onBody(g, P, m - 2, P.chin, lapel); onBody(g, P, m - 1, P.chin + 1, lapel); onBody(g, P, m - 1, P.chin + 2, lapel);
      onBody(g, P, m + 3, P.chin, lapel); onBody(g, P, m + 2, P.chin + 1, lapel); onBody(g, P, m + 2, P.chin + 2, lapel);
    }
  }
  if (stripes) {
    for (let i = 0; i < 4; i++) {
      onBody(g, P, m - 4 + i, P.chin + 1 + i, stripes); onBody(g, P, m + 5 - i, P.chin + 1 + i, stripes);
      onBody(g, P, m - 6 + i, P.chin + 1 + i, stripes); onBody(g, P, m + 7 - i, P.chin + 1 + i, stripes);
    }
  }
  if (zip) for (let y = P.chin + (shirt ? 2 : 0); y <= P.waist + long; y++) g.put(m + 1, y, zip);
  if (buttons) for (let y = P.chin + 3; y <= P.waist; y += 2) onBody(g, P, m + 1, y, buttons);
  if (belt) {
    const y = P.waist;
    recolour(g, P, (x, yy) => yy === y && x >= x0 && x <= x1, belt, belt);
    onBody(g, P, m, y, C.gold); onBody(g, P, m + 1, y, C.gold);
  }
}
const longCoat = (g, P, o = {}) => jacket(g, P, { c: C.charcoal, dark: C.charcoal, lapel: C.slate, shirt: C.charcoal, long: 3, ...o });
const leatherJacket = (g, P, o = {}) => jacket(g, P, { c: C.brown, dark: C.charcoal, zip: C.slate, shirt: C.ivory, lapel: C.charcoal, ...o });
const redJacket = (g, P, o = {}) => jacket(g, P, { c: C.red, dark: C.maroon, stripes: C.charcoal, zip: C.charcoal, ...o });
const trench = (g, P, o = {}) => jacket(g, P, { c: C.tan, dark: C.brown, belt: C.brown, shirt: C.ivory, lapel: C.brown, long: 3, ...o });
const suit = (g, P, o = {}) => jacket(g, P, { c: C.charcoal, dark: C.charcoal, shirt: C.ivory, lapel: C.slate, ...o });

// Jumpsuit: everything from the chin down, legs too. boots colours the feet row.
function jumpsuit(g, P, { c = C.ivory, dark = C.gray, boots = C.charcoal, zip = null, badge = null } = {}) {
  recolour(g, P, (x, y) => y >= P.chin, c, dark);
  if (boots) recolour(g, P, (x, y) => y === P.feet, boots, boots);
  const m = midCol(P);
  if (zip) for (let y = P.chin; y <= P.waist; y++) onBody(g, P, m + 1, y, zip);
  if (badge) { onBody(g, P, m - 4, P.chin + 1, badge); onBody(g, P, m - 3, P.chin + 1, badge); }
}

// Cape: hangs from the shoulders behind him (draw it UNDER the pose). wind
// 0..3 swings the hem toward his back; phase 0..3 ripples it.
function cape(g, P, { c = C.red, lining = C.maroon, wind = 0, phase = 0 } = {}) {
  const [x0, x1] = headSpan(P), b = backDir(P);
  const y0 = P.chin, y1 = Math.min(P.feet - 1, P.waist + 3);
  for (let y = y0; y <= y1; y++) {
    const k = (y - y0) / Math.max(1, y1 - y0);
    const sway = Math.round(wind * k * 2) * b;
    const spread = Math.round(1 + k * 2);
    const rip = y === y1 ? [0, 1, 0, -1][(phase) % 4] : 0;
    rect(g, x0 - spread + sway, y, x1 + spread + sway, y, y >= y1 - 1 ? lining : c);
    if (rip) g.put((rip > 0 ? x1 + spread : x0 - spread) + sway, y + 1, lining);
  }
}
// Draw the clasp over him after the pose: capeClasp(g, P).
function capeClasp(g, P, { clasp = C.gold } = {}) { onBody(g, P, midCol(P), P.chin, clasp); onBody(g, P, midCol(P) + 1, P.chin, clasp); }

// ── Masks ────────────────────────────────────────────────────────────────────

// Dark villain helmet: dome over the head, flared neck guard, angled lenses
// and a triangular grille. Arms, body and legs stay orange.
function villainHelmet(g, P, { c = C.charcoal, sheen = C.slate, lens = C.gray, grille = C.steel } = {}) {
  const [x0, x1] = headSpan(P), t = P.head.top, cx = Math.floor(P.head.cx);
  rect(g, x0 + 2, t - 3, x1 - 2, t - 3, c);
  rect(g, x0, t - 2, x1, P.eyeBottom, c);
  rect(g, x0 - 2, P.eyeBottom - 1, x0 - 1, P.eyeBottom + 1, c);        // flared neck guard
  rect(g, x1 + 1, P.eyeBottom - 1, x1 + 2, P.eyeBottom + 1, c);
  rect(g, x0 + 3, t - 2, x0 + 7, t - 2, sheen);                        // dome sheen
  rect(g, cx, t - 2, cx + 1, P.eyeY - 2, sheen);                       // centre ridge
  for (const e of P.eyes) {                                            // lenses
    rect(g, e.x - 1, P.eyeY, e.x + 2, P.eyeY, lens);
    rect(g, e.x + (e.x < cx ? 0 : -1), P.eyeY + 1, e.x + (e.x < cx ? 2 : 1), P.eyeY + 1, lens);
  }
  tri(g, [cx - 2, P.eyeBottom + 1], [cx + 3, P.eyeBottom + 1], [cx + 0.5, P.eyeBottom - 1], grille);
  rect(g, cx - 2, P.eyeBottom + 1, cx + 3, P.eyeBottom + 1, grille);
}

// ── Hands ────────────────────────────────────────────────────────────────────

// Glove on one hand ('R' or 'L', screen side). Returns the hand's tip cell
// (for sparkles). cuff colours the glove's inner column.
function glove(g, P, { side = 'R', c = C.ivory, cuff = C.gray } = {}) {
  const h = side === 'R' ? P.handR : P.handL;
  if (!h) return null;
  if (h.dir === 'up') {
    recolour(g, P, (x, y) => y >= h.y && y <= h.y + 2 && x >= h.x0 - 1 && x <= h.x1 + 1, c, cuff);
    if (cuff) recolour(g, P, (x, y) => y === h.y + 3 && x >= h.x0 && x <= h.x1, cuff, cuff);
    return { x: h.x, y: h.y };
  }
  const d = h.dir;
  recolour(g, P, (x, y) => y >= h.y0 - 1 && y <= h.y1 + 1 && (d < 0 ? x <= h.x + 2 : x >= h.x - 2), c, cuff);
  if (cuff) recolour(g, P, (x, y) => y >= h.y0 - 1 && y <= h.y1 + 1 && x === h.x - 3 * d, cuff, cuff);
  return { x: h.x, y: h.y };
}

module.exports = {
  recolour, onBody, headSpan, backDir, midCol,
  slick, platinum, quiff, wild, longHair,
  fedora, bucketHat, knightHelmet, guardHelmet, partyHat, bandana, pointyCap, safariHat,
  shades, aviators, roundGlasses,
  tie, jacket, longCoat, leatherJacket, redJacket, trench, suit, jumpsuit, cape, capeClasp,
  villainHelmet, glove,
};
