import fs from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const source = process.argv[2];
if (!source) throw new Error('Provide the path to the approved logo PNG.');
const image = await loadImage(source);
const width = 448;
const height = Math.round(image.height * width / image.width);
const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');
context.drawImage(image, 0, 0, width, height);
const output = new URL('../public/assets/buildmycvnow-logo.webp', import.meta.url);
const bytes = await canvas.encode('webp', 95);
await fs.writeFile(output, bytes);
console.log(`Prepared transparent logo: ${width} x ${height}, ${bytes.length} bytes`);
