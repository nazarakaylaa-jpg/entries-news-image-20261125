// news-image-20261125 — "The World in One Day", Wednesday 25 November 2026.
// One 1024x1024 front-page image: 35 dated stories from 7 regions, rendered
// procedurally with a built-in 5x7 bitmap font. Node 22, stdlib only, no
// network, no clock, no randomness: two runs write byte-identical PNGs.
//
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

// ------------------------------------------------------------ PNG writer
// CRC-32 (IEEE) table, chunk builder, zlib deflate. RGB, 8-bit, no filtering.
const CRC_TAB: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32bytes(data: Buffer): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TAB[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(kind: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(payload.length, 0);
  head.write(kind, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32bytes(Buffer.concat([Buffer.from(kind, 'ascii'), payload])), 0);
  return Buffer.concat([head, payload, tail]);
}

function toPNG(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter type 0 = none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, rowStart + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    magic,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ 5x7 font
// Glyph rows as decimal numbers: 7 rows, 5 bits each, bit 4 = left column.
const GLYPH: Record<string, number[]> = {
  "A": [14, 17, 17, 31, 17, 17, 17],
  "B": [30, 17, 17, 30, 17, 17, 30],
  "C": [14, 17, 16, 16, 16, 17, 14],
  "D": [30, 17, 17, 17, 17, 17, 30],
  "E": [31, 16, 16, 30, 16, 16, 31],
  "F": [31, 16, 16, 30, 16, 16, 16],
  "G": [14, 17, 16, 23, 17, 17, 15],
  "H": [17, 17, 17, 31, 17, 17, 17],
  "I": [14, 4, 4, 4, 4, 4, 14],
  "J": [7, 2, 2, 2, 2, 18, 12],
  "K": [17, 18, 20, 24, 20, 18, 17],
  "L": [16, 16, 16, 16, 16, 16, 31],
  "M": [17, 27, 21, 21, 17, 17, 17],
  "N": [17, 25, 21, 19, 17, 17, 17],
  "O": [14, 17, 17, 17, 17, 17, 14],
  "P": [30, 17, 17, 30, 16, 16, 16],
  "Q": [14, 17, 17, 17, 21, 18, 13],
  "R": [30, 17, 17, 30, 20, 18, 17],
  "S": [15, 16, 16, 14, 1, 1, 30],
  "T": [31, 4, 4, 4, 4, 4, 4],
  "U": [17, 17, 17, 17, 17, 17, 14],
  "V": [17, 17, 17, 17, 17, 10, 4],
  "W": [17, 17, 17, 21, 21, 27, 17],
  "X": [17, 17, 10, 4, 10, 17, 17],
  "Y": [17, 17, 10, 4, 4, 4, 4],
  "Z": [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 2, 4, 0, 4],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "-": [0, 0, 0, 31, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "%": [25, 25, 2, 4, 8, 19, 19],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "$": [4, 15, 20, 14, 5, 30, 4],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  '"': [10, 10, 10, 0, 0, 0, 0],
  "·": [0, 0, 0, 12, 12, 0, 0],
};

// ------------------------------------------------------------ canvas
type Colour = [number, number, number];
const IMG_W = 1024;
const IMG_H = 1024;
const buf = new Uint8Array(IMG_W * IMG_H * 3);

const C = {
  paper: [246, 241, 231] as Colour,
  ink: [26, 26, 26] as Colour,
  navy: [20, 33, 61] as Colour,
  red: [178, 34, 34] as Colour,
  white: [255, 255, 255] as Colour,
  card: [255, 255, 255] as Colour,
  grey: [110, 105, 95] as Colour,
  line: [200, 192, 175] as Colour,
};

function dot(x: number, y: number, c: Colour): void {
  const xx = Math.round(x);
  const yy = Math.round(y);
  if (xx < 0 || yy < 0 || xx >= IMG_W || yy >= IMG_H) return;
  const i = (yy * IMG_W + xx) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function box(x: number, y: number, w: number, h: number, c: Colour): void {
  const x0 = Math.max(0, x);
  const x1 = Math.min(IMG_W, x + w);
  const y0 = Math.max(0, y);
  const y1 = Math.min(IMG_H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) dot(xx, yy, c);
  }
}

function frame(x: number, y: number, w: number, h: number, c: Colour): void {
  box(x, y, w, 1, c);
  box(x, y + h - 1, w, 1, c);
  box(x, y, 1, h, c);
  box(x + w - 1, y, 1, h, c);
}

function disc(cx: number, cy: number, r: number, c: Colour): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) dot(x, y, c);
    }
  }
}

