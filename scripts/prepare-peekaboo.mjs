import fs from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const input = process.argv[2];
if (!input) throw new Error('Provide the approved four-frame PNG sprite sheet.');
const name = process.argv[3] || 'peekaboo';
if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Use a lowercase asset name without path separators.');
const image = await loadImage(input);
if (image.width % 4) throw new Error('Expected four equal-width frames.');
const frameWidth = image.width / 4;
const source = createCanvas(image.width, image.height);
source.getContext('2d').drawImage(image, 0, 0);
const pixels = source.getContext('2d').getImageData(0, 0, image.width, image.height).data;
let left = frameWidth, top = image.height, right = 0, bottom = 0;
// Crop one shared union, not individual frames, to keep the animation registered.
for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
  if (pixels[(y * image.width + x) * 4 + 3] > 8) {
    const localX = x % frameWidth;
    left = Math.min(left, localX); right = Math.max(right, localX);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
}
if (right <= left || bottom <= top) throw new Error('Empty animation sheet.');
const width = right - left + 1, height = bottom - top + 1;
const sheet = createCanvas(1024, 256);
const scale = Math.min(240 / width, 240 / height);
for (let index = 0; index < 4; index++) {
  sheet.getContext('2d').drawImage(image, index * frameWidth + left, top, width, height,
    index * 256 + (256 - width * scale) / 2, 248 - height * scale,
    width * scale, height * scale);
}
const still = createCanvas(256, 256);
still.getContext('2d').drawImage(sheet, 0, 0, 256, 256, 0, 0, 256, 256);
const output = new URL('../public/assets/mascots/', import.meta.url);
await fs.mkdir(output, { recursive: true });
await fs.writeFile(new URL(`${name}-wave.webp`, output), await sheet.encode('webp', 90));
await fs.writeFile(new URL(`${name}-static.webp`, output), await still.encode('webp', 90));
console.log(`${name}: prepared four aligned 256px animation frames and a static fallback.`);
