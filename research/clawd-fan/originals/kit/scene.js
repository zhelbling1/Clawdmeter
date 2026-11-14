/**
 * Scene builder: collects frames, then writes the scene GIF (what the
 * converter reads), previews, and the folder's catalog.json entry.
 *
 *   const sc = scene({ dir: __dirname, file: 'Clawd-Moonwalk.gif', name: 'moonwalk',
 *                      mood: 'active', headroom: 6, credit, references });
 *   sc.frame(ms, g => { ... });         // draw one frame on a fresh Canvas
 *   sc.loopStart(); ...frames...; sc.loopEnd();   // the loopable middle
 *   sc.finish();
 *
 * Outputs (in `dir`):
 *   <file>                     the scene at 50 px per cell (2750 px wide, the
 *                              official core GIFs' scale), transparent ground,
 *                              decoded by tools/convert_official_clawd.js
 *   preview/<base>.gif         8 px per cell on black, the loop played 3 times,
 *                              rendered from the converter's own output
 *   preview/<base>-sheet.png   contact sheet of every frame (hold, loop marks)
 *   catalog.json               entry { file, name, mood, rows, loop, credit,
 *                              references, frames, ms, colours, kb }
 *
 * finish() checks the style rules it can: ≤ 15 colours plus background,
 * colour pairs the converter would merge, first/last frame = official idle,
 * 3–8 s, a loop is marked, nothing cut off above the headroom. It decodes
 * its own GIF through the converter and confirms every cell (skip with
 * --fast). Flags: --fast, --no-preview.
 */
const fs = require('fs');
const path = require('path');
const { encodeGif } = require('./gif_encode');
const { Canvas, W, STAGE_H, C, dist2, key, hex } = require('./canvas');
const { clawd } = require('./poses');
const { Raster, sheet, conv } = require('./render');

const SCALE = 50;               // px per cell, as the official core GIFs
const PREVIEW_SCALE = 8;
const MOODS = ['active', 'heavy', 'calm'];