function seg(x0: number, y0: number, x1: number, y1: number, c: Colour, th = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (dx * i) / n);
    const y = Math.round(y0 + (dy * i) / n);
    for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) dot(x + a, y + b, c);
  }
}

// Scanline fill of a simple polygon given in order.
function poly(points: Array<[number, number]>, c: Colour): void {
  let top = IMG_H;
  let bottom = 0;
  for (const p of points) {
    top = Math.min(top, p[1]);
    bottom = Math.max(bottom, p[1]);
  }
  for (let y = top; y <= bottom; y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(Math.round(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) dot(x, y, c);
    }
  }
}

function tw(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function put(x: number, y: number, s: string, scale: number, c: Colour): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPH[ch] ?? GLYPH['?'];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if ((g[r] & (1 << (4 - col))) !== 0) box(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function wrap(s: string, maxW: number, scale: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    const t = cur === '' ? w : cur + ' ' + w;
    if (tw(t, scale) <= maxW) {
      cur = t;
    } else {
      if (cur !== '') out.push(cur);
      cur = w;
    }
  }
  if (cur !== '') out.push(cur);
  return out;
}

function para(
  x: number,
  y: number,
  s: string,
  scale: number,
  c: Colour,
  maxW: number,
  maxLines: number,
  lh: number,
): number {
  const lines = wrap(s, maxW, scale).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) put(x, y + i * lh, lines[i], scale, c);
  return lines.length;
}

