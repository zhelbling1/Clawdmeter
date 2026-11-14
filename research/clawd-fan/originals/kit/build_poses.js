#!/usr/bin/env node
/**
 * Regenerates kit/poses.json: every distinct frame of the official core
 * Clawd GIFs (research/clawd-official/), recovered cell-exact on the 55×37
 * stage with the converter's own decoder and grid sampling.
 *
 * Cell codes: 'o' body #D97757, 's' shade #BF694D, 'e' eye, '.' empty.
 * Frames are cropped to their bounding box: { src: [GIF frame numbers],
 * ms, x, y, rows }. poses.js names the useful ones and derives anchors.
 *
 * Usage: node kit/build_poses.js      (takes ~30 s; poses.json is checked in)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const conv = require(path.join(ROOT, 'tools', 'convert_official_clawd.js'));

const CLIPS = {
  waving: 'Clawd-Waving.gif',
  walking: 'Clawd-Walking.gif',
  crab: 'Clawd-CrabWalking.gif',
  jumping: 'Clawd-Jumping.gif',
  happy: 'Clawd-JumpingHappy.gif',
  pointing: 'Clawd-Pointing.gif',
  dancing: 'Clawd-Dancing.gif',
};
const BODY = [0xD9, 0x77, 0x57], SHADE = [0xBF, 0x69, 0x4D];
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function code(c) {
  if (c[0] === 255 && c[1] === 0 && c[2] === 255) return '.';
  if (c[0] < 40 && c[1] < 40 && c[2] < 40) return 'e';
  if (d2(c, BODY) <= 600) return 'o';
  if (d2(c, SHADE) <= 600) return 's';
  throw new Error(`unexpected colour ${c}`);
}

const out = { generated: 'kit/build_poses.js from research/clawd-official core GIFs', clips: {} };
for (const [name, file] of Object.entries(CLIPS)) {
  const frames = conv.decodeGif(path.join(ROOT, 'research', 'clawd-official', file));
  const { grids, cols, rows } = conv.sampleGrids(frames);
  if (cols !== 55 || rows !== 37) throw new Error(`${file}: sampled ${cols}x${rows}`);
  const list = [];
  grids.forEach((g, i) => {
    const s = g.map(row => row.map(code).join(''));
    let x0 = 55, y0 = 37, x1 = -1, y1 = -1;
    s.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }));
    const crop = s.slice(y0, y1 + 1).map(r => r.slice(x0, x1 + 1));
    const prev = list[list.length - 1];
    if (prev && prev.x === x0 && prev.y === y0 && prev.rows.join() === crop.join()) {
      prev.src.push(i); prev.ms += frames[i].holdMs; return;
    }
    list.push({ src: [i], ms: frames[i].holdMs, x: x0, y: y0, rows: crop });
  });
  out.clips[name] = { file, frames: list };
  console.log(`${name.padEnd(9)} ${file.padEnd(24)} ${frames.length} frames -> ${list.length} distinct`);
}
// One frame per block, one row per line: diffs stay readable.
const NL = '\n';
const body = Object.entries(out.clips).map(([name, c]) =>
  `  "${name}": {"file": "${c.file}", "frames": [` + NL +
  c.frames.map(f => `    {"src": [${f.src}], "ms": ${f.ms}, "x": ${f.x}, "y": ${f.y}, "rows": [` + NL +
    f.rows.map(r => `      "${r}"`).join(',' + NL) + ']}').join(',' + NL) + ']}').join(',' + NL);
fs.writeFileSync(path.join(__dirname, 'poses.json'),
  `{"generated": "${out.generated}", "clips": {` + NL + body + NL + '}}' + NL);
console.log('Wrote kit/poses.json');
