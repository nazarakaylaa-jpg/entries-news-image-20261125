// news-image-20261125: "The World in One Day" — Wednesday 25 November 2026.
// A front-page newspaper image: 35 dated stories, 7 regions, drawn programmatically
// with a built-in 5x7 bitmap font. Node 22, standard library only, no network,
// deterministic (two runs write byte-identical PNG).
//
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (1 + w * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ 5x7 font
// Each glyph: 7 rows, 5 bits (bit 4 = leftmost column). Uppercase + digits only.
const FONT: Record<string, number[]> = {
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
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '-': [0, 0, 0, 0x1f, 0, 0, 0],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  '%': [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  '·': [0, 0, 0, 0x0c, 0x0c, 0, 0],
};

// -------------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [246, 241, 231];
const INK: RGB = [26, 26, 26];
const NAVY: RGB = [20, 33, 61];
const RED: RGB = [178, 34, 34];
const WHITE: RGB = [255, 255, 255];
const CARD: RGB = [255, 255, 255];
const GREY: RGB = [110, 105, 95];
const LINE: RGB = [200, 192, 175];

function setPx(x: number, y: number, c: RGB): void {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) setPx(xx, yy, c);
  }
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  fillRect(x, y, w, 1, c);
  fillRect(x, y + h - 1, w, 1, c);
  fillRect(x, y, 1, h, c);
  fillRect(x + w - 1, y, 1, h, c);
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPx(x, y, c);
    }
  }
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB, th = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) setPx(x + a, y + b, c);
  }
}