// ------------------------------------------------------------ icons
// Each mark paints inside the (x, y, s, s) square it is given.
function mark(x: number, y: number, s: number, kind: string): void {
  const k = s / 48; // unit
  const mx = x + s / 2;
  const my = y + s / 2;
  switch (kind) {
    case 'flame': {
      poly(
        [
          [mx, y + 4 * k],
          [mx + 15 * k, y + 24 * k],
          [mx + 10 * k, y + 24 * k],
          [mx + 16 * k, y + 38 * k],
          [mx - 16 * k, y + 38 * k],
          [mx - 10 * k, y + 24 * k],
          [mx - 15 * k, y + 24 * k],
        ],
        [230, 92, 0],
      );
      poly(
        [
          [mx, y + 20 * k],
          [mx + 8 * k, y + 32 * k],
          [mx + 5 * k, y + 38 * k],
          [mx - 5 * k, y + 38 * k],
          [mx - 8 * k, y + 32 * k],
        ],
        [255, 196, 0],
      );
      break;
    }
    case 'chart': {
      box(x + 6 * k, y + 26 * k, 7 * k, 14 * k, [39, 174, 96]);
      box(x + 17 * k, y + 18 * k, 7 * k, 22 * k, [39, 174, 96]);
      box(x + 28 * k, y + 8 * k, 7 * k, 32 * k, [39, 174, 96]);
      seg(x + 4 * k, y + 8 * k, x + 42 * k, y + 42 * k, [26, 26, 26], 2);
      poly(
        [[x + 34 * k, y + 4 * k], [x + 44 * k, y + 8 * k], [x + 36 * k, y + 14 * k]],
        [26, 26, 26],
      );
      break;
    }
    case 'missile': {
      poly(
        [
          [mx, y + 4 * k],
          [mx + 7 * k, y + 16 * k],
          [mx + 7 * k, y + 34 * k],
          [mx - 7 * k, y + 34 * k],
          [mx - 7 * k, y + 16 * k],
        ],
        [120, 120, 125],
      );
      poly(
        [
          [mx - 7 * k, y + 30 * k],
          [mx - 14 * k, y + 40 * k],
          [mx - 7 * k, y + 38 * k],
        ],
        [90, 90, 95],
      );
      poly(
        [
          [mx + 7 * k, y + 30 * k],
          [mx + 14 * k, y + 40 * k],
          [mx + 7 * k, y + 38 * k],
        ],
        [90, 90, 95],
      );
      poly(
        [
          [mx - 5 * k, y + 38 * k],
          [mx + 5 * k, y + 38 * k],
          [mx, y + 46 * k],
        ],
        [255, 140, 0],
      );
      break;
    }
    case 'ballot': {
      box(x + 8 * k, y + 10 * k, 32 * k, 28 * k, [255, 255, 255]);
      frame(x + 8 * k, y + 10 * k, 32 * k, 28 * k, C.ink);
      seg(x + 14 * k, y + 26 * k, x + 20 * k, y + 32 * k, [39, 174, 96], 3);
      seg(x + 20 * k, y + 32 * k, x + 34 * k, y + 16 * k, [39, 174, 96], 3);
      break;
    }
    case 'court': {
      box(x + 6 * k, y + 38 * k, 36 * k, 4 * k, [150, 110, 60]);
      box(x + 20 * k, y + 12 * k, 8 * k, 26 * k, [150, 110, 60]);
      box(x + 8 * k, y + 8 * k, 32 * k, 5 * k, [150, 110, 60]);
      disc(x + 12 * k, y + 18 * k, 6 * k, [200, 150, 60]);
      disc(x + 36 * k, y + 18 * k, 6 * k, [200, 150, 60]);
      break;
    }
    case 'plane': {
      poly(
        [
          [x + 4 * k, my],
          [x + 30 * k, my - 8 * k],
          [x + 44 * k, my - 6 * k],
          [x + 30 * k, my + 2 * k],
          [x + 14 * k, my + 4 * k],
          [x + 10 * k, my + 10 * k],
          [x + 6 * k, my + 4 * k],
        ],
        [70, 110, 170],
      );
      break;
    }
    case 'ship': {
      poly(
        [
          [x + 6 * k, y + 28 * k],
          [x + 42 * k, y + 28 * k],
          [x + 36 * k, y + 40 * k],
          [x + 12 * k, y + 40 * k],
        ],
        [90, 90, 95],
      );
      seg(mx, y + 6 * k, mx, y + 28 * k, C.ink, 2);
      poly(
        [
          [mx, y + 8 * k],
          [mx + 14 * k, y + 18 * k],
          [mx, y + 26 * k],
        ],
        [178, 34, 34],
      );
      seg(x + 2 * k, y + 44 * k, x + 46 * k, y + 44 * k, [46, 134, 193], 2);
      break;
    }
    case 'chess': {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          box(x + 6 * k + c * 9 * k, y + 6 * k + r * 9 * k, 9 * k, 9 * k, (r + c) % 2 ? C.ink : C.white);
        }
      }
      frame(x + 6 * k, y + 6 * k, 36 * k, 36 * k, C.ink);
      disc(mx, my, 8 * k, [178, 34, 34]);
      break;
    }
    case 'flag': {
      seg(x + 10 * k, y + 6 * k, x + 10 * k, y + 42 * k, C.ink, 2);
      box(x + 12 * k, y + 8 * k, 28 * k, 18 * k, [46, 134, 193]);
      box(x + 12 * k, y + 8 * k, 28 * k, 6 * k, [178, 34, 34]);
      box(x + 12 * k, y + 20 * k, 28 * k, 6 * k, C.white);
      break;
    }
    case 'shield': {
      poly(
        [
          [mx, y + 4 * k],
          [mx + 15 * k, y + 10 * k],
          [mx + 15 * k, y + 24 * k],
          [mx, y + 42 * k],
          [mx - 15 * k, y + 24 * k],
          [mx - 15 * k, y + 10 * k],
        ],
        [46, 134, 193],
      );
      seg(mx - 6 * k, my + 2 * k, mx - 1 * k, my + 7 * k, C.white, 3);
      seg(mx - 1 * k, my + 7 * k, mx + 8 * k, my - 6 * k, C.white, 3);
      break;
    }
    case 'warn': {
      poly([[mx, y + 4 * k], [mx + 19 * k, y + 40 * k], [mx - 19 * k, y + 40 * k]], [255, 196, 0]);
      box(mx - 2 * k, y + 16 * k, 4 * k, 14 * k, C.ink);
      box(mx - 2 * k, y + 33 * k, 4 * k, 4 * k, C.ink);
      break;
    }
    case 'cross': {
      box(mx - 5 * k, y + 8 * k, 10 * k, 32 * k, [220, 60, 60]);
      box(mx - 14 * k, y + 17 * k, 28 * k, 10 * k, [220, 60, 60]);
      break;
    }
    case 'trophy': {
      poly(
        [
          [mx - 10 * k, y + 6 * k],
          [mx + 10 * k, y + 6 * k],
          [mx + 8 * k, y + 22 * k],
          [mx - 8 * k, y + 22 * k],
        ],
        [212, 175, 55],
      );
      box(mx - 2 * k, y + 22 * k, 4 * k, 10 * k, [212, 175, 55]);
      box(mx - 10 * k, y + 32 * k, 20 * k, 5 * k, [212, 175, 55]);
      disc(mx - 13 * k, y + 12 * k, 5 * k, [212, 175, 55]);
      disc(mx + 13 * k, y + 12 * k, 5 * k, [212, 175, 55]);
      break;
    }
    case 'planet': {
      disc(mx, my, 15 * k, [210, 120, 60]);
      seg(x + 2 * k, my + 8 * k, x + 46 * k, my - 8 * k, [150, 110, 60], 3);
      disc(mx - 5 * k, my - 5 * k, 3 * k, [240, 180, 120]);
      break;
    }
    case 'chip': {
      box(mx - 12 * k, my - 12 * k, 24 * k, 24 * k, [40, 60, 90]);
      frame(mx - 12 * k, my - 12 * k, 24 * k, 24 * k, C.ink);
      box(mx - 6 * k, my - 6 * k, 12 * k, 12 * k, [120, 200, 255]);
      for (let i = 0; i < 3; i++) {
        seg(mx - 8 * k + i * 8 * k, y + 4 * k, mx - 8 * k + i * 8 * k, y + 12 * k, C.ink, 2);
        seg(mx - 8 * k + i * 8 * k, y + 36 * k, mx - 8 * k + i * 8 * k, y + 44 * k, C.ink, 2);
      }
      break;
    }
    case 'book': {
      box(x + 8 * k, y + 8 * k, 32 * k, 32 * k, [178, 34, 34]);
      box(x + 12 * k, y + 12 * k, 24 * k, 24 * k, C.white);
      seg(x + 16 * k, y + 18 * k, x + 32 * k, y + 18 * k, C.ink, 2);
      seg(x + 16 * k, y + 25 * k, x + 32 * k, y + 25 * k, C.ink, 2);
      seg(x + 16 * k, y + 32 * k, x + 28 * k, y + 32 * k, C.ink, 2);
      break;
    }
    case 'people': {
      disc(mx - 9 * k, my - 8 * k, 7 * k, [46, 134, 193]);
      disc(mx + 9 * k, my - 8 * k, 7 * k, [178, 34, 34]);
      poly(
        [
          [mx - 18 * k, y + 40 * k],
          [mx - 18 * k, y + 26 * k],
          [mx, y + 26 * k],
          [mx, y + 40 * k],
        ],
        [46, 134, 193],
      );
      poly(
        [
          [mx, y + 40 * k],
          [mx, y + 26 * k],
          [mx + 18 * k, y + 26 * k],
          [mx + 18 * k, y + 40 * k],
        ],
        [178, 34, 34],
      );
      break;
    }
    default: {
      disc(mx, my, 16 * k, [46, 134, 193]);
      put(mx - 6 * k, my - 7 * k, '!', 2, C.white);
    }
  }
}

