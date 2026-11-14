#!/usr/bin/env node
/**
 * Self-test for the kit's GIF encoder: random and structured frames, global
 * and local palettes, opaque and transparent, round-tripped through
 * tools/gif_decode.js (the converter's ImageMagick-free decoder). Exits
 * non-zero on the first mismatch.  Usage: node kit/selftest.js
 */
const path = require('path');
const { encodeGif } = require('./gif_encode');
const { decodeGif } = require(path.join(__dirname, '..', '..', '..', '..', 'tools', 'gif_decode.js'));

let seed = 12345;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };

function check(name, opts) {
  const buf = encodeGif(opts);
  const dec = decodeGif(buf);
  if (dec.w !== opts.w || dec.h !== opts.h) throw new Error(`${name}: size ${dec.w}x${dec.h}`);
  if (dec.frames.length !== opts.frames.length) throw new Error(`${name}: ${dec.frames.length} frames`);
  opts.frames.forEach((f, fi) => {
    const pal = f.palette || opts.palette;
    const tr = f.transparent !== undefined ? f.transparent : opts.transparent;
    for (let i = 0; i < opts.w * opts.h; i++) {
      const v = f.pixels[i];
      const want = v === tr ? [255, 0, 255] : pal[v];
      const o = i * 3, d = dec.frames[fi].data;
      if (d[o] !== want[0] || d[o + 1] !== want[1] || d[o + 2] !== want[2])
        throw new Error(`${name}: frame ${fi} pixel ${i} is ${[d[o], d[o + 1], d[o + 2]]}, want ${want}`);
    }
    const cs = Math.round((f.delayMs ?? 80) / 10);
    if (dec.frames[fi].delayCs !== cs) throw new Error(`${name}: frame ${fi} delay ${dec.frames[fi].delayCs}`);
  });
  console.log(`ok  ${name.padEnd(28)} ${opts.frames.length} frames, ${buf.length} bytes`);
}

const pal = (n) => Array.from({ length: n }, (_, i) => [(i * 37) & 255, (i * 91) & 255, (i * 13 + 7) & 255]);

for (const n of [2, 3, 5, 16, 17, 200, 256]) {
  const w = 97, h = 61;
  const frames = Array.from({ length: 4 }, (_, k) => ({
    pixels: Uint8Array.from({ length: w * h }, (_, i) => k === 0 ? rnd(n) : (i % 7 < 3 ? rnd(n) : (i >> 4) % n)),
    delayMs: 10 * (k + 3),
  }));
  check(`random ${n} colours opaque`, { w, h, palette: pal(n), frames });
  check(`random ${n} colours transp`, { w, h, palette: pal(n), transparent: 0, frames });
}
// Long uniform runs (table fills and resets many times).
{
  const w = 2750, h = 600;
  const frames = [0, 1, 2].map(k => ({
    pixels: Uint8Array.from({ length: w * h }, (_, i) => ((i % w) / 50 | 0) % 3 === k ? 0 : 1 + (((i / w) / 50 | 0) + k) % 4),
    delayMs: 90,
  }));
  check('blocky 50 px cells', { w, h, palette: pal(5), transparent: 0, frames });
}
// Local palettes and an empty frame.
{
  const w = 40, h = 30;
  check('local palettes + empty', { w, h, palette: pal(4), transparent: 3, frames: [
    { pixels: Uint8Array.from({ length: w * h }, () => rnd(4)) },
    { pixels: new Uint8Array(w * h).fill(3) },
    { pixels: Uint8Array.from({ length: w * h }, () => rnd(8)), palette: pal(8), transparent: 7 },
  ] });
}
console.log('all GIF round trips pass');
