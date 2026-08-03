/**
 * Draws the social-preview card and the touch icon straight to PNG.
 *
 * No image library: the art is flat rectangles, and a truecolour PNG is a
 * deflate stream wrapped in three chunks, so hand-rolling the encoder is
 * cheaper than a dependency. Run `npm run og` after changing the palette.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type RGB = readonly [number, number, number];

const BG: RGB = [0x04, 0x12, 0x0f];
const GRID: RGB = [0x07, 0x1c, 0x17];
const PANEL: RGB = [0x07, 0x1a, 0x18];
const PANEL_2: RGB = [0x0a, 0x23, 0x1f];
const LINE: RGB = [0x16, 0x40, 0x3a];
const EDGE: RGB = [0x2a, 0x5f, 0x57];
const DIM: RGB = [0x3f, 0x6b, 0x64];
const GREEN: RGB = [0x2e, 0xe6, 0xa0];
const GREEN_TINT: RGB = [0x0b, 0x2c, 0x26];
const CYAN: RGB = [0x22, 0xd3, 0xee];
const RED: RGB = [0xe0, 0x52, 0x63];

class Canvas {
  readonly px: Buffer;

  constructor(
    readonly w: number,
    readonly h: number,
    fill: RGB,
  ) {
    this.px = Buffer.alloc(w * h * 3);
    this.rect(0, 0, w, h, fill);
  }

  rect(x: number, y: number, w: number, h: number, color: RGB): void {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0);
    const y1 = Math.min(this.h, (y + h) | 0);
    for (let py = y0; py < y1; py++) {
      let i = (py * this.w + x0) * 3;
      for (let px = x0; px < x1; px++) {
        this.px[i++] = color[0];
        this.px[i++] = color[1];
        this.px[i++] = color[2];
      }
    }
  }

  stroke(x: number, y: number, w: number, h: number, color: RGB, t = 1): void {
    this.rect(x, y, w, t, color);
    this.rect(x, y + h - t, w, t, color);
    this.rect(x, y, t, h, color);
    this.rect(x + w - t, y, t, h, color);
  }

  toPng(): Buffer {
    // One filter byte (0 = none) in front of every scanline.
    const stride = this.w * 3;
    const raw = Buffer.alloc((stride + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (stride + 1)] = 0;
      this.px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // colour type: truecolour
    // bytes 10..12 stay zero: deflate, adaptive filtering, no interlace

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * The preview card carries no lettering — every platform prints the title and
 * description beside it, so the image only has to look like the machine.
 */
function ogCard(): Canvas {
  const c = new Canvas(1200, 630, BG);

  for (let x = 0; x < c.w; x += 40) c.rect(x, 0, 1, c.h, GRID);
  for (let y = 0; y < c.h; y += 40) c.rect(0, y, c.w, 1, GRID);

  // Corner rules of the poster frame.
  for (const [cx, cy, dx, dy] of [
    [40, 40, 1, 1],
    [1160, 40, -1, 1],
    [40, 590, 1, -1],
    [1160, 590, -1, -1],
  ] as const) {
    c.rect(dx > 0 ? cx : cx - 70, cy, 70, 2, EDGE);
    c.rect(cx - (dx > 0 ? 0 : 2), dy > 0 ? cy : cy - 70, 2, 70, EDGE);
  }

  // Packet header: six fields, the one the level cares about lit.
  const widths = [4, 3, 3, 2, 1, 1];
  const total = widths.reduce((a, b) => a + b, 0);
  const strip = 900;
  const gap = 10;
  const unit = (strip - gap * (widths.length - 1)) / total;
  let x = 150;
  widths.forEach((weight, i) => {
    const w = Math.round(unit * weight);
    const lit = i === 0;
    c.rect(x, 150, w, 104, lit ? GREEN_TINT : PANEL_2);
    c.stroke(x, 150, w, 104, lit ? GREEN : LINE, 2);
    // Label, bits and value, as the bars they read as at preview size.
    c.rect(x + 14, 172, Math.min(w - 28, 46), 7, lit ? GREEN : DIM);
    c.rect(x + 14, 196, w - 28, 9, lit ? GREEN : DIM);
    c.rect(x + 14, 222, Math.min(w - 28, 30), 9, lit ? GREEN : LINE);
    x += w + gap;
  });

  // Slice lanes, filling against their expected counts.
  const lanes: Array<{ color: RGB; filled: number; slots: number }> = [
    { color: GREEN, filled: 5, slots: 5 },
    { color: CYAN, filled: 2, slots: 5 },
    { color: RED, filled: 1, slots: 3 },
  ];
  lanes.forEach((lane, i) => {
    const y = 330 + i * 84;
    c.rect(150, y, 900, 62, PANEL);
    c.stroke(150, y, 900, 62, LINE, 2);
    c.rect(150, y, 5, 62, lane.color);
    c.rect(184, y + 27, 132, 9, lane.color);
    for (let s = 0; s < lane.slots; s++) {
      const sx = 400 + s * 46;
      if (s < lane.filled) c.rect(sx, y + 21, 34, 22, lane.color);
      else c.stroke(sx, y + 21, 34, 22, LINE, 2);
    }
  });

  return c;
}

/** Touch icon: the favicon's three lanes, at 180px. */
function touchIcon(): Canvas {
  const c = new Canvas(180, 180, PANEL);
  c.rect(28, 45, 50, 28, GREEN);
  c.rect(28, 90, 90, 28, CYAN);
  c.rect(28, 135, 34, 17, RED);
  return c;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'public'), { recursive: true });

for (const [name, canvas] of [
  ['og.png', ogCard()],
  ['icon-180.png', touchIcon()],
] as const) {
  const path = resolve(root, 'public', name);
  writeFileSync(path, canvas.toPng());

  // Self-check: a reader must see the signature and the dimensions we claimed.
  const written = readFileSync(path);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  console.assert(
    signature.every((b, i) => written[i] === b),
    `${name}: bad PNG signature`,
  );
  console.assert(written.readUInt32BE(16) === canvas.w, `${name}: bad width`);
  console.assert(written.readUInt32BE(20) === canvas.h, `${name}: bad height`);

  console.log(`${name}  ${canvas.w}x${canvas.h}  ${(written.length / 1024).toFixed(1)} kB`);
}
