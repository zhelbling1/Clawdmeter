/**
 * Canvas, colours, drawing primitives and the pixel font.
 *
 * A Canvas is one frame: the official 55×37-cell stage plus up to 11
 * headroom rows above it. Coordinates are always STAGE coordinates: x 0..54,
 * y 0..36 is the stage, y -1..-headroom the headroom. Cells hold an
 * [r,g,b] colour (one of `C`, or your own) or null (transparent).
 *
 * Columns 0 and 54 are never drawn: the firmware snaps any clip touching
 * them to the screen edge (that's for Lurking's peek-in), which would shift
 * the whole scene. Props sliding "off stage" vanish at x 1 / 53.
 */

const W = 55, STAGE_H = 37, MAX_HEADROOM = 11;
const X_MIN = 1, X_MAX = W - 2;

// Official colours (as the core GIFs sample) first, then a prop palette.
// Every pair stays outside the converter's merge distance (dist² 600), and
// none sits near the body or shade, so the theme recolour only hits Clawd.
const C = {
  body:     [0xD9, 0x77, 0x57],   // Clawd (theme recolours this exact colour)
  shade:    [0xBF, 0x69, 0x4D],   // his side shading in 3/4 views
  eye:      [0x14, 0x14, 0x13],   // eye ink (the converter's EYE_INK)
  ivory:    [0xF9, 0xF8, 0xF4],   // official highlight white
  gray:     [0x8B, 0x8B, 0x8B],   // official steam / motion-line gray
  // Darks that still read on the device's black ground.
  charcoal: [0x3C, 0x3C, 0x48],   // "black" costume pieces (hair, tie, suit)
  slate:    [0x6E, 0x70, 0x80],   // sheen on charcoal
  steel:    [0xB4, 0xBA, 0xC6],   // armour, helmets
  // Warm props.
  gold:     [0xF5, 0xC5, 0x42],
  amber:    [0xC8, 0x8C, 0x28],
  glow:     [0xFF, 0xEC, 0x8C],   // light, sparkle cores
  brown:    [0x7A, 0x4E, 0x30],
  tan:      [0xD2, 0xAA, 0x6E],
  cream:    [0xF0, 0xE6, 0xBE],   // platinum hair
  ginger:   [0xE8, 0x5A, 0x1E],
  // Colours.
  red:      [0xD2, 0x32, 0x32],
  maroon:   [0x8C, 0x1E, 0x28],
  pink:     [0xF5, 0x96, 0xBE],
  purple:   [0x82, 0x4B, 0xAA],
  navy:     [0x2D, 0x3C, 0x82],
  blue:     [0x46, 0x82, 0xDC],
  sky:      [0x8C, 0xD2, 0xF5],
  green:    [0x46, 0xAA, 0x5A],
  olive:    [0x6E, 0x78, 0x32],
  lime:     [0xB4, 0xE6, 0x46],
};

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const key = (c) => (c[0] << 16) | (c[1] << 8) | c[2];
const hex = (c) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const rgb = (h) => [1, 3, 5].map(o => parseInt(h.replace(/^#?/, '#').slice(o, o + 2), 16));

class Canvas {
  constructor(headroom = 0) {
    if (headroom < 0 || headroom > MAX_HEADROOM) throw new Error(`headroom 0..${MAX_HEADROOM}`);
    this.headroom = headroom;
    this.top = -headroom;                    // smallest drawable y
    this.rows = STAGE_H + headroom;
    this.cells = Array.from({ length: this.rows }, () => new Array(W).fill(null));
    this.clippedTop = 0;                     // cells lost above the headroom
  }
  inside(x, y) { return x >= X_MIN && x <= X_MAX && y >= this.top && y < STAGE_H; }
  get(x, y) { return (x >= 0 && x < W && y >= this.top && y < STAGE_H) ? this.cells[y - this.top][x] : null; }
  put(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (y < this.top) { if (c && x >= X_MIN && x <= X_MAX) this.clippedTop++; return; }
    if (this.inside(x, y)) this.cells[y - this.top][x] = c;
  }
  // Paint only where something is already drawn (e.g. light on a surface).
  tint(x, y, c) { if (this.get(x, y)) this.put(x, y, c); }
}

// ── Primitives (all take the canvas first) ───────────────────────────────────

const put = (g, x, y, c) => g.put(x, y, c);
function rect(g, x0, y0, x1, y1, c) {
  if (x0 > x1) [x0, x1] = [x1, x0];
  if (y0 > y1) [y0, y1] = [y1, y0];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.put(x, y, c);
}
function outline(g, x0, y0, x1, y1, c) {       // 1-cell outline
  for (let x = x0; x <= x1; x++) { g.put(x, y0, c); g.put(x, y1, c); }
  for (let y = y0; y <= y1; y++) { g.put(x0, y, c); g.put(x1, y, c); }
}
function line(g, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    g.put(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
// Filled disc / ring, radius in cells (half-cells allowed: r 2.5).
function disc(g, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5) g.put(x, y, c);
}
function ring(g, cx, cy, r, c) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (Math.abs(d - r) < 0.55) g.put(x, y, c);
    }
}
// Filled triangle (cell centres inside the three points).
function tri(g, a, b, c3, c) {
  const xs = [a[0], b[0], c3[0]], ys = [a[1], b[1], c3[1]];
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const p = [x, y];
      const d1 = s(p, a, b), d2 = s(p, b, c3), d3 = s(p, c3, a);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) g.put(x, y, c);
    }
}
// ASCII sprite: '.' or ' ' is transparent, other characters index `map`.
// Rows may be flipped horizontally with { flip: true }.
function stamp(g, x, y, rows, map, { flip = false } = {}) {
  rows.forEach((row, r) => {
    const chars = [...row];
    chars.forEach((ch, i) => {
      if (ch === '.' || ch === ' ') return;
      const col = map[ch];
      if (col === undefined) throw new Error(`stamp: no colour for '${ch}'`);
      g.put(x + (flip ? chars.length - 1 - i : i), y + r, col);
    });
  });
}
// Copy another canvas on top (non-null cells), shifted by dx, dy.
function blit(g, src, dx = 0, dy = 0) {
  for (let y = src.top; y < STAGE_H; y++)
    for (let x = 0; x < W; x++) { const c = src.get(x, y); if (c) g.put(x + dx, y + dy, c); }
}

