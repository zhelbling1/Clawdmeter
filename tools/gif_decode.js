/**
 * Dependency-free GIF decoder: the fallback convert_official_clawd.js uses
 * when ImageMagick isn't installed (a stock Windows box). It returns what
 * `convert -coalesce -background magenta -alpha remove` plus
 * `identify -format %T` do: every frame composited to the full canvas
 * (disposal methods honoured), transparent pixels flattened to magenta, and
 * the per-frame delay in centiseconds.
 *
 *   decodeGif(buffer) -> { w, h, frames: [{ data: Buffer(RGB, w*h*3), delayCs }] }
 */

function lzw(minCode, bytes, pixelCount) {
  const out = new Uint8Array(pixelCount);
  const clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1, next = eoi + 1;
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), len = new Uint16Array(4096);
  for (let i = 0; i < clear; i++) { suffix[i] = i; len[i] = 1; prefix[i] = -1; }
  let bits = 0, nbits = 0, pos = 0, o = 0, prev = -1;
  const stack = new Uint8Array(4097);
  while (o < pixelCount) {
    while (nbits < size && pos < bytes.length) { bits |= bytes[pos++] << nbits; nbits += 8; }
    if (nbits < size) break;
    const code = bits & ((1 << size) - 1);
    bits >>>= size; nbits -= size;
    if (code === clear) { size = minCode + 1; next = eoi + 1; prev = -1; continue; }
    if (code === eoi) break;
    let cur = code;
    if (prev === -1) { out[o++] = suffix[code]; prev = code; continue; }
    let sp = 0, first;
    if (code >= next) {                // KwKwK: previous string + its first byte
      let t = prev;
      while (prefix[t] !== -1) t = prefix[t];
      first = suffix[t];
      stack[sp++] = first;
      cur = prev;
    }
    while (cur !== -1) { stack[sp++] = suffix[cur]; cur = prefix[cur]; }
    first = stack[sp - 1];
    while (sp > 0 && o < pixelCount) out[o++] = stack[--sp];
    if (next < 4096) {
      prefix[next] = prev; suffix[next] = first; len[next] = len[prev] + 1; next++;
      if (next === (1 << size) && size < 12) size++;
    }
    prev = code;
  }
  return out;
}

function decodeGif(buf) {
  if (buf.toString('latin1', 0, 3) !== 'GIF') throw new Error('not a GIF');
  const w = buf.readUInt16LE(6), h = buf.readUInt16LE(8);
  const flags = buf[10];
  let pos = 13;
  let gct = null;
  if (flags & 0x80) { const n = 3 * (1 << ((flags & 7) + 1)); gct = buf.subarray(pos, pos + n); pos += n; }

  // Canvas of RGBA-ish cells: transparent = alpha 0.
  const canvas = new Uint8Array(w * h * 4);
  const frames = [];
  let gce = { delay: 0, trans: -1, disposal: 0 };
  let pendingDisposal = null;          // { method, rect, saved }

  const dispose = () => {
    if (!pendingDisposal) return;
    const { method, x, y, fw, fh, saved } = pendingDisposal;
    if (method === 2) {
      for (let r = 0; r < fh; r++) canvas.fill(0, ((y + r) * w + x) * 4, ((y + r) * w + x + fw) * 4);
    } else if (method === 3 && saved) {
      canvas.set(saved);
    }
    pendingDisposal = null;
  };

  while (pos < buf.length) {
    const b = buf[pos++];
    if (b === 0x3B) break;
    if (b === 0x21) {
      const label = buf[pos++];
      if (label === 0xF9) {
        const f = buf[pos + 1];
        gce = { disposal: (f >> 2) & 7, trans: (f & 1) ? buf[pos + 4] : -1, delay: buf.readUInt16LE(pos + 2) };
      }
      while (buf[pos] !== 0) pos += buf[pos] + 1;
      pos++;
    } else if (b === 0x2C) {
      const fx = buf.readUInt16LE(pos), fy = buf.readUInt16LE(pos + 2);
      const fw = buf.readUInt16LE(pos + 4), fh = buf.readUInt16LE(pos + 6);
      const lf = buf[pos + 8];
      pos += 9;
      let ct = gct;
      if (lf & 0x80) { const n = 3 * (1 << ((lf & 7) + 1)); ct = buf.subarray(pos, pos + n); pos += n; }
      const minCode = buf[pos++];
      const chunks = [];
      while (buf[pos] !== 0) { chunks.push(buf.subarray(pos + 1, pos + 1 + buf[pos])); pos += buf[pos] + 1; }
      pos++;
      const idx = lzw(minCode, Buffer.concat(chunks), fw * fh);

      dispose();
      const saved = gce.disposal === 3 ? canvas.slice() : null;
      // De-interlace row order when asked.
      const rowOf = new Array(fh);
      if (lf & 0x40) {
        let r = 0;
        for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]])
          for (let y = start; y < fh; y += step) rowOf[r++] = y;
      } else for (let y = 0; y < fh; y++) rowOf[y] = y;
      for (let r = 0; r < fh; r++) {
        const dy = fy + rowOf[r];
        if (dy >= h) continue;
        for (let c = 0; c < fw; c++) {
          const dx = fx + c;
          if (dx >= w) continue;
          const v = idx[r * fw + c];
          if (v === gce.trans) continue;
          const o = (dy * w + dx) * 4;
          canvas[o] = ct[v * 3]; canvas[o + 1] = ct[v * 3 + 1]; canvas[o + 2] = ct[v * 3 + 2]; canvas[o + 3] = 255;
        }
      }
      const rgb = Buffer.alloc(w * h * 3);
      for (let i = 0; i < w * h; i++) {
        if (canvas[i * 4 + 3]) { rgb[i * 3] = canvas[i * 4]; rgb[i * 3 + 1] = canvas[i * 4 + 1]; rgb[i * 3 + 2] = canvas[i * 4 + 2]; }
        else { rgb[i * 3] = 255; rgb[i * 3 + 1] = 0; rgb[i * 3 + 2] = 255; }
      }
      frames.push({ data: rgb, delayCs: gce.delay });
      pendingDisposal = { method: gce.disposal, x: fx, y: fy, fw: Math.min(fw, w - fx), fh: Math.min(fh, h - fy), saved };
      gce = { delay: 0, trans: -1, disposal: 0 };
    } else {
      throw new Error(`unexpected GIF block 0x${b.toString(16)}`);
    }
  }
  return { w, h, frames };
}

module.exports = { decodeGif };