// ------------------------------------------------------------ stories
// Every one of these 35 stories happened, or was first reported, on
// Wednesday 25 November 2026. Sources: BBC, Reuters, AP, The Guardian,
// The Hindu, Arab News, SciTechDaily.
interface Story {
  region: string;
  colour: Colour;
  icon: string;
  headline: string;
}

const REGIONS: Record<string, { label: string; colour: Colour }> = {
  NA: { label: 'NORTH AMERICA', colour: [30, 90, 160] },
  EU: { label: 'EUROPE', colour: [90, 60, 140] },
  ME: { label: 'MIDDLE EAST', colour: [150, 60, 40] },
  AP: { label: 'ASIA-PACIFIC', colour: [20, 120, 90] },
  AF: { label: 'AFRICA', colour: [170, 110, 20] },
  SP: { label: 'SPORT', colour: [180, 40, 90] },
  SC: { label: 'SCIENCE & SPACE', colour: [60, 60, 110] },
};

const LEADS: Story[] = [
  {
    region: 'NA',
    colour: REGIONS.NA.colour,
    icon: 'chart',
    headline: 'US TO UNVEIL NEW TARIFFS ON GLOBAL PARTNERS - CHINA AND EU IN SIGHT',
  },
  {
    region: 'AP',
    colour: REGIONS.AP.colour,
    icon: 'planet',
    headline: 'CHINA LAUNCHES SPACE MISSION WITH PAKISTANI ASTRONAUT - HISTORIC FIRST',
  },
  {
    region: 'EU',
    colour: REGIONS.EU.colour,
    icon: 'shield',
    headline: 'NATO CHIEF VOWS DEFENCE AGAINST SPACE THREAT AFTER RUSSIAN SATELLITE REPORTS',
  },
];