// Scanline fill of a simple polygon (points in order).
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  let minY = H;
  let maxY = 0;
  for (const [, y] of pts) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) setPx(x, y, c);
    }
  }
}

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT['?'];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row & (1 << (4 - col))) fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function wrapText(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawTextBlock(
  x: number,
  y: number,
  s: string,
  scale: number,
  c: RGB,
  maxWidth: number,
  maxLines: number,
  lineH: number,
): number {
  const lines = wrapText(s, maxWidth, scale).slice(0, maxLines);
  lines.forEach((ln, i) => drawText(x, y + i * lineH, ln, scale, c));
  return lines.length;
}

// -------------------------------------------------------------------- icons
// Each icon paints inside a (x, y, s, s) box.
function icon(x: number, y: number, s: number, kind: string): void {
  const u = s / 48; // unit
  const cx = x + s / 2;
  const cy = y + s / 2;
  switch (kind) {
    case 'flame': {
      fillPoly(
        [
          [cx, y + 4 * u],
          [cx + 15 * u, y + 24 * u],
          [cx + 10 * u, y + 24 * u],
          [cx + 16 * u, y + 38 * u],
          [cx - 16 * u, y + 38 * u],
          [cx - 10 * u, y + 24 * u],
          [cx - 15 * u, y + 24 * u],
        ],
        [230, 92, 0],
      );
      fillPoly(
        [
          [cx, y + 20 * u],
          [cx + 8 * u, y + 32 * u],
          [cx + 5 * u, y + 38 * u],
          [cx - 5 * u, y + 38 * u],
          [cx - 8 * u, y + 32 * u],
        ],
        [255, 196, 0],
      );
      break;
    }
    case 'chart': {
      fillRect(x + 6 * u, y + 26 * u, 7 * u, 14 * u, [39, 174, 96]);
      fillRect(x + 17 * u, y + 18 * u, 7 * u, 22 * u, [39, 174, 96]);
      fillRect(x + 28 * u, y + 8 * u, 7 * u, 32 * u, [39, 174, 96]);
      drawLine(x + 4 * u, y + 8 * u, x + 42 * u, y + 42 * u, [26, 26, 26], 2);
      fillPoly(
        [[x + 34 * u, y + 4 * u], [x + 44 * u, y + 8 * u], [x + 36 * u, y + 14 * u]],
        [26, 26, 26],
      );
      break;
    }
    case 'missile': {
      fillPoly(
        [
          [cx, y + 4 * u],
          [cx + 7 * u, y + 16 * u],
          [cx + 7 * u, y + 34 * u],
          [cx - 7 * u, y + 34 * u],
          [cx - 7 * u, y + 16 * u],
        ],
        [120, 120, 125],
      );
      fillPoly(
        [
          [cx - 7 * u, y + 30 * u],
          [cx - 14 * u, y + 40 * u],
          [cx - 7 * u, y + 38 * u],
        ],
        [90, 90, 95],
      );
      fillPoly(
        [
          [cx + 7 * u, y + 30 * u],
          [cx + 14 * u, y + 40 * u],
          [cx + 7 * u, y + 38 * u],
        ],
        [90, 90, 95],
      );
      fillPoly(
        [
          [cx - 5 * u, y + 38 * u],
          [cx + 5 * u, y + 38 * u],
          [cx, y + 46 * u],
        ],
        [255, 140, 0],
      );
      break;
    }
    case 'ballot': {
      fillRect(x + 8 * u, y + 10 * u, 32 * u, 28 * u, [255, 255, 255]);
      rect(x + 8 * u, y + 10 * u, 32 * u, 28 * u, INK);
      drawLine(x + 14 * u, y + 26 * u, x + 20 * u, y + 32 * u, [39, 174, 96], 3);
      drawLine(x + 20 * u, y + 32 * u, x + 34 * u, y + 16 * u, [39, 174, 96], 3);
      break;
    }
    case 'court': {
      fillRect(x + 6 * u, y + 38 * u, 36 * u, 4 * u, [150, 110, 60]);
      fillRect(x + 20 * u, y + 12 * u, 8 * u, 26 * u, [150, 110, 60]);
      fillRect(x + 8 * u, y + 8 * u, 32 * u, 5 * u, [150, 110, 60]);
      fillCircle(x + 12 * u, y + 18 * u, 6 * u, [200, 150, 60]);
      fillCircle(x + 36 * u, y + 18 * u, 6 * u, [200, 150, 60]);
      break;
    }
    case 'plane': {
      fillPoly(
        [
          [x + 4 * u, cy],
          [x + 30 * u, cy - 8 * u],
          [x + 44 * u, cy - 6 * u],
          [x + 30 * u, cy + 2 * u],
          [x + 14 * u, cy + 4 * u],
          [x + 10 * u, cy + 10 * u],
          [x + 6 * u, cy + 4 * u],
        ],
        [70, 110, 170],
      );
      break;
    }
    case 'ship': {
      fillPoly(
        [
          [x + 6 * u, y + 28 * u],
          [x + 42 * u, y + 28 * u],
          [x + 36 * u, y + 40 * u],
          [x + 12 * u, y + 40 * u],
        ],
        [90, 90, 95],
      );
      drawLine(cx, y + 6 * u, cx, y + 28 * u, INK, 2);
      fillPoly(
        [
          [cx, y + 8 * u],
          [cx + 14 * u, y + 18 * u],
          [cx, y + 26 * u],
        ],
        [178, 34, 34],
      );
      drawLine(x + 2 * u, y + 44 * u, x + 46 * u, y + 44 * u, [46, 134, 193], 2);
      break;
    }
    case 'chess': {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          fillRect(x + 6 * u + c * 9 * u, y + 6 * u + r * 9 * u, 9 * u, 9 * u, (r + c) % 2 ? INK : WHITE);
        }
      }
      rect(x + 6 * u, y + 6 * u, 36 * u, 36 * u, INK);
      fillCircle(cx, cy, 8 * u, [178, 34, 34]);
      break;
    }
    case 'flag': {
      drawLine(x + 10 * u, y + 6 * u, x + 10 * u, y + 42 * u, INK, 2);
      fillRect(x + 12 * u, y + 8 * u, 28 * u, 18 * u, [46, 134, 193]);
      fillRect(x + 12 * u, y + 8 * u, 28 * u, 6 * u, [178, 34, 34]);
      fillRect(x + 12 * u, y + 20 * u, 28 * u, 6 * u, WHITE);
      break;
    }
    case 'shield': {
      fillPoly(
        [
          [cx, y + 4 * u],
          [cx + 15 * u, y + 10 * u],
          [cx + 15 * u, y + 24 * u],
          [cx, y + 42 * u],
          [cx - 15 * u, y + 24 * u],
          [cx - 15 * u, y + 10 * u],
        ],
        [46, 134, 193],
      );
      drawLine(cx - 6 * u, cy + 2 * u, cx - 1 * u, cy + 7 * u, WHITE, 3);
      drawLine(cx - 1 * u, cy + 7 * u, cx + 8 * u, cy - 6 * u, WHITE, 3);
      break;
    }
    case 'warn': {
      fillPoly([[cx, y + 4 * u], [cx + 19 * u, y + 40 * u], [cx - 19 * u, y + 40 * u]], [255, 196, 0]);
      fillRect(cx - 2 * u, y + 16 * u, 4 * u, 14 * u, INK);
      fillRect(cx - 2 * u, y + 33 * u, 4 * u, 4 * u, INK);
      break;
    }
    case 'cross': {
      fillRect(cx - 5 * u, y + 8 * u, 10 * u, 32 * u, [220, 60, 60]);
      fillRect(cx - 14 * u, y + 17 * u, 28 * u, 10 * u, [220, 60, 60]);
      break;
    }
    case 'trophy': {
      fillPoly(
        [
          [cx - 10 * u, y + 6 * u],
          [cx + 10 * u, y + 6 * u],
          [cx + 8 * u, y + 22 * u],
          [cx - 8 * u, y + 22 * u],
        ],
        [212, 175, 55],
      );
      fillRect(cx - 2 * u, y + 22 * u, 4 * u, 10 * u, [212, 175, 55]);
      fillRect(cx - 10 * u, y + 32 * u, 20 * u, 5 * u, [212, 175, 55]);
      fillCircle(cx - 13 * u, y + 12 * u, 5 * u, [212, 175, 55]);
      fillCircle(cx + 13 * u, y + 12 * u, 5 * u, [212, 175, 55]);
      break;
    }
    case 'planet': {
      fillCircle(cx, cy, 15 * u, [210, 120, 60]);
      drawLine(x + 2 * u, cy + 8 * u, x + 46 * u, cy - 8 * u, [150, 110, 60], 3);
      fillCircle(cx - 5 * u, cy - 5 * u, 3 * u, [240, 180, 120]);
      break;
    }
    case 'chip': {
      fillRect(cx - 12 * u, cy - 12 * u, 24 * u, 24 * u, [40, 60, 90]);
      rect(cx - 12 * u, cy - 12 * u, 24 * u, 24 * u, INK);
      fillRect(cx - 6 * u, cy - 6 * u, 12 * u, 12 * u, [120, 200, 255]);
      for (let i = 0; i < 3; i++) {
        drawLine(cx - 8 * u + i * 8 * u, y + 4 * u, cx - 8 * u + i * 8 * u, y + 12 * u, INK, 2);
        drawLine(cx - 8 * u + i * 8 * u, y + 36 * u, cx - 8 * u + i * 8 * u, y + 44 * u, INK, 2);
      }
      break;
    }
    case 'book': {
      fillRect(x + 8 * u, y + 8 * u, 32 * u, 32 * u, [178, 34, 34]);
      fillRect(x + 12 * u, y + 12 * u, 24 * u, 24 * u, WHITE);
      drawLine(x + 16 * u, y + 18 * u, x + 32 * u, y + 18 * u, INK, 2);
      drawLine(x + 16 * u, y + 25 * u, x + 32 * u, y + 25 * u, INK, 2);
      drawLine(x + 16 * u, y + 32 * u, x + 28 * u, y + 32 * u, INK, 2);
      break;
    }
    case 'people': {
      fillCircle(cx - 9 * u, cy - 8 * u, 7 * u, [46, 134, 193]);
      fillCircle(cx + 9 * u, cy - 8 * u, 7 * u, [178, 34, 34]);
      fillPoly(
        [
          [cx - 18 * u, y + 40 * u],
          [cx - 18 * u, y + 26 * u],
          [cx, y + 26 * u],
          [cx, y + 40 * u],
        ],
        [46, 134, 193],
      );
      fillPoly(
        [
          [cx, y + 40 * u],
          [cx, y + 26 * u],
          [cx + 18 * u, y + 26 * u],
          [cx + 18 * u, y + 40 * u],
        ],
        [178, 34, 34],
      );
      break;
    }
    default: {
      fillCircle(cx, cy, 16 * u, [46, 134, 193]);
      drawText(cx - 6 * u, cy - 7 * u, '!', 2, WHITE);
    }
  }
}

