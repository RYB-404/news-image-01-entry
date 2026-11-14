// news-image-01 — "THE DAY ON ONE PAGE"
//
// A news-poster that sums up Friday 13 November 2026's world news in one
// 1024x1024 image: a "WORLD NEWS" masthead dated 13 November 2026, seven
// color-blocked stories (one per region) with big bitmap headlines, and a
// bottom ticker with four more one-line items.
//
// Everything the image says is vendored data: news.json is a snapshot of the
// day's headline facts gathered at build time (see REPORT.md for sources).
// The program is pure Node standard library, offline and deterministic —
// two runs write identical bytes.
//
// Rendering: layout shapes (cards, chips, rules, plane) are drawn with signed
// distance fields, supersampled 3x and box-downscaled for clean anti-aliasing;
// headlines use a hand-rolled 5x7 bitmap font rasterized at integer pixel
// scale so every glyph edge lands exactly on the pixel grid. The result is
// encoded by hand as an 8-bit RGB PNG (zlib + CRC32) and written to
// $MAKEFUN_OUTPUT_DIR/entry.png (default /output/entry.png).
//
// Run: node main.ts   (dev: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts)

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------- vendored news data
const NEWS = JSON.parse(
  readFileSync(fileURLToPath(new URL('./news.json', import.meta.url)), 'utf8'),
);

// ------------------------------------------------------------------ constants
const W = 1024;
const H = 1024;
const SS = 3; // supersampling factor for SDF shapes
const AA = W * SS; // coverage sharpness for a 1-SS-pixel anti-aliased edge

// ------------------------------------------------------------------- colors
function hx(s) {
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
function mixC(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const PAPER_TOP = hx('#F8F3E7');
const PAPER_BOT = hx('#EEE6D4');
const INK = hx('#17140F');
const RED = hx('#C62828');
const WHITE = hx('#FFFDF7');
const CORAL = hx('#FF8F84');

// paper: very slight vertical gradient, like newsprint in warm light
function background(x, y, o) {
  const c = mixC(PAPER_TOP, PAPER_BOT, y);
  o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
}

// ------------------------------------------------------------- 5x7 bitmap font
// Hand-rolled. Each glyph: 7 rows, 5 bits per row, bit 4 = leftmost column.
const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  2: [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  3: [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  7: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x06, 0x06],
  ',': [0, 0, 0, 0, 0, 0x04, 0x08],
  ':': [0, 0x06, 0x06, 0, 0x06, 0x06, 0],
  '-': [0, 0, 0, 0x1f, 0, 0, 0],
  "'": [0x06, 0x06, 0, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '·': [0, 0, 0, 0x06, 0, 0, 0],
};

// text is rasterized as integer-aligned pixel rects drawn straight onto the
// final image (blocky bitmap type, perfectly crisp — no AA needed)
const textRects = [];
function textWidth(str, scale) {
  return str.length * 6 * scale - scale;
}
function drawText(str, x, y, scale, col, alpha = 1) {
  const s = String(str).toUpperCase();
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch];
    if (g) {
      for (let ry = 0; ry < 7; ry++) {
        const bits = g[ry];
        if (!bits) continue;
        for (let cxx = 0; cxx < 5; cxx++) {
          if (bits & (1 << (4 - cxx))) {
            textRects.push({
              x0: cx + cxx * scale,
              y0: y + ry * scale,
              x1: cx + (cxx + 1) * scale,
              y1: y + (ry + 1) * scale,
              r: col[0], g: col[1], b: col[2], a: alpha,
            });
          }
        }
      }
    }
    cx += 6 * scale;
  }
  return cx;
}

// ------------------------------------------------------------ SDF shape system
// Convex polygon as the max of its edge half-planes (winding auto-corrected);
// dilating by rr gives rounded corners.
function makeConvex(pts) {
  const n = pts.length;
  const edges = [];
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= n; cy /= n;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const len = Math.sqrt(ex * ex + ey * ey) || 1;
    let nx = ey / len, ny = -ex / len;
    if ((cx - a[0]) * nx + (cy - a[1]) * ny > 0) { nx = -nx; ny = -ny; }
    edges.push([a[0], a[1], nx, ny]);
  }
  return function (px, py) {
    let d = -1e9;
    for (let i = 0; i < n; i++) {
      const e = edges[i];
      const dist = (px - e[0]) * e[2] + (py - e[1]) * e[3];
      if (dist > d) d = dist;
    }
    return d;
  };
}