const GRID: Story[] = [
  { region: 'NA', colour: REGIONS.NA.colour, icon: 'flag', headline: 'TRUMP PARDONS TURKEYS FREEDOM AND FEATHERS' },
  { region: 'NA', colour: REGIONS.NA.colour, icon: 'court', headline: 'US AG DODGES NVIDIA PROBE QUESTIONS - SHARES DOWN 7%' },
  { region: 'NA', colour: REGIONS.NA.colour, icon: 'court', headline: 'THOMAS MARKLE INDICTED BY US GRAND JURY' },
  { region: 'NA', colour: REGIONS.NA.colour, icon: 'warn', headline: 'US ARMY TO DETONATE TOXIC EXPLOSIVES IN IOWA' },
  { region: 'NA', colour: REGIONS.NA.colour, icon: 'ballot', headline: 'CALIFORNIA DEMOCRAT QUITS CONGRESS' },
  { region: 'NA', colour: REGIONS.NA.colour, icon: 'chart', headline: 'DELL LIFTS FORECASTS ON RECORD AI SERVER DEMAND' },
  { region: 'NA', colour: REGIONS.NA.colour, icon: 'people', headline: 'MELANIA TRUMP WELCOMES WHITE HOUSE CHRISTMAS TREE' },
  { region: 'EU', colour: REGIONS.EU.colour, icon: 'shield', headline: 'TWO ARRESTED OVER BURGLARY AT ROYAL NORFOLK HOME' },
  { region: 'EU', colour: REGIONS.EU.colour, icon: 'warn', headline: 'UK FIRMS TOLD TO ACT ON SABOTAGE RISK' },
  { region: 'EU', colour: REGIONS.EU.colour, icon: 'book', headline: 'POPE FRANCIS DIARY: HE SAW THE DEVIL THREE TIMES' },
  { region: 'EU', colour: REGIONS.EU.colour, icon: 'people', headline: 'STYLES AND EILISH HEADLINE GLASTONBURY' },
  { region: 'EU', colour: REGIONS.EU.colour, icon: 'flag', headline: "RUSSIA'S OWN FIGURES SHOW NEARLY 500,000 WAR DEAD" },
  { region: 'EU', colour: REGIONS.EU.colour, icon: 'plane', headline: 'NATO TO DEPLOY EARLY WARNING AIRCRAFT IN POLAND' },
  { region: 'EU', colour: REGIONS.EU.colour, icon: 'flag', headline: '700,000 RUSSIAN SOLDIERS KILLED' },
  { region: 'ME', colour: REGIONS.ME.colour, icon: 'flame', headline: 'ISRAELI STRIKE KILLS HAMAS SECURITY CHIEF IN GAZA' },
  { region: 'ME', colour: REGIONS.ME.colour, icon: 'warn', headline: 'LAND MINE CASUALTIES SOAR IN SYRIA' },
  { region: 'ME', colour: REGIONS.ME.colour, icon: 'missile', headline: 'SAUDI STRIKES IN SOUTH-WEST YEMEN KILL SEVERAL' },
  { region: 'ME', colour: REGIONS.ME.colour, icon: 'ship', headline: 'THREE OIL TANKERS HIT BY MINES IN HORMUZ' },
  { region: 'ME', colour: REGIONS.ME.colour, icon: 'flame', headline: 'IRAN BRACES FOR WINTER GAS SHORTAGES' },
  { region: 'ME', colour: REGIONS.ME.colour, icon: 'people', headline: 'US AND QATAR DISCUSS STRATEGIC COOPERATION' },
  { region: 'AP', colour: REGIONS.AP.colour, icon: 'people', headline: "MODI HOLDS TALKS WITH GERMANY'S MERZ" },
  { region: 'AP', colour: REGIONS.AP.colour, icon: 'ballot', headline: 'BJP AND AKALI DAL ALLY FOR PUNJAB 2027' },
  { region: 'AP', colour: REGIONS.AP.colour, icon: 'warn', headline: 'NEPAL QUAKE 5.6 HITS KOSHI PROVINCE NEAR CHINA BORDER' },
  { region: 'AP', colour: REGIONS.AP.colour, icon: 'chip', headline: 'AI FAKES SMEAR TAIWAN ELECTION CANDIDATES' },
  { region: 'AP', colour: REGIONS.AP.colour, icon: 'people', headline: 'NORTH KOREANS JAILED FOR BEING CHRISTIAN' },
  { region: 'AF', colour: REGIONS.AF.colour, icon: 'cross', headline: 'WHO EVACUATES STAFF FROM DR CONGO HOSPITAL AMID FIGHTING' },
  { region: 'AF', colour: REGIONS.AF.colour, icon: 'plane', headline: 'DR CONGO PLANE MISSING AS REBELS CLAIM SHOOT-DOWN' },
  { region: 'AF', colour: REGIONS.AF.colour, icon: 'court', headline: 'NIGERIAN MONARCH, 92, SUSPENDED' },
  { region: 'SP', colour: REGIONS.SP.colour, icon: 'trophy', headline: 'SOORYAVANSHI, 15, SMASHES FASTEST LIST A 200' },
  { region: 'SP', colour: REGIONS.SP.colour, icon: 'chess', headline: 'GUKESH HOLDS SINDAROV IN WORLD CHESS TITLE FIGHT' },
  { region: 'SP', colour: REGIONS.SP.colour, icon: 'trophy', headline: 'SENEGAL REINSTATED AS AFCON WINNERS' },
  { region: 'SC', colour: REGIONS.SC.colour, icon: 'planet', headline: 'STAR SYSTEM FOUND THAT SHOULD NOT EXIST' },
];

