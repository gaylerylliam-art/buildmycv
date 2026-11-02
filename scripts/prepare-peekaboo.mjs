import fs from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const input = process.argv[2];
if (!input) throw new Error('Provide the approved four-frame PNG sprite sheet.');
const image = await loadImage(input);
if (image.width % 4) throw new Error('Expected four equal-width frames.');
const frameWidth = image.width / 4;
const sheet = createCanvas(1024, 256);
const scale = Math.min(240 / frameWidth, 240 / image.height);
for (let index = 0; index < 4; index++) {
  sheet.getContext('2d').drawImage(image, index * frameWidth, 0, frameWidth, image.height,
    index * 256 + (256 - frameWidth * scale) / 2, 248 - image.height * scale,
    frameWidth * scale, image.height * scale);
}
const still = createCanvas(256, 256);
still.getContext('2d').drawImage(sheet, 0, 0, 256, 256, 0, 0, 256, 256);
const output = new URL('../public/assets/mascots/', import.meta.url);
await fs.mkdir(output, { recursive: true });
await fs.writeFile(new URL('peekaboo-wave.webp', output), await sheet.encode('webp', 90));
await fs.writeFile(new URL('peekaboo-static.webp', output), await still.encode('webp', 90));
console.log('Prepared four aligned 256px animation frames and a static fallback.');
