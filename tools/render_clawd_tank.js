#!/usr/bin/env node
/**
 * Renders the clawd-tank SVG animations (research/clawd-fan/clawd-tank/svg/,
 * MIT, by @marciogranzotto) onto Clawd's cell grid and writes them as GIFs
 * next to the SVGs, for tools/convert_official_clawd.js to read like any
 * other source.
 *
 * The SVGs draw Clawd with axis-aligned rects on a 1-unit grid (a 15x9-unit
 * body) and animate them with CSS (rotations, half-unit translates, opacity
 * fades), so they're not frame grids: each frame is rendered by headless
 * Chrome at a fixed animation time and sampled at cell centres.
 *
 * Scale: 1 SVG unit = 2 stage cells, the size of one of Clawd's body pixels
 * in the official art (the official idle pose draws every feature in 2x2
 * cells), so every rect and every half-unit offset lands exactly on cells.
 * Placement: the tank Clawd's feet (unit y 15) on stage row 37 and his centre
 * (unit x 7.5) on the official idle pose's centre (stage column 27).
 *
 * Colours snap to the clip's own SVG fills; the body #DE886D becomes the
 * official body #D87656 (so the palette's Clawd colour repaints him like the
 * official art) and black becomes the official eye ink #141413. The ground
 * shadow (black on a black panel) is dropped. Anything under 50 % opacity
 * counts as background.
 *
 * Usage: node tools/render_clawd_tank.js [--chrome PATH] [--only A,B]
 *                                        [--jobs N] [--survey]
 *   --chrome  Chrome/Chromium/Edge executable (else $CHROME, else common
 *             install paths)
 *   --only    render just these clips (names or SVG basenames)
 *   --jobs    clips rendered in parallel tabs (default 4)
 *   --survey  print each SVG's content bounds over time (in units) and exit
 *
 * Needs Node 22+ (built-in WebSocket) and a Chromium-based browser.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (k, def) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : def; };
const flag = (k) => args.includes(k);

const DIR = path.join(__dirname, '..', 'research', 'clawd-fan', 'clawd-tank');
const SVG_DIR = path.join(DIR, 'svg');

const STAGE_W = 55, STAGE_H = 37;       // the official art stage, cells
// The GIFs add the performer grid's 11 rows above the stage (60-row grid,
// stage anchored 11 rows down), so hats and thought bubbles fit; the
// converter reads them with `rows: 48` and gives those clips a negative oy.
const HEADROOM = 11;
const ROWS = STAGE_H + HEADROOM;
const CELLS_PER_UNIT = 2;
const CELL_PX = 4;                       // GIF pixels per cell
const UNIT_PX = CELLS_PER_UNIT * CELL_PX;
// Stage origin in SVG units: feet (y 15) on the stage floor, centre x 7.5 on
// stage column 27 (the official idle pose spans columns 15..38).
const UX0 = 7.5 - 27 / CELLS_PER_UNIT;   // -6
const UY0 = 15 - ROWS / CELLS_PER_UNIT;  // -9

const BODY_SVG = [0xDE, 0x88, 0x6D], BODY_OFFICIAL = [0xD8, 0x76, 0x56];
const EYE_INK = [0x14, 0x14, 0x13];
const BG = [255, 0, 255];                // transparent index colour (converter's sentinel)

// The clips. `period`: loop length in ms, a whole number of cycles of the
// clip's main motion so it loops seamlessly (a faster secondary motion with
// another period may jump once at the seam: the full common period of every
// animation would cost several times the flash); `step`: ms per rendered
// frame (the converter merges repeated frames into longer holds); `start`:
// where in the CSS timeline the window begins; `dx`: shift in units (grooving's
// notes would touch the stage's left edge, which the performer reads as art
// hanging off the screen edge); `css`: extra style for the render.
const CLIPS = [
  { svg: 'clawd-idle-living',        name: 'tank idle',        period: 16000, step: 200 },
  { svg: 'clawd-sleeping',           name: 'tank sleeping',    period: 6000,  step: 200 },
  { svg: 'clawd-idle-low-battery',   name: 'tank low battery', period: 8000,  step: 250 },
  { svg: 'clawd-working-typing',     name: 'tank typing',      period: 1200,  step: 60 },
  { svg: 'clawd-working-thinking',   name: 'tank thinking',    period: 4000,  step: 125 },
  { svg: 'clawd-working-debugger',   name: 'tank debugger',    period: 4000,  step: 100 },
  { svg: 'clawd-working-carrying',   name: 'tank carrying',    period: 2000,  step: 50 },
  { svg: 'clawd-grooving',           name: 'tank grooving',    period: 1600,  step: 80, dx: 0.5 },
  { svg: 'clawd-working-conducting', name: 'tank conducting',  period: 2000,  step: 80 },
  { svg: 'clawd-working-juggling',   name: 'tank juggling',    period: 1200,  step: 60 },
  { svg: 'clawd-working-builder',    name: 'tank builder',     period: 3600,  step: 120 },
  { svg: 'clawd-working-wizard',     name: 'tank wizard',      period: 3000,  step: 100 },
  { svg: 'clawd-working-building',   name: 'tank building',    period: 2000,  step: 100 },
];

// ── Chrome over the DevTools protocol ───────────────────────────────────────

function findChrome() {
  const c = opt('--chrome', process.env.CHROME);
  if (c) return c;
  const la = process.env.LOCALAPPDATA || '';
  const cands = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    path.join(la, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ];
  const pw = path.join(la, 'ms-playwright');
  if (fs.existsSync(pw))
    for (const d of fs.readdirSync(pw).filter(d => /^chromium-\d+$/.test(d)).sort().reverse())
      cands.push(path.join(pw, d, 'chrome-win64', 'chrome.exe'));
  const hit = cands.find(p => fs.existsSync(p));
  if (!hit) throw new Error('no Chrome found: pass --chrome PATH or set CHROME');
  return hit;
}

async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'clawd-tank-chrome-'));
  const proc = spawn(findChrome(), ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let err = '';
    proc.stderr.on('data', d => {
      err += d;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    proc.on('exit', code => reject(new Error(`chrome exited (${code}): ${err}`)));
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });
  let pages = 0;
  const newPage = async () => {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', newWindow: true });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const page = (m, p) => send(m, p, sessionId);
    page.tmp = path.join(profile, `page-${pages++}.html`);
    await page('Page.enable');
    return page;
  };
  const close = async () => {
    try { ws.close(); } catch {}
    const exited = new Promise(r => proc.once('exit', r));
    proc.kill();
    await exited;
    try {   // Chrome's helpers may still hold a file for a moment
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch { /* a leftover temp profile is harmless */ }
  };
  return { newPage, close };
}