// ------------------------------------------------------------ layout
interface CardOpts {
  bar: number;
  lx: number;
  rx: number;
  icon: number;
  tx: number;
  tw: number;
  lines: number;
  lh: number;
  pad: number;
}

function card(x: number, y: number, w: number, h: number, s: Story, o: CardOpts): void {
  box(x, y, w, h, C.card);
  frame(x, y, w, h, C.line);
  box(x, y, w, o.bar, s.colour);
  put(x + o.lx, y + 12, REGIONS[s.region].label, 1, s.colour);
  const d = '25 NOV';
  put(x + w - o.rx - tw(d, 1), y + 12, d, 1, C.grey);
  mark(x + 12, y + o.pad, o.icon, s.icon);
  para(x + o.tx, y + o.pad, s.headline, 2, C.ink, o.tw, o.lines, o.lh);
}

box(0, 0, IMG_W, IMG_H, C.paper);

// Masthead
box(0, 0, IMG_W, 12, C.navy);
box(12, 12, IMG_W - 24, 92, C.navy);
put(26, 26, 'THE WORLD IN ONE DAY', 4, C.white);
put(26, 68, 'WEDNESDAY 25 NOVEMBER 2026', 2, [255, 214, 130]);
put(26, 88, '35 DATED STORIES - 7 REGIONS - ONE FRONT PAGE', 1, [200, 205, 220]);
const rb = '25 NOV 2026';
put(IMG_W - 26 - tw(rb, 3), 30, rb, 3, C.white);
put(IMG_W - 26 - tw('THE DAY IN WORLD NEWS', 1), 62, 'THE DAY IN WORLD NEWS', 1, [200, 205, 220]);
put(IMG_W - 26 - tw('MAKE.FUN NEWS-IMAGE-20261125', 1), 80, 'MAKE.FUN NEWS-IMAGE-20261125', 1, [200, 205, 220]);
box(12, 108, IMG_W - 24, 4, C.red);