// ------------------------------------------------------------------ stories
// All 35 stories happened, or were first reported, on Wednesday 25 November 2026.
// Sources: BBC, Reuters, AP, The Guardian, The Hindu, Arab News, SciTechDaily.
interface Story {
  region: string;
  color: RGB;
  icon: string;
  headline: string;
}

const REGIONS = {
  NA: { name: 'NORTH AMERICA', color: [30, 90, 160] as RGB },
  EU: { name: 'EUROPE', color: [90, 60, 140] as RGB },
  ME: { name: 'MIDDLE EAST', color: [150, 60, 40] as RGB },
  AP: { name: 'ASIA-PACIFIC', color: [20, 120, 90] as RGB },
  AF: { name: 'AFRICA', color: [170, 110, 20] as RGB },
  SP: { name: 'SPORT', color: [180, 40, 90] as RGB },
  SC: { name: 'SCIENCE & SPACE', color: [60, 60, 110] as RGB },
};

const LEADS: Story[] = [
  {
    region: 'NA',
    color: REGIONS.NA.color,
    icon: 'chart',
    headline: 'US TO UNVEIL NEW TARIFFS ON GLOBAL PARTNERS - CHINA AND EU IN SIGHT',
  },
  {
    region: 'AP',
    color: REGIONS.AP.color,
    icon: 'planet',
    headline: 'CHINA LAUNCHES SPACE MISSION WITH PAKISTANI ASTRONAUT - HISTORIC FIRST',
  },
  {
    region: 'EU',
    color: REGIONS.EU.color,
    icon: 'shield',
    headline: 'NATO CHIEF VOWS DEFENCE AGAINST SPACE THREAT AFTER RUSSIAN SATELLITE REPORTS',
  },
];