// ── PNG decode (Chrome screenshots: 8-bit RGB or RGBA, non-interlaced) ──────

function decodePng(buf) {
  let pos = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('unsupported PNG');
      ct = data[9];
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error(`unsupported PNG colour type ${ct}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let p = 0;
      if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = (cur[i] + p) & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      out[o] = cur[x * bpp]; out[o + 1] = cur[x * bpp + 1]; out[o + 2] = cur[x * bpp + 2];
      out[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
    }
    [prev, cur] = [cur, prev];
  }
  return { w, h, rgba: out };
}

// ── GIF encode (global ≤16-colour palette, index 0 transparent) ─────────────

function lzw(indices, minCode) {
  const clear = 1 << minCode, eoi = clear + 1;
  const out = [];
  let acc = 0, nbits = 0, size = minCode + 1;
  const emit = (code) => {
    acc |= code << nbits; nbits += size;
    while (nbits >= 8) { out.push(acc & 255); acc >>>= 8; nbits -= 8; }
  };
  let dict = new Map(), next = eoi + 1;
  emit(clear);
  let w = String.fromCharCode(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = String.fromCharCode(indices[i]);
    const wk = w + k;
    if (dict.has(wk) || wk.length === 1) { w = wk; continue; }
    emit(w.length === 1 ? w.charCodeAt(0) : dict.get(w));
    if (next < 4096) {
      dict.set(wk, next++);
      if (next - 1 === (1 << size) && size < 12) size++;
    } else {
      emit(clear);
      dict = new Map(); next = eoi + 1; size = minCode + 1;
    }
    w = k;
  }
  emit(w.length === 1 ? w.charCodeAt(0) : dict.get(w));
  emit(eoi);
  if (nbits > 0) out.push(acc & 255);
  return Buffer.from(out);
}

function encodeGif(w, h, palette, frames /* [{idx:Uint8Array, delayMs}] */) {
  const parts = [];
  const pal = Buffer.alloc(16 * 3);
  palette.forEach((c, i) => { pal[i * 3] = c[0]; pal[i * 3 + 1] = c[1]; pal[i * 3 + 2] = c[2]; });
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(w, 0); lsd.writeUInt16LE(h, 2);
  lsd[4] = 0x80 | 0x30 | 3;              // global table, 4-bit colour, 16 entries
  parts.push(Buffer.from('GIF89a'), lsd, pal);
  parts.push(Buffer.from([0x21, 0xFF, 0x0B]), Buffer.from('NETSCAPE2.0'),
             Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]));
  for (const f of frames) {
    const cs = Math.max(2, Math.round(f.delayMs / 10));
    // disposal 2 (restore to background) + transparent index 0: every frame is whole
    parts.push(Buffer.from([0x21, 0xF9, 0x04, (2 << 2) | 1, cs & 255, cs >> 8, 0, 0]));
    const id = Buffer.alloc(10);
    id[0] = 0x2C; id.writeUInt16LE(w, 5); id.writeUInt16LE(h, 7);
    parts.push(id, Buffer.from([4]));
    const data = lzw(f.idx, 4);
    for (let i = 0; i < data.length; i += 255) {
      const n = Math.min(255, data.length - i);
      parts.push(Buffer.from([n]), data.subarray(i, i + n));
    }
    parts.push(Buffer.from([0]));
  }
  parts.push(Buffer.from([0x3B]));
  return Buffer.concat(parts);
}

// ── Rendering ───────────────────────────────────────────────────────────────

const hex = (s) => {
  s = s.replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// The SVG's own fill colours, mapped to their device colours.
function svgPalette(text) {
  const cols = [];
  for (const m of text.matchAll(/(?:fill|stroke|color)\s*[:=]\s*"?\s*(#[0-9a-fA-F]{3,6})\b/g)) {
    const c = hex(m[1]);
    if (!cols.some(x => same(x, c))) cols.push(c);
  }
  return cols;
}
const deviceColor = (c) =>
  same(c, BODY_SVG) ? BODY_OFFICIAL : (c[0] + c[1] + c[2] === 0 ? EYE_INK : c);

// Load an SVG at a viewBox window (units) scaled to UNIT_PX per unit.
async function loadSvg(page, file, vb, css = '') {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/<svg\b([^>]*)>/, (m, attrs) => {
    attrs = attrs.replace(/\s(viewBox|width|height)="[^"]*"/g, '');
    return `<svg${attrs} viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" ` +
           `width="${vb.w * UNIT_PX}" height="${vb.h * UNIT_PX}" overflow="hidden">`;
  });
  const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}` +
    `svg{display:block}#ground-shadow{display:none}${css}</style></head><body>${text}</body></html>`;
  const tmp = page.tmp;
  fs.writeFileSync(tmp, html);
  await page('Emulation.setDeviceMetricsOverride',
    { width: vb.w * UNIT_PX, height: vb.h * UNIT_PX, deviceScaleFactor: 1, mobile: false });
  await page('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await page('Page.navigate', { url: 'file:///' + tmp.replace(/\\/g, '/') });
  for (let i = 0; i < 100; i++) {
    const r = await page('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (r.result.value === 'complete') break;
    await new Promise(r => setTimeout(r, 20));
  }
  return text;
}

// One frame at time t (ms) as a grid of [r,g,b,a] samples at cell centres.
async function grab(page, t, cols, rows) {
  await page('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async () => {
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = ${t}; }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    })()`,
  });
  const { data } = await page('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const img = decodePng(Buffer.from(data, 'base64'));
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const x = c * CELL_PX + (CELL_PX >> 1), y = r * CELL_PX + (CELL_PX >> 1);
      const o = (y * img.w + x) * 4;
      row.push([img.rgba[o], img.rgba[o + 1], img.rgba[o + 2], img.rgba[o + 3]]);
    }
    grid.push(row);
  }
  return grid;
}

async function survey(page) {
  const vb = { x: -16, y: -26, w: 47, h: 47 };
  for (const f of fs.readdirSync(SVG_DIR).filter(f => f.endsWith('.svg')).sort()) {
    await loadSvg(page, path.join(SVG_DIR, f), vb);
    const cols = vb.w * CELLS_PER_UNIT, rows = vb.h * CELLS_PER_UNIT;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let t = 0; t < 8000; t += 200) {
      const g = await grab(page, t, cols, rows);
      g.forEach((row, r) => row.forEach((p, c) => {
        if (p[3] < 128) return;
        x0 = Math.min(x0, c); x1 = Math.max(x1, c); y0 = Math.min(y0, r); y1 = Math.max(y1, r);
      }));
    }
    const u = (c, o) => (o + c / CELLS_PER_UNIT).toFixed(1);
    console.log(`${f.padEnd(34)} x ${u(x0, vb.x)}..${u(x1 + 1, vb.x)}  y ${u(y0, vb.y)}..${u(y1 + 1, vb.y)}` +
      `  (stage x ${UX0}..${UX0 + STAGE_W / 2}, y ${UY0}..15)`);
  }
}

async function renderClip(page, clip) {
  const file = path.join(SVG_DIR, clip.svg + '.svg');
  const dx = clip.dx || 0;
  const vb = { x: UX0 - dx, y: UY0, w: STAGE_W / CELLS_PER_UNIT, h: ROWS / CELLS_PER_UNIT };
  const text = (await loadSvg(page, file, vb, clip.css)) + (clip.css || '');
  const palette = [BG, ...svgPalette(text).map(deviceColor)
    .filter((c, i, a) => a.findIndex(x => same(x, c)) === i)];
  if (palette.length > 16) throw new Error(`${clip.svg}: ${palette.length - 1} colours`);
  const grids = [];
  for (let t = 0; t < clip.period; t += clip.step)
    grids.push(await grab(page, (clip.start || 0) + t, STAGE_W, ROWS));
  const nearest = (c) => {
    let k = 0, bd = Infinity;
    for (let i = 1; i < palette.length; i++) {
      const d = dist2(palette[i], c);
      if (d < bd) { bd = d; k = i; }
    }
    return [k, bd];
  };
  // Translucent props (a lens, a glow) blend into colours of their own: the
  // frequent ones join the palette while there's room, the rest snap.
  const FAR = 3000;
  const blends = new Map();
  for (const g of grids) for (const row of g) for (const p of row) {
    if (p[3] < 128) continue;
    const c = deviceColor(p);
    if (nearest(c)[1] <= FAR) continue;
    const key = c.join();
    blends.set(key, (blends.get(key) || 0) + 1);
  }
  for (const [key, n] of [...blends].sort((a, b) => b[1] - a[1])) {
    if (palette.length >= 16 || n < 4) break;
    const c = key.split(',').map(Number);
    if (nearest(c)[1] > FAR) palette.push(c);
  }
  const frames = [];
  let clipped = 0, offPalette = 0;
  for (const g of grids) {
    const idx = new Uint8Array(STAGE_W * CELL_PX * ROWS * CELL_PX);
    g.forEach((row, r) => row.forEach((p, c) => {
      let k = 0;
      if (p[3] >= 128) {
        const [i, bd] = nearest(deviceColor(p));
        k = i;
        if (bd > FAR) offPalette++;
        if ((c === 0 || c === STAGE_W - 1 || r === 0)) clipped++;
      }
      for (let y = 0; y < CELL_PX; y++)
        idx.fill(k, (r * CELL_PX + y) * STAGE_W * CELL_PX + c * CELL_PX,
                    (r * CELL_PX + y) * STAGE_W * CELL_PX + (c + 1) * CELL_PX);
    }));
    frames.push({ idx, delayMs: clip.step });
  }
  const gif = encodeGif(STAGE_W * CELL_PX, ROWS * CELL_PX, palette, frames);
  const out = path.join(DIR, clip.svg + '.gif');
  fs.writeFileSync(out, gif);
  console.log(`${clip.name.padEnd(18)} ${frames.length} frames, ${palette.length - 1} colours, ` +
    `${(gif.length / 1024).toFixed(0)} KB` +
    `${clipped ? `, ${clipped} cells on the stage edge (clipped?)` : ''}` +
    `${offPalette ? `, ${offPalette} opaque cells far from the palette` : ''}`);
  return out;
}

async function main() {
  const { newPage, close } = await launch();
  try {
    if (flag('--survey')) { await survey(await newPage()); return; }
    const only = opt('--only', null);
    const todo = CLIPS.filter(c => !only || only.split(',').some(o => o === c.name || o === c.svg));
    // Clips render in parallel tabs; each tab's frames are sequential.
    const jobs = Math.max(1, Math.min(todo.length, Number(opt('--jobs', 4))));
    let next = 0;
    await Promise.all(Array.from({ length: jobs }, async () => {
      const page = await newPage();
      while (next < todo.length) await renderClip(page, todo[next++]);
    }));
  } finally {
    await close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