function scene({ dir, file, name, mood, headroom = 0, credit = '', references = '', notes = '' }) {
  if (!dir || !file || !name) throw new Error('scene: dir, file and name are required');
  if (!MOODS.includes(mood)) throw new Error(`scene: mood must be one of ${MOODS}`);
  const argv = process.argv.slice(2);
  const frames = [];            // { g, ms }
  let loopA = null, loopB = null;

  const api = {
    headroom,
    /** Add a frame: draw(g) paints a fresh Canvas. Returns the canvas. */
    frame(ms, draw) {
      const g = new Canvas(headroom);
      draw(g);
      frames.push({ g, ms });
      return g;
    },
    /** Repeat the previous frame's picture for `ms` more. */
    hold(ms) { if (!frames.length) throw new Error('hold: no frame yet'); frames[frames.length - 1].ms += ms; },
    loopStart() { loopA = frames.length; },
    loopEnd() { loopB = frames.length - 1; },
    get count() { return frames.length; },
    finish,
  };

  function finish() {
    const warn = [];
    if (loopA == null || loopB == null || loopB < loopA) throw new Error(`${name}: mark the loop with loopStart() / loopEnd()`);
    // 1. Collapse consecutive identical frames (the converter does the same),
    //    remapping the loop markers.
    const sig = (g) => g.cells.map(r => r.map(c => c ? key(c) : -1).join(',')).join(';');
    const out = [];      // { g, ms, sig, first }
    let A = null, B = null;
    frames.forEach((f, i) => {
      const s = sig(f.g);
      const prev = out[out.length - 1];
      const startsLoop = i === loopA;
      if (prev && prev.sig === s && !startsLoop) prev.ms += f.ms;
      else out.push({ g: f.g, ms: f.ms, sig: s });
      if (i === loopA) A = out.length - 1;
      if (i === loopB) B = out.length - 1;
    });
    // A frame after the loop identical to its last frame would merge into it.
    if (out[B + 1] && out[B + 1].sig === out[B].sig) warn.push('the frame after the loop repeats its last frame');
    for (const f of out) f.ms = Math.max(20, Math.round(f.ms / 10) * 10);
    const total = out.reduce((s, f) => s + f.ms, 0);

    // 2. Colours.
    const colours = new Map();
    for (const f of out) for (const row of f.g.cells) for (const c of row) if (c) colours.set(key(c), c);
    const pal = [...colours.values()];
    if (pal.length > 15) throw new Error(`${name}: ${pal.length} colours; the converter keeps 15 plus the background. Used: ${pal.map(hex).join(' ')}`);
    for (let i = 0; i < pal.length; i++) for (let j = i + 1; j < pal.length; j++)
      if (dist2(pal[i], pal[j]) <= conv.COLOR_MERGE_DIST2) warn.push(`colours ${hex(pal[i])} and ${hex(pal[j])} are close enough to merge in the converter`);

    // 3. Style checks.
    const idle = new Canvas(headroom); clawd(idle, 'idle');
    if (out[0].sig !== sig(idle)) warn.push('first frame is not the official idle pose (rule 5)');
    if (out[out.length - 1].sig !== sig(idle)) warn.push('last frame is not the official idle pose (rule 5)');
    if (total < 3000 || total > 8000) warn.push(`runs ${(total / 1000).toFixed(1)} s; scenes run 3-8 s (rule 6)`);
    const clipped = frames.reduce((s, f) => s + f.g.clippedTop, 0);
    if (clipped) warn.push(`${clipped} cells drawn above the headroom (y < ${-headroom}) were cut off: raise headroom (max 11)`);

    // 4. The scene GIF: index 0 transparent, then the palette.
    const rows = STAGE_H + headroom;
    const gifPal = [[255, 0, 255], ...pal];
    const idx = new Map(pal.map((c, i) => [key(c), i + 1]));
    const toPixels = (g, s) => {
      const px = new Uint8Array(W * s * rows * s);
      for (let r = 0; r < rows; r++) for (let x = 0; x < W; x++) {
        const c = g.cells[r][x]; if (!c) continue;
        const v = idx.get(key(c));
        for (let yy = 0; yy < s; yy++) px.fill(v, (r * s + yy) * W * s + x * s, (r * s + yy) * W * s + x * s + s);
      }
      return px;
    };
    const gifPath = path.join(dir, file);
    const gif = encodeGif({ w: W * SCALE, h: rows * SCALE, palette: gifPal, transparent: 0, loop: 0,
      frames: out.map(f => ({ pixels: toPixels(f.g, SCALE), delayMs: f.ms })) });
    fs.writeFileSync(gifPath, gif);

    // 5. Round trip through the converter's decoder and sampler, then build
    //    the animation exactly as the converter will.
    let grids;
    if (!argv.includes('--fast')) {
      const dec = conv.decodeGif(gifPath);
      const sampled = conv.sampleGrids(dec, rows);
      if (sampled.cols !== W || sampled.rows !== rows) throw new Error(`${name}: GIF samples as ${sampled.cols}x${sampled.rows}`);
      sampled.grids.forEach((gr, i) => {
        for (let r = 0; r < rows; r++) for (let x = 0; x < W; x++) {
          const want = out[i].g.cells[r][x] || [255, 0, 255], got = gr[r][x];
          if (want[0] !== got[0] || want[1] !== got[1] || want[2] !== got[2])
            throw new Error(`${name}: GIF frame ${i} cell (${x},${r - headroom}) decodes as ${got}, drawn ${want}`);
        }
      });
      if (dec.some((d, i) => d.holdMs !== Math.max(out[i].ms, 20))) throw new Error(`${name}: GIF holds differ after decoding`);
      grids = sampled.grids;
    } else {
      grids = out.map(f => f.g.cells.map(row => row.map(c => c ? c.slice() : [255, 0, 255])));
    }
    const anim = conv.buildAnim(grids, out.map(f => f.ms), [255, 0, 255], { noCycle: true });
    anim.oy -= headroom;
    if (anim.frames.length !== out.length) warn.push(`converter keeps ${anim.frames.length} of ${out.length} frames (colours merged?); loop markers may be off`);
    const kb = anim.frames.length * anim.w * anim.h / 1024;
    if (kb > 40) warn.push(`${kb.toFixed(1)} KB of cell data; the budget is about 40 KB (rule 9)`);

    // 6. Previews from the converted animation (what the device draws).
    const base = path.basename(file, path.extname(file));
    if (!argv.includes('--no-preview')) {
      const pdir = path.join(dir, 'preview');
      fs.mkdirSync(pdir, { recursive: true });
      const pal565 = anim.palette;    // [r,g,b], index 0 black
      const S = PREVIEW_SCALE;
      const order = [...out.keys()].slice(0, A)
        .concat(...[0, 1, 2].map(() => [...out.keys()].slice(A, B + 1)))
        .concat([...out.keys()].slice(B + 1));
      const pframes = order.map(i => {
        const px = new Uint8Array(W * S * rows * S);
        const f = anim.frames[i];
        for (let r = 0; r < anim.h; r++) for (let c = 0; c < anim.w; c++) {
          const v = f[r * anim.w + c]; if (!v) continue;
          const y = (r + anim.oy + headroom) * S, x = (c + anim.ox) * S;
          for (let yy = 0; yy < S; yy++) px.fill(v, (y + yy) * W * S + x, (y + yy) * W * S + x + S);
        }
        return { pixels: px, delayMs: out[i].ms };
      });
      fs.writeFileSync(path.join(pdir, `${base}.gif`),
        encodeGif({ w: W * S, h: rows * S, palette: pal565, loop: 0, frames: pframes }));
      const items = out.map((f, i) => ({
        cell: (x, y) => f.g.get(x, y), top: -headroom,
        label: `${i} ${f.ms}MS`,
        sub: i === A && i === B ? 'LOOP' : i === A ? 'LOOP>' : i === B ? '<LOOP' : '',
      }));
      fs.writeFileSync(path.join(pdir, `${base}-sheet.png`), sheet(items, { per: 5, scale: 6 }).png());
    }

    // 7. Catalog entry.
    const catPath = path.join(dir, 'catalog.json');
    let cat = [];
    if (fs.existsSync(catPath)) cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
    const entry = { file, name, mood, rows, loop: [A, B], credit, references,
      frames: out.length, ms: total, colours: pal.length + 1, kb: +kb.toFixed(1) };
    if (notes) entry.notes = notes;
    const at = cat.findIndex(e => e.file === file);
    if (at >= 0) cat[at] = entry; else cat.push(entry);
    fs.writeFileSync(catPath, JSON.stringify(cat, null, 2) + '\n');

    const loopMs = out.slice(A, B + 1).reduce((s, f) => s + f.ms, 0);
    console.log(`${name}: ${out.length} frames, ${(total / 1000).toFixed(2)} s (loop ${A}..${B}, ${(loopMs / 1000).toFixed(2)} s), ` +
      `${pal.length + 1} colours with background, ${anim.w}x${anim.h} cells at (${anim.ox},${anim.oy}), ` +
      `${kb.toFixed(1)} KB converted, GIF ${(gif.length / 1024).toFixed(0)} KB${argv.includes('--fast') ? '' : ' (round trip ok)'}`);
    for (const w of warn) console.log(`  warning: ${w}`);
    return { frames: out, anim, warnings: warn, kb };
  }
  return api;
}

module.exports = { scene, SCALE };
