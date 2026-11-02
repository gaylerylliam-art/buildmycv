import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const folder = process.argv[2];
if (!folder) throw new Error('Provide the folder containing the six approved PNGs.');
const sources = {
  welcoming: 'BuildMyCVNow friendly welcome logo-1.png',
  thoughtful: 'Thoughtful BuildMyCVNow logo variant-3.png',
  focused: 'Focused BuildMyCVNow logo-2.png',
  confident: 'Confident thumbs-up BuildMyCVNow logo-5.png',
  excited: 'Excited BuildMyCVNow logo with raised fists-4.png',
  reassuring: 'Reassuring BuildMyCVNow logo with caring pose-6.png',
};
const output = new URL('../public/assets/mascots/', import.meta.url);
await fs.mkdir(output, { recursive: true });
for (const [mood, name] of Object.entries(sources)) {
  const image = await loadImage(path.join(folder, name));
  const source = createCanvas(image.width, image.height);
  const context = source.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  let left = image.width, top = image.height, right = 0, bottom = 0;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (pixels[(y * image.width + x) * 4 + 3] > 8) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right <= left || bottom <= top) throw new Error(`Empty mascot: ${name}`);
  const width = right - left + 1, height = bottom - top + 1;
  const scale = Math.min(480 / width, 480 / height);
  const canvas = createCanvas(512, 512);
  // Uniform scaling and a shared bottom baseline preserve the complete artwork.
  canvas.getContext('2d').drawImage(source, left, top, width, height, (512 - width * scale) / 2, 496 - height * scale, width * scale, height * scale);
  const bytes = await canvas.encode('webp', 90);
  await fs.writeFile(new URL(`${mood}.webp`, output), bytes);
  console.log(`${mood}: ${bytes.length} bytes; normalized 512 x 512`);
}