const GRID: Story[] = [
  { region: 'NA', color: REGIONS.NA.color, icon: 'flag', headline: 'TRUMP PARDONS TURKEYS FREEDOM AND FEATHERS' },
  { region: 'NA', color: REGIONS.NA.color, icon: 'court', headline: 'US AG DODGES NVIDIA PROBE QUESTIONS - SHARES DOWN 7%' },
  { region: 'NA', color: REGIONS.NA.color, icon: 'court', headline: 'THOMAS MARKLE INDICTED BY US GRAND JURY' },
  { region: 'NA', color: REGIONS.NA.color, icon: 'warn', headline: 'US ARMY TO DETONATE TOXIC EXPLOSIVES IN IOWA' },
  { region: 'NA', color: REGIONS.NA.color, icon: 'ballot', headline: 'CALIFORNIA DEMOCRAT QUITS CONGRESS' },
  { region: 'NA', color: REGIONS.NA.color, icon: 'chart', headline: 'DELL LIFTS FORECASTS ON RECORD AI SERVER DEMAND' },
  { region: 'NA', color: REGIONS.NA.color, icon: 'people', headline: 'MELANIA TRUMP WELCOMES WHITE HOUSE CHRISTMAS TREE' },
  { region: 'EU', color: REGIONS.EU.color, icon: 'shield', headline: 'TWO ARRESTED OVER BURGLARY AT ROYAL NORFOLK HOME' },
  { region: 'EU', color: REGIONS.EU.color, icon: 'warn', headline: 'UK FIRMS TOLD TO ACT ON SABOTAGE RISK' },
  { region: 'EU', color: REGIONS.EU.color, icon: 'book', headline: 'POPE FRANCIS DIARY: HE SAW THE DEVIL THREE TIMES' },
  { region: 'EU', color: REGIONS.EU.color, icon: 'people', headline: 'STYLES AND EILISH HEADLINE GLASTONBURY' },
  { region: 'EU', color: REGIONS.EU.color, icon: 'flag', headline: "RUSSIA'S OWN FIGURES SHOW NEARLY 500,000 WAR DEAD" },
  { region: 'EU', color: REGIONS.EU.color, icon: 'plane', headline: 'NATO TO DEPLOY EARLY WARNING AIRCRAFT IN POLAND' },
  { region: 'EU', color: REGIONS.EU.color, icon: 'flag', headline: '700,000 RUSSIAN SOLDIERS KILLED' },
  { region: 'ME', color: REGIONS.ME.color, icon: 'flame', headline: 'ISRAELI STRIKE KILLS HAMAS SECURITY CHIEF IN GAZA' },
  { region: 'ME', color: REGIONS.ME.color, icon: 'warn', headline: 'LAND MINE CASUALTIES SOAR IN SYRIA' },
  { region: 'ME', color: REGIONS.ME.color, icon: 'missile', headline: 'SAUDI STRIKES IN SOUTH-WEST YEMEN KILL SEVERAL' },
  { region: 'ME', color: REGIONS.ME.color, icon: 'ship', headline: 'THREE OIL TANKERS HIT BY MINES IN HORMUZ' },
  { region: 'ME', color: REGIONS.ME.color, icon: 'flame', headline: 'IRAN BRACES FOR WINTER GAS SHORTAGES' },
  { region: 'ME', color: REGIONS.ME.color, icon: 'people', headline: 'US AND QATAR DISCUSS STRATEGIC COOPERATION' },
  { region: 'AP', color: REGIONS.AP.color, icon: 'people', headline: "MODI HOLDS TALKS WITH GERMANY'S MERZ" },
  { region: 'AP', color: REGIONS.AP.color, icon: 'ballot', headline: 'BJP AND AKALI DAL ALLY FOR PUNJAB 2027' },
  { region: 'AP', color: REGIONS.AP.color, icon: 'warn', headline: 'NEPAL QUAKE 5.6 HITS KOSHI PROVINCE NEAR CHINA BORDER' },
  { region: 'AP', color: REGIONS.AP.color, icon: 'chip', headline: 'AI FAKES SMEAR TAIWAN ELECTION CANDIDATES' },
  { region: 'AP', color: REGIONS.AP.color, icon: 'people', headline: 'NORTH KOREANS JAILED FOR BEING CHRISTIAN' },
  { region: 'AF', color: REGIONS.AF.color, icon: 'cross', headline: 'WHO EVACUATES STAFF FROM DR CONGO HOSPITAL AMID FIGHTING' },
  { region: 'AF', color: REGIONS.AF.color, icon: 'plane', headline: 'DR CONGO PLANE MISSING AS REBELS CLAIM SHOOT-DOWN' },
  { region: 'AF', color: REGIONS.AF.color, icon: 'court', headline: 'NIGERIAN MONARCH, 92, SUSPENDED' },
  { region: 'SP', color: REGIONS.SP.color, icon: 'trophy', headline: 'SOORYAVANSHI, 15, SMASHES FASTEST LIST A 200' },
  { region: 'SP', color: REGIONS.SP.color, icon: 'chess', headline: 'GUKESH HOLDS SINDAROV IN WORLD CHESS TITLE FIGHT' },
  { region: 'SP', color: REGIONS.SP.color, icon: 'trophy', headline: 'SENEGAL REINSTATED AS AFCON WINNERS' },
  { region: 'SC', color: REGIONS.SC.color, icon: 'planet', headline: 'STAR SYSTEM FOUND THAT SHOULD NOT EXIST' },
];