// Lead row: 3 big cards
const LEAD_Y = 120;
const LEAD_H = 122;
const LEAD_W = 325;
for (let i = 0; i < LEADS.length; i++) {
  const x = 12 + i * (LEAD_W + 10);
  card(x, LEAD_Y, LEAD_W, LEAD_H, LEADS[i], {
    bar: 5, lx: 10, rx: 10, icon: 56, tx: 80, tw: LEAD_W - 92, lines: 5, lh: 17, pad: 34,
  });
}

// Grid: 4 columns x 8 rows = 32 cards
const GRID_Y = 252;
const CELL_W = 241;
const CELL_H = 86;
for (let i = 0; i < GRID.length; i++) {
  const x = 12 + (i % 4) * (CELL_W + 10);
  const y = GRID_Y + Math.floor(i / 4) * (CELL_H + 8);
  card(x, y, CELL_W, CELL_H, GRID[i], {
    bar: 4, lx: 8, rx: 8, icon: 40, tx: 56, tw: CELL_W - 64, lines: 4, lh: 15, pad: 30,
  });
}

// Footer
const foot = 'ALL STORIES HAPPENED OR WERE FIRST REPORTED ON WEDNESDAY 25 NOVEMBER 2026 - SOURCES: BBC - REUTERS - AP - GUARDIAN - THE HINDU';
put(12 + Math.floor((IMG_W - 24 - tw(foot, 1)) / 2), 1002, foot, 1, C.grey);

// ------------------------------------------------------------ write
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'entry.png'), toPNG(IMG_W, IMG_H, buf));
