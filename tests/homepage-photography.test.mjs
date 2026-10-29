import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadImage } from '@napi-rs/canvas';
import { homeCvExamples } from '../src/data/homeCvExamples.js';

test('every real CV preview has a distinct lightweight industry photograph alongside it', async () => {
  const paths = new Set();
  for (const example of homeCvExamples) {
    assert.match(example.image, /^\/assets\/cv-examples\/.+\.png$/);
    const photo = example.industryPhoto;
    assert(photo.alt && photo.credit && photo.source.startsWith('https://www.pexels.com/photo/'));
    assert(!paths.has(photo.src)); paths.add(photo.src);
    const bytes = fs.readFileSync('public' + photo.src);
    assert(bytes.length < 60_000, example.id + ': industry photo too large');
    const image = await loadImage(bytes);
    assert.deepEqual([image.width, image.height], [400, 300]);
  }
  assert.equal(paths.size, 10);
});

test('shared office background is locally available and optimized', async () => {
  const bytes = fs.readFileSync('public/assets/office-background.jpg');
  const image = await loadImage(bytes);
  assert.deepEqual([image.width, image.height], [1600, 1200]);
  assert(bytes.length < 350_000);
});

test('approved hero has lightweight desktop and mobile assets', async () => {
  for (const [file, size] of [['hero-professionals.webp', [1672, 941]], ['hero-professionals-mobile.webp', [1000, 717]]]) {
    const bytes = fs.readFileSync('public/assets/' + file);
    assert(bytes.length < 200_000, file + ': hero image too large');
    const image = await loadImage(bytes);
    assert.deepEqual([image.width, image.height], size);
  }
});