const shapes = [];
// shape coordinates are PIXELS; one subpixel = 1/SS px, so edge coverage must
// ramp over +-1/SS px (K = SS) for a 1-subpixel anti-aliased edge
function marginFor() { return 1.6 / SS + 0.001; }
function addShape(x0, y0, x1, y1, f) {
  shapes.push({ x0, y0, x1, y1, f });
}
// Rounded convex shape (rect when the points are corners), flat color.
// NOTE: the polygon is DILATED by rr (d = f - rr), so the drawn shape extends
// rr px beyond the given points on every side. roundedRect therefore insets
// its rect by rr first, so the COORDINATES PASSED TO roundedRect are the exact
// visual bounds and rr is the corner radius.
function convexShape(pts, rr, color, alpha = 1) {
  const f = makeConvex(pts);
  const m = rr + marginFor();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  addShape(x0 - m, y0 - m, x1 + m, y1 + m, (px, py, o) => {
    const d = f(px, py) - rr;
    const a = clamp(0.5 - d * SS, 0, 1) * alpha;
    if (a <= 0) return;
    o.a = a; o.r = color[0]; o.g = color[1]; o.b = color[2];
  });
}
function roundedRect(x0, y0, x1, y1, rr, color, alpha = 1) {
  const r = Math.min(rr, (x1 - x0) / 2, (y1 - y0) / 2);
  convexShape([[x0 + r, y0 + r], [x1 - r, y0 + r], [x1 - r, y1 - r], [x0 + r, y1 - r]], r, color, alpha);
}

// ------------------------------------------------------------------ layout
const MX = 40;              // side margin
const CW = W - 2 * MX;      // content width = 944
const RIGHT = MX + CW;      // 984

const DATE_Y = 34;
const RULE1_Y = 72;
const MAST_Y = 84;
const REDRULE_Y = 170;
const HERO_X = MX, HERO_Y = 184, HERO_W = CW, HERO_H = 126;
const GRID_TOP = 330, CARD_H = 190, CARD_W = 464, COL_GAP = 16, ROW_GAP = 14;
const COL_X = [MX, MX + CARD_W + COL_GAP]; // 40, 520
const TICKER_Y = 938, TICKER_H = 60;

const cardXs = [];
for (const cx0 of COL_X) for (const cy0 of [0, 1, 2]) cardXs.push([cx0, GRID_TOP + cy0 * (CARD_H + ROW_GAP)]);

const SCALE_CHIP = 2, SCALE_HEAD = 5, SCALE_SUB = 3;
const SCALE_DATE = 4, SCALE_MAST = 11, SCALE_HERO = 6, SCALE_TICK = 3;

// ---------------------------------------------------------------- scene build
// masthead
drawText(NEWS.dateLine, MX, DATE_Y, SCALE_DATE, INK);
drawText(NEWS.kicker, RIGHT - textWidth(NEWS.kicker, SCALE_DATE), DATE_Y, SCALE_DATE, RED);
roundedRect(MX, RULE1_Y, RIGHT, RULE1_Y + 2, 0, INK);
drawText('WORLD NEWS', MX + (CW - textWidth('WORLD NEWS', SCALE_MAST)) / 2, MAST_Y, SCALE_MAST, INK);
// "NEWS" in red (offset = 6 glyphs into the string)
drawText('NEWS', MX + (CW - textWidth('WORLD NEWS', SCALE_MAST)) / 2 + 6 * 6 * SCALE_MAST, MAST_Y, SCALE_MAST, RED);
roundedRect(MX, REDRULE_Y, RIGHT, REDRULE_Y + 6, 0, RED);

// hero story
const hero = NEWS.stories[0];
const heroColor = hx(hero.color);
roundedRect(HERO_X, HERO_Y, HERO_X + HERO_W, HERO_Y + HERO_H, 14, heroColor);
{
  const hx0 = HERO_X + 24;
  const label = hero.region;
  const chipW = textWidth(label, SCALE_CHIP) + 20;
  roundedRect(hx0, HERO_Y + 16, hx0 + chipW, HERO_Y + 40, 5, WHITE);
  drawText(label, hx0 + 10, HERO_Y + 21, SCALE_CHIP, heroColor);
  drawText(hero.headline[0], hx0, HERO_Y + 46, SCALE_HERO, WHITE);
  drawText(hero.sub, hx0, HERO_Y + 94, SCALE_SUB, WHITE, 0.88);
  // paper-plane icon, white on red, with a fold notch + speed dashes
  const T = [958, 247], A = [856, 219], B = [856, 275];
  convexShape([T, A, B], 3, WHITE);
  convexShape([T, [886, 240], [886, 254]], 2, heroColor);
  roundedRect(818, 227, 842, 230, 1.5, WHITE, 0.8);
  roundedRect(806, 245, 838, 248, 1.5, WHITE, 0.8);
  roundedRect(818, 263, 842, 266, 1.5, WHITE, 0.8);
}

// six grid stories
for (let i = 0; i < 6; i++) {
  const st = NEWS.stories[1 + i];
  const col = hx(st.color);
  const [cx0, cy0] = cardXs[i];
  roundedRect(cx0, cy0, cx0 + CARD_W, cy0 + CARD_H, 12, col);
  const tx = cx0 + 22;
  const chipW = textWidth(st.region, SCALE_CHIP) + 20;
  roundedRect(tx, cy0 + 27, tx + chipW, cy0 + 51, 5, WHITE);
  drawText(st.region, tx + 10, cy0 + 32, SCALE_CHIP, col);
  drawText(st.headline[0], tx, cy0 + 59, SCALE_HEAD, WHITE);
  drawText(st.headline[1], tx, cy0 + 99, SCALE_HEAD, WHITE);
  drawText(st.sub, tx, cy0 + 141, SCALE_SUB, WHITE, 0.85);
}

