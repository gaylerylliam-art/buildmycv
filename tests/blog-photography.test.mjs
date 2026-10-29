import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { loadImage } from '@napi-rs/canvas';
import { blogArticles } from '../src/data/blogArticles.js';
import { getBlogPhotography } from '../src/content/blogPhotography.js';
import { parseBlogFrontmatter } from '../src/lib/blogFrontmatter.js';

const markdown = fs.readdirSync('content/blog').filter(file => file.endsWith('.md')).map(file => parseBlogFrontmatter(fs.readFileSync(path.join('content/blog', file), 'utf8')).data);
const articles = [...new Map([...blogArticles, ...markdown].map(article => [article.slug, article])).values()];

test('every article has a distinct local photograph with verified dimensions and attribution', async () => {
  const paths = new Set(), hashes = new Set();
  for (const article of articles) {
    const photo = getBlogPhotography(article);
    assert.match(photo.image, /^\/assets\/blog\/[a-z0-9-]+\.jpg$/, article.slug);
    assert(!paths.has(photo.image), `${article.slug}: repeated image path`);
    paths.add(photo.image);
    assert(photo.imageAlt && photo.imageCredit, `${article.slug}: missing description or credit`);
    assert(['www.pexels.com', 'images.unsplash.com'].includes(new URL(photo.imageSource).hostname));
    const buffer = fs.readFileSync('public' + photo.image);
    assert(buffer.length < 350_000, `${article.slug}: oversized photograph`);
    const hash = createHash('sha256').update(buffer).digest('hex');
    assert(!hashes.has(hash), `${article.slug}: duplicate photograph under another name`);
    hashes.add(hash);
    const image = await loadImage(buffer);
    assert.equal(image.width, photo.imageWidth, article.slug);
    assert.equal(image.height, photo.imageHeight, article.slug);
  }
  assert.equal(paths.size, articles.length);
});

test('the owner-selected visa-status photograph is preserved', () => {
  const article = articles.find(article => article.slug === 'visa-status-on-cv-uae');
  assert.equal(getBlogPhotography(article).image, '/assets/blog/visa-status-cv-pexels.jpg');
  assert.match(getBlogPhotography(article).imageSource, /4101343\/$/);
});
