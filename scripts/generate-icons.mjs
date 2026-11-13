/*
 * Draws the app icon (a "D" on the brand green) and writes the PNG sizes the
 * web app manifest and iOS need. No dependencies: run with `npm run icons`.
 *
 * The background is full-bleed and the letter stays inside the central 60%,
 * so the same image also works as a maskable icon.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BACKGROUND = [0x80, 0xd6, 0xac];
const LETTER = [0x10, 0x22, 0x19];
/** Sub-samples per pixel side, for smooth edges. */
const SAMPLES = 4;

const SIZES = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
];

/** Whether the point (x, y), in 0..1 icon coordinates, is inside the letter. */
function insideLetter(x, y) {
  const left = 0.33;
  const top = 0.27;
  const bottom = 0.73;
  const stroke = 0.105;
  const radius = (bottom - top) / 2;
  const centerX = 0.47;
  const centerY = 0.5;

  // A "D" is a bar on the left closed by a half ring on the right.
  const shape = (inset) => {
    const r = radius - inset;
    if (y < top + inset || y > bottom - inset || x < left + inset) return false;
    if (x <= centerX) return true;
    return (x - centerX) ** 2 + (y - centerY) ** 2 <= r * r;
  };
  return shape(0) && !shape(stroke);
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let covered = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size;
          const y = (py + (sy + 0.5) / SAMPLES) / size;
          if (insideLetter(x, y)) covered++;
        }
      }
      const mix = covered / (SAMPLES * SAMPLES);
      const offset = (py * size + px) * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = Math.round(BACKGROUND[channel] * (1 - mix) + LETTER[channel] * mix);
      }
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

/* Minimal PNG encoder: 8-bit RGBA, no interlacing. */

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function encodePng(pixels, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // bit depth 8, colour type RGBA

  // Each row starts with a filter byte (0 = none).
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const [path, size] of SIZES) {
  writeFileSync(path, encodePng(drawIcon(size), size));
  console.log(`${path} (${size}×${size})`);
}
