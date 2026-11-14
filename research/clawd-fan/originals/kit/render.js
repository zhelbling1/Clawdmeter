/**
 * Raster helpers for previews: canvases -> RGB pixel buffers -> PNG contact
 * sheets (the converter's dependency-free PNG writer) with pixel-font labels.
 */
const path = require('path');
const { GLYPHS, STAGE_H, W } = require('./canvas');
const conv = require(path.join(__dirname, '..', '..', '..', '..', 'tools', 'convert_official_clawd.js'));

class Raster {
  constructor(w, h, bg = [0, 0, 0]) {
    this.w = w; this.h = h; this.data = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) { this.data[i * 3] = bg[0]; this.data[i * 3 + 1] = bg[1]; this.data[i * 3 + 2] = bg[2]; }
  }
  px(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 3; this.data[o] = c[0]; this.data[o + 1] = c[1]; this.data[o + 2] = c[2];
  }
  fill(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.px(x, y, c); }
  text(s, x, y, c, scale = 2) {
    for (const ch of String(s).toUpperCase()) {
      const gl = GLYPHS[ch] || GLYPHS['?'];
      gl.forEach((row, r) => [...row].forEach((v, i) => { if (v === '#') this.fill(x + i * scale, y + r * scale, scale, scale, c); }));
      x += (gl[0].length + 1) * scale;
    }
  }
  png() { return conv.encodePng(this.w, this.h, this.data); }
}

/**
 * sheet(items, opts) -> Raster
 * items: [{ cell: (x, y) => [r,g,b] | null, rows, top, label?, sub?, marks? }]
 *   cell(x, y) for x 0..54, y top..36 (stage coords); marks: [{x, y, c}]
 * opts: scale (px per cell, default 4), per (columns), bg, stageBg,
 *       headBg (headroom tint), grid (faint 5-cell grid)
 */
function sheet(items, { scale = 4, per = 6, bg = [44, 44, 52], stageBg = [10, 10, 14],
  headBg = [26, 18, 34], grid = true, labelH = 22 } = {}) {
  const top = Math.min(...items.map(i => i.top || 0));
  const rows = STAGE_H - top;
  const cw = W * scale + 8, ch = rows * scale + 8 + labelH;
  const ncol = Math.min(per, items.length), nrow = Math.ceil(items.length / per);
  const R = new Raster(ncol * cw, nrow * ch, bg);
  items.forEach((it, i) => {
    const ox = (i % per) * cw + 4, oy = Math.floor(i / per) * ch + 4;
    for (let y = top; y < STAGE_H; y++)
      for (let x = 0; x < W; x++) {
        let c = it.cell(x, y);
        if (!c) {
          c = y < 0 ? headBg : stageBg;
          if (grid && (x % 5 === 0 || y % 5 === 0)) c = c.map(v => v + 12);
        }
        R.fill(ox + x * scale, oy + (y - top) * scale, scale, scale, c);
      }
    for (const m of it.marks || []) R.fill(ox + Math.round(m.x * scale) + 1, oy + (m.y - top) * scale + 1, scale - 2, scale - 2, m.c);
    if (it.label) R.text(it.label, ox, oy + rows * scale + 4, [235, 235, 235]);
    if (it.sub) R.text(it.sub, ox + W * scale - (String(it.sub).length * 8), oy + rows * scale + 4, [150, 200, 255]);
  });
  return R;
}

module.exports = { Raster, sheet, conv };