// ── Pixel font: 3×5 caps (M, N, W wider), digits, punctuation ───────────────

const GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
  '!': ['#', '#', '#', '.', '#'], '?': ['##.', '..#', '.#.', '...', '.#.'],
  '.': ['.', '.', '.', '.', '#'], ',': ['..', '..', '..', '.#', '#.'],
  "'": ['#', '#', '.', '.', '.'], '"': ['#.#', '#.#', '...', '...', '...'],
  '-': ['...', '...', '###', '...', '...'], '_': ['...', '...', '...', '...', '###'], ':': ['.', '#', '.', '#', '.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'], '+': ['...', '.#.', '###', '.#.', '...'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'], '(': ['.#', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '#.'], '<': ['..#', '.#.', '#..', '.#.', '..#'], '>': ['#..', '.#.', '..#', '.#.', '#..'], '#': ['#.#', '###', '#.#', '###', '#.#'],
  '*': ['.#.#.', '#####', '#####', '.###.', '..#..'],          // heart
  ' ': ['..', '..', '..', '..', '..'],
};

// Width in cells of `text` at `scale` (1 cell spacing between glyphs).
function textWidth(text, scale = 1) {
  const chars = [...String(text).toUpperCase()];
  let w = 0;
  chars.forEach((ch, i) => { w += (GLYPHS[ch] || GLYPHS['?'])[0].length + (i < chars.length - 1 ? 1 : 0); });
  return w * scale;
}

// Draw `text` with its top-left at (x, y). Options: align 'left' | 'center'
// (x is then the centre) | 'right'; scale (1 = 5 cells tall); shadow colour
// (drawn one cell down-right first, so text reads over busy props).
function caption(g, text, x, y, colour = C.ivory, { align = 'left', scale = 1, shadow = null } = {}) {
  const w = textWidth(text, scale);
  let cx = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w + 1 : x;
  const draw = (ox, oy, col) => {
    let px = cx + ox;
    for (const ch of String(text).toUpperCase()) {
      const gl = GLYPHS[ch] || GLYPHS['?'];
      gl.forEach((row, r) => [...row].forEach((v, c) => {
        if (v === '#') rect(g, px + c * scale, oy + y + r * scale, px + c * scale + scale - 1, oy + y + r * scale + scale - 1, col);
      }));
      px += (gl[0].length + 1) * scale;
    }
  };
  if (shadow) draw(1, 1, shadow);
  draw(0, 0, colour);
  return { x0: cx, x1: cx + w - 1, y0: y, y1: y + 5 * scale - 1 };
}

module.exports = {
  W, STAGE_H, MAX_HEADROOM, X_MIN, X_MAX, C, Canvas,
  dist2, key, hex, rgb,
  put, rect, outline, line, disc, ring, tri, stamp, blit,
  GLYPHS, textWidth, caption,
};