// ticker
roundedRect(MX, TICKER_Y, RIGHT, TICKER_Y + TICKER_H, 10, INK);
for (let li = 0; li < NEWS.ticker.length; li++) {
  const [accent, body] = NEWS.ticker[li];
  const ty = TICKER_Y + 11 + li * 23;
  const endA = drawText(accent, MX + 24, ty, SCALE_TICK, CORAL);
  drawText(body, endA, ty, SCALE_TICK, WHITE);
}

// ------------------------------------------------------------------- render
const t0 = Date.now();
const img = Buffer.alloc(W * H * 3); // SDF pass result, then text overlaid
const out = { a: 0, r: 0, g: 0, b: 0 };
const bg = new Float64Array(3);
const bgRow = new Float64Array(W * 3);
const acc = new Float64Array(W * 3);
const nShapes = shapes.length;

for (let y = 0; y < H; y++) {
  const yc = (y + 0.5) / H;
  for (let x = 0; x < W; x++) {
    background((x + 0.5) / W, yc, bg);
    bgRow[x * 3] = bg[0]; bgRow[x * 3 + 1] = bg[1]; bgRow[x * 3 + 2] = bg[2];
  }
  acc.fill(0);
  for (let sy = 0; sy < SS; sy++) {
    const py = y + (sy + 0.5) / SS;
    for (let sx = 0; sx < SS; sx++) {
      for (let x = 0; x < W; x++) {
        const px = x + (sx + 0.5) / SS;
        let r = bgRow[x * 3], g = bgRow[x * 3 + 1], b = bgRow[x * 3 + 2];
        for (let i = 0; i < nShapes; i++) {
          const s = shapes[i];
          if (px < s.x0 || px > s.x1 || py < s.y0 || py > s.y1) continue;
          out.a = 0;
          s.f(px, py, out);
          const a = out.a;
          if (a > 0) {
            const ia = 1 - a;
            r = out.r * a + r * ia;
            g = out.g * a + g * ia;
            b = out.b * a + b * ia;
          }
        }
        acc[x * 3] += r; acc[x * 3 + 1] += g; acc[x * 3 + 2] += b;
      }
    }
  }
  // box downscale to bytes
  const rowOff = y * W * 3;
  for (let i = 0; i < W * 3; i++) {
    img[rowOff + i] = clamp(Math.round(acc[i] / (SS * SS)), 0, 255);
  }
}

// overlay the bitmap-font text (integer-aligned rects, deterministic order)
for (const rc of textRects) {
  const x0 = Math.max(0, Math.floor(rc.x0)), x1 = Math.min(W, Math.ceil(rc.x1));
  const y0 = Math.max(0, Math.floor(rc.y0)), y1 = Math.min(H, Math.ceil(rc.y1));
  for (let y = y0; y < y1; y++) {
    const rowOff = y * W * 3;
    for (let x = x0; x < x1; x++) {
      const o = rowOff + x * 3;
      if (rc.a >= 1) {
        img[o] = rc.r; img[o + 1] = rc.g; img[o + 2] = rc.b;
      } else {
        const ia = 1 - rc.a;
        img[o] = Math.round(rc.r * rc.a + img[o] * ia);
        img[o + 1] = Math.round(rc.g * rc.a + img[o + 1] * ia);
        img[o + 2] = Math.round(rc.b * rc.a + img[o + 2] * ia);
      }
    }
  }
}

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const o = Buffer.alloc(12 + data.length);
  o.writeUInt32BE(data.length, 0);
  o.write(type, 4, 'ascii');
  data.copy(o, 8);
  o.writeUInt32BE(crc32(o.subarray(4, 8 + data.length)), 8 + data.length);
  return o;
}

// Paeth-filtered scanlines (filter type 4)
const stride = 1 + W * 3;
const raw = Buffer.alloc(H * stride);
const prevBytes = Buffer.alloc(W * 3);
const curBytes = Buffer.alloc(W * 3);
for (let y = 0; y < H; y++) {
  const rowOff = y * W * 3;
  raw[y * stride] = 4;
  for (let i = 0; i < W * 3; i++) {
    curBytes[i] = img[rowOff + i];
    const a = i >= 3 ? curBytes[i - 3] : 0;
    const b = y > 0 ? prevBytes[i] : 0;
    const c = i >= 3 && y > 0 ? prevBytes[i - 3] : 0;
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    raw[y * stride + 1 + i] = (curBytes[i] - pred) & 255;
  }
  curBytes.copy(prevBytes);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // color type: truecolor RGB
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter method
ihdr[12] = 0; // interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const outPath = join(outDir, 'entry.png');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`wrote ${outPath}: ${png.length} bytes, ${W}x${H}, ${textRects.length} text rects, in ${Date.now() - t0} ms`);