// ------------------------------------------------------------------- layout
fillRect(0, 0, W, H, PAPER);

// Masthead
fillRect(0, 0, W, 12, NAVY);
fillRect(12, 12, W - 24, 92, NAVY);
drawText(26, 26, 'THE WORLD IN ONE DAY', 4, WHITE);
drawText(26, 68, 'WEDNESDAY 25 NOVEMBER 2026', 2, [255, 214, 130]);
drawText(26, 88, '35 DATED STORIES - 7 REGIONS - ONE FRONT PAGE', 1, [200, 205, 220]);
const rightBlock = '25 NOV 2026';
drawText(W - 26 - textWidth(rightBlock, 3), 30, rightBlock, 3, WHITE);
drawText(W - 26 - textWidth('THE DAY IN WORLD NEWS', 1), 62, 'THE DAY IN WORLD NEWS', 1, [200, 205, 220]);
drawText(W - 26 - textWidth('MAKE.FUN NEWS-IMAGE-20261125', 1), 80, 'MAKE.FUN NEWS-IMAGE-20261125', 1, [200, 205, 220]);
fillRect(12, 108, W - 24, 4, RED);

// Lead row: 3 big cards
const leadY = 120;
const leadH = 122;
const leadW = 325;
for (let i = 0; i < LEADS.length; i++) {
  const s = LEADS[i];
  const x = 12 + i * (leadW + 10);
  fillRect(x, leadY, leadW, leadH, CARD);
  rect(x, leadY, leadW, leadH, LINE);
  fillRect(x, leadY, leadW, 5, s.color);
  const rn = REGIONS[s.region as keyof typeof REGIONS].name;
  drawText(x + 10, leadY + 12, rn, 1, s.color);
  drawText(x + leadW - 10 - textWidth('25 NOV', 1), leadY + 12, '25 NOV', 1, GREY);
  icon(x + 12, leadY + 34, 56, s.icon);
  drawTextBlock(x + 80, leadY + 34, s.headline, 2, INK, leadW - 92, 5, 17);
}

