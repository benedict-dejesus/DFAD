/**
 * DFAD — DCPA Faculty Advisers Directory
 * Logo resizer.
 * Built and developed by Benedict de Jesus.
 *
 *     node dev/resize-logos.js
 *
 * The CAL and DCPA seals arrive as full-resolution PNGs (172 KB and 316 KB).
 * Shipping those to every student on prepaid mobile data costs more than the
 * entire rest of the site put together, so this produces the small versions
 * the interface actually displays.
 *
 * Re-run it if either source seal is replaced.
 *
 * No dependencies: Node's built-in zlib does the PNG decompression and
 * recompression, and the resampling is a plain box filter — which is what you
 * want for a large downscale anyway.
 *
 * Only the 8-bit truecolour-with-alpha, non-interlaced case is handled, which
 * is what both seals are. Anything else throws rather than writing a silently
 * wrong file.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const IMG_DIR = path.join(__dirname, '..', 'assets', 'img');

/* --------------------------------------------------------------------------
   PNG decode
   -------------------------------------------------------------------------- */

function readChunks(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error('not a PNG');
  }
  const chunks = [];
  let at = 8;
  while (at < buf.length) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    chunks.push({ type, data: buf.subarray(at + 8, at + 8 + length) });
    at += 12 + length; // length + type + data + crc
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** @returns {{width:number, height:number, rgba:Buffer}} */
function decodePng(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('no IHDR');

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];

  if (depth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `unsupported PNG (bit depth ${depth}, colour type ${colorType}, interlace ${interlace}); ` +
      'this script only handles 8-bit RGBA, non-interlaced'
    );
  }

  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const raw = zlib.inflateSync(idat);

  const bpp = 4;
  const stride = width * bpp;
  const rgba = Buffer.alloc(height * stride);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const out = rgba.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      const v = line[x];
      switch (filter) {
        case 0: out[x] = v; break;
        case 1: out[x] = (v + a) & 0xff; break;
        case 2: out[x] = (v + b) & 0xff; break;
        case 3: out[x] = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: out[x] = (v + paeth(a, b, c)) & 0xff; break;
        default: throw new Error('unknown filter type ' + filter);
      }
    }
  }
  return { width, height, rgba };
}

/* --------------------------------------------------------------------------
   Resize — box filter, alpha-weighted so edges do not pick up dark fringes
   -------------------------------------------------------------------------- */

function resize(src, targetW, targetH) {
  const { width: sw, height: sh, rgba } = src;
  const out = Buffer.alloc(targetW * targetH * 4);

  for (let y = 0; y < targetH; y++) {
    const y0 = Math.floor((y * sh) / targetH);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / targetH));
    for (let x = 0; x < targetW; x++) {
      const x0 = Math.floor((x * sw) / targetW);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / targetW));

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sw + sx) * 4;
          const alpha = rgba[i + 3];
          // Premultiply so transparent pixels do not drag colour into the edge.
          r += rgba[i] * alpha;
          g += rgba[i + 1] * alpha;
          b += rgba[i + 2] * alpha;
          a += alpha;
          n++;
        }
      }
      const o = (y * targetW + x) * 4;
      if (a === 0) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      } else {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round(a / n);
      }
    }
  }
  return { width: targetW, height: targetH, rgba: out };
}

/* --------------------------------------------------------------------------
   PNG encode
   -------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Filters each scanline with every filter type and keeps the cheapest. */
function filterScanlines(image) {
  const { width, height, rgba } = image;
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * (stride + 1));

  for (let y = 0; y < height; y++) {
    const line = rgba.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : null;

    let best = null;
    for (let type = 0; type <= 4; type++) {
      const cand = Buffer.alloc(stride);
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? line[x - bpp] : 0;
        const b = prev ? prev[x] : 0;
        const c = prev && x >= bpp ? prev[x - bpp] : 0;
        let v;
        switch (type) {
          case 0: v = line[x]; break;
          case 1: v = line[x] - a; break;
          case 2: v = line[x] - b; break;
          case 3: v = line[x] - ((a + b) >> 1); break;
          default: v = line[x] - paeth(a, b, c); break;
        }
        v &= 0xff;
        cand[x] = v;
        score += v < 128 ? v : 256 - v; // minimum sum of absolute differences
      }
      if (!best || score < best.score) best = { type, cand, score };
    }

    out[y * (stride + 1)] = best.type;
    best.cand.copy(out, y * (stride + 1) + 1);
  }
  return out;
}

function encodePng(image) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: truecolour with alpha
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(filterScanlines(image), { level: 9, memLevel: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

const JOBS = [
  { from: 'CAL_logo.png', to: 'cal-logo.png', size: 192 },
  { from: 'DCPA_logo.png', to: 'dcpa-logo.png', size: 192 }
];

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

let totalBefore = 0;
let totalAfter = 0;

for (const job of JOBS) {
  const srcPath = path.join(IMG_DIR, job.from);
  if (!fs.existsSync(srcPath)) {
    console.error(`SKIP  ${job.from} — not found`);
    continue;
  }
  const srcBuf = fs.readFileSync(srcPath);
  const decoded = decodePng(srcBuf);

  // Keep the aspect ratio; the seals are square or very close to it.
  const scale = job.size / Math.max(decoded.width, decoded.height);
  const w = Math.max(1, Math.round(decoded.width * scale));
  const h = Math.max(1, Math.round(decoded.height * scale));

  const out = encodePng(resize(decoded, w, h));
  fs.writeFileSync(path.join(IMG_DIR, job.to), out);

  totalBefore += srcBuf.length;
  totalAfter += out.length;
  console.log(
    `ok    ${job.from} ${decoded.width}x${decoded.height} ${kb(srcBuf.length)}` +
    `  ->  ${job.to} ${w}x${h} ${kb(out.length)}`
  );
}

console.log(
  `\ntotal ${kb(totalBefore)} -> ${kb(totalAfter)} ` +
  `(${Math.round((1 - totalAfter / totalBefore) * 100)}% smaller)`
);
