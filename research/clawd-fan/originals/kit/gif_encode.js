/**
 * Dependency-free GIF89a encoder (the counterpart of tools/gif_decode.js).
 *
 *   encodeGif({
 *     w, h,                       // logical screen, pixels
 *     palette: [[r,g,b], ...],    // global colour table (≤ 256 entries)
 *     transparent: idx | null,    // global transparent index (null = opaque)
 *     loop: 0,                    // NETSCAPE loop count (0 = forever, null = no block)
 *     frames: [{
 *       pixels: Uint8Array(w*h),  // palette indices, row-major, full canvas
 *       delayMs: 80,              // rounded to centiseconds (GIF's unit)
 *       palette?, transparent?,   // optional local colour table for this frame
 *     }],
 *   }) -> Buffer
 *
 * Frame packing is lossless and automatic:
 *  - with a transparent index, each frame is cropped to the box of its
 *    non-transparent pixels and disposed to background (method 2), so cells
 *    can turn transparent again;
 *  - without one, each frame stores only the box that changed since the
 *    previous frame (disposal 1, "leave in place").
 * Either way every decoder (tools/gif_decode.js, ImageMagick, browsers)
 * reconstructs exactly `pixels` for every frame.
 */

// LZW with GIF's variable code width (LSB-first bit packing, clear code
// emitted when the table reaches 4096 entries).
function lzwEncode(minCode, idx) {
  const clear = 1 << minCode, eoi = clear + 1;
  const alpha = 1 << minCode;
  const dict = new Int16Array(4096 * alpha);   // (prefix code, next index) -> code
  const out = [];
  let acc = 0, nacc = 0;
  let size = minCode + 1, next = eoi + 1;
  const emit = (code) => {
    acc |= code << nacc; nacc += size;
    while (nacc >= 8) { out.push(acc & 255); acc >>>= 8; nacc -= 8; }
  };
  dict.fill(-1);
  emit(clear);
  if (idx.length === 0) { emit(eoi); if (nacc) out.push(acc & 255); return Buffer.from(out); }
  let cur = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i];
    const slot = cur * alpha + k;
    const hit = dict[slot];
    if (hit >= 0) { cur = hit; continue; }
    emit(cur);
    if (next === 4096) {                 // table full: reset
      emit(clear);
      dict.fill(-1);
      size = minCode + 1; next = eoi + 1;
    } else {
      dict[slot] = next;
      if (next === (1 << size) && size < 12) size++;
      next++;
    }
    cur = k;
  }
  emit(cur);
  emit(eoi);
  if (nacc > 0) out.push(acc & 255);
  return Buffer.from(out);
}

function tableBits(n) { let b = 1; while ((1 << b) < n) b++; return b; }   // 1..8

function colourTable(pal, bits) {
  const t = Buffer.alloc(3 * (1 << bits));
  pal.forEach((c, i) => { t[i * 3] = c[0]; t[i * 3 + 1] = c[1]; t[i * 3 + 2] = c[2]; });
  return t;
}

function subBlocks(data) {
  const parts = [];
  for (let i = 0; i < data.length; i += 255) {
    const n = Math.min(255, data.length - i);
    parts.push(Buffer.from([n]), data.subarray(i, i + n));
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

function encodeGif({ w, h, palette, transparent = null, loop = 0, frames }) {
  if (!palette || !palette.length || palette.length > 256) throw new Error('palette must have 1..256 colours');
  const gBits = tableBits(Math.max(2, palette.length));
  const parts = [];
  const hdr = Buffer.alloc(13);
  hdr.write('GIF89a', 0, 'latin1');
  hdr.writeUInt16LE(w, 6); hdr.writeUInt16LE(h, 8);
  hdr[10] = 0x80 | ((gBits - 1) << 4) | (gBits - 1);   // global table, colour res, size
  hdr[11] = transparent == null ? 0 : transparent;     // background colour index
  parts.push(hdr, colourTable(palette, gBits));
  if (loop != null) {
    const b = Buffer.from([0x21, 0xFF, 0x0B, ...Buffer.from('NETSCAPE2.0', 'latin1'), 3, 1, 0, 0, 0]);
    b.writeUInt16LE(loop, 16);
    parts.push(b);
  }

  let prev = null;
  for (const f of frames) {
    const px = f.pixels;
    if (px.length !== w * h) throw new Error(`frame has ${px.length} pixels, expected ${w * h}`);
    const tr = f.transparent !== undefined ? f.transparent : transparent;
    // Box to store.
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    if (tr != null) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) if (px[row + x] !== tr) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    } else if (prev) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) if (px[row + x] !== prev[row + x]) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    } else { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }    // nothing to store: one pixel
    const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
    const sub = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++) sub.set(px.subarray((y0 + y) * w + x0, (y0 + y) * w + x0 + fw), y * fw);

    // Graphic control extension.
    const delayCs = Math.max(0, Math.round((f.delayMs != null ? f.delayMs : 80) / 10));
    const disposal = tr != null ? 2 : 1;
    const gce = Buffer.from([0x21, 0xF9, 4, (disposal << 2) | (tr != null ? 1 : 0), 0, 0, tr == null ? 0 : tr, 0]);
    gce.writeUInt16LE(delayCs, 4);
    parts.push(gce);

    // Image descriptor (+ optional local table) and LZW data.
    const desc = Buffer.alloc(10);
    desc[0] = 0x2C;
    desc.writeUInt16LE(x0, 1); desc.writeUInt16LE(y0, 3); desc.writeUInt16LE(fw, 5); desc.writeUInt16LE(fh, 7);
    let bits = gBits;
    if (f.palette) {
      bits = tableBits(Math.max(2, f.palette.length));
      desc[9] = 0x80 | (bits - 1);
      parts.push(desc, colourTable(f.palette, bits));
    } else parts.push(desc);
    const minCode = Math.max(2, bits);
    parts.push(Buffer.from([minCode]), subBlocks(lzwEncode(minCode, sub)));
    prev = px;
  }
  parts.push(Buffer.from([0x3B]));
  return Buffer.concat(parts);
}

module.exports = { encodeGif, lzwEncode };