// Grid: 4 columns x 8 rows = 32 cards
const gridY = 252;
const cardW = 241;
const cardH = 86;
for (let i = 0; i < GRID.length; i++) {
  const s = GRID[i];
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = 12 + col * (cardW + 10);
  const y = gridY + row * (cardH + 8);
  fillRect(x, y, cardW, cardH, CARD);
  rect(x, y, cardW, cardH, LINE);
  fillRect(x, y, cardW, 4, s.color);
  const rn = REGIONS[s.region as keyof typeof REGIONS].name;
  drawText(x + 8, y + 10, rn, 1, s.color);
  drawText(x + cardW - 8 - textWidth('25 NOV', 1), y + 10, '25 NOV', 1, GREY);
  icon(x + 8, y + 30, 40, s.icon);
  drawTextBlock(x + 56, y + 30, s.headline, 2, INK, cardW - 64, 4, 15);
}

// Footer
const foot = 'ALL STORIES HAPPENED OR WERE FIRST REPORTED ON WEDNESDAY 25 NOVEMBER 2026 - SOURCES: BBC - REUTERS - AP - GUARDIAN - THE HINDU';
drawText(12 + Math.floor((W - 24 - textWidth(foot, 1)) / 2), 1002, foot, 1, GREY);

// -------------------------------------------------------------------- write
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG(W, H, px));
