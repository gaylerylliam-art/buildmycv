import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5186';
const output = path.resolve('artifacts/peekaboo-review');
fs.mkdirSync(output, { recursive: true });
for (const name of ['character-top', 'character-side', 'character-bottom', 'character-wave']) {
  const image = await loadImage(`public/assets/mascots/${name}.webp`);
  assert.deepEqual([image.width, image.height], [512, 512]);
  const canvas = createCanvas(512, 512), context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  assert.equal(context.getImageData(0, 0, 1, 1).data[3], 0, `${name}: transparent background missing`);
}
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, userDataDir: fs.mkdtempSync(path.join(output, 'browser-')) });
const page = await browser.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.setRequestInterception(true);
page.on('request', request => {
  if (request.url().includes('/.netlify/scripts/rum')) return request.abort();
  return (request.url().startsWith(base) && !request.url().includes('/.netlify/functions/')) || request.url().startsWith('data:') ? request.continue() : request.abort();
});
await page.evaluateOnNewDocument(() => localStorage.setItem('cvforall:cookie-notice', 'accepted'));
const mascot = '.bl-article .mascot-placement-topic-card';
const animation = `${mascot} .mascot-life`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checkCards = async () => {
  const problems = await page.$$eval('.bl-article', cards => cards.flatMap(card => {
    const errors = [], mascot = card.querySelector('[data-mascot]');
    if (!mascot || card.querySelectorAll('[data-mascot]').length !== 1) return ['Missing or duplicate mascot'];
    if (mascot.getAttribute('aria-hidden') !== 'true' || [...mascot.querySelectorAll('img')].some(image => image.alt !== '')) errors.push('Decorative semantics');
    const r = mascot.getBoundingClientRect();
    if (r.width <= 0 || Math.abs(r.width - r.height) > 1 || r.left < 0 || r.right > innerWidth) errors.push('Unreserved/clipped mascot');
    for (const node of card.querySelectorAll('a,h3,.bl-meta,.bl-article-copy > p')) {
      const c = node.getBoundingClientRect();
      if (Math.min(r.right, c.right) - Math.max(r.left, c.left) > 1 && Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) > 1) errors.push('Text/link overlap');
    }
    const position = card.dataset.mascotPosition;
    const title = card.querySelector('h3').getBoundingClientRect();
    const summary = card.querySelector('.bl-article-copy > p').getBoundingClientRect();
    const link = card.querySelector('.bl-read').getBoundingClientRect();
    if (position === 'top' && r.bottom > title.top + 1) errors.push('Mascot not at top');
    if (position === 'middle-right' && summary.width && r.left < summary.right - 1) errors.push('Mascot not at middle-right');
    if (position === 'middle-right' && !summary.width && (r.top < title.bottom - 1 || r.bottom > link.top + 1)) errors.push('Narrow list middle placement');
    if (position === 'bottom-left' && r.right > link.left + 1) errors.push('Mascot not at bottom-left');
    if (position === 'bottom-right' && r.left < link.right - 1) errors.push('Mascot not at bottom-right');
    if (position.startsWith('bottom-') && summary.width && r.top < summary.bottom - 1) errors.push('Mascot not below summary');
    return errors;
  }));
  assert.deepEqual(problems, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
};
const checkTemplates = async () => {
  const problems = await page.$$eval('.hm-template', cards => cards.flatMap(card => {
    const mascot = card.querySelector('.mascot-placement-template-card'), errors = [];
    if (!mascot || card.querySelectorAll('[data-mascot]').length !== 1) return ['Missing template mascot'];
    const r = mascot.getBoundingClientRect(), bounds = card.getBoundingClientRect();
    if (!bounds.width) return [];
    if (!r.width || r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1) errors.push('Template mascot outside card');
    for (const node of card.querySelectorAll('a,button,.hm-template-caption')) {
      const c = node.getBoundingClientRect();
      if (Math.min(r.right, c.right) - Math.max(r.left, c.left) > 1 && Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) > 1) errors.push('Template content overlap');
    }
    const position = card.dataset.mascotPosition;
    const preview = card.querySelector('.hm-template-preview').getBoundingClientRect();
    const caption = card.querySelector('.hm-template-info').getBoundingClientRect();
    const link = card.querySelector('.hm-template-use').getBoundingClientRect();
    if (position === 'top' && r.bottom > preview.top + 1) errors.push('Template top placement');
    if (position === 'middle-right' && (r.top < preview.bottom - 1 || r.bottom > caption.top + 1)) errors.push('Template middle placement');
    if (position === 'bottom-left' && (r.top < caption.bottom - 1 || r.right > link.left + 1)) errors.push('Template bottom-left placement');
    if (position === 'bottom-right' && (r.top < caption.bottom - 1 || r.left < link.right - 1)) errors.push('Template bottom-right placement');
    return errors;
  }));
  assert.deepEqual(problems, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
};
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setJavaScriptEnabled(false);
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  assert.equal(await page.$$eval('.hm-template .mascot-placement-template-card', items => items.length), 6);
  await checkTemplates();
  await page.goto(base + '/blog/', { waitUntil: 'networkidle0' });
  assert.equal(await page.$$eval(mascot, items => items.length), 9);
  assert.deepEqual(await page.$$eval('.bl-article', cards => [...new Set(cards.map(card => card.dataset.mascotPosition))]), ['top', 'middle-right', 'bottom-left', 'bottom-right']);
  assert.equal(await page.$eval(`${mascot} .mascot-image-current`, image => getComputedStyle(image).opacity), '1');
  assert.equal(await page.$('.bl-article .mascot-sprite'), null);
  await checkCards();
  assert.deepEqual(await page.$$eval(`${mascot} .mascot-image-current`, images => [...new Set(images.map(image => image.getAttribute('src')))]), ['character-top', 'character-side', 'character-bottom', 'character-wave'].map(name => `/assets/mascots/${name}.webp`));
  await page.setJavaScriptEnabled(true);
  await page.reload({ waitUntil: 'networkidle0' });
  while (await page.$('.bl-load button')) await page.click('.bl-load button');
  assert.equal(await page.$$eval(mascot, items => items.length), await page.$$eval('.bl-article', items => items.length));
  const placements = await page.$$eval('.bl-article', cards => Object.fromEntries(cards.map(card => [card.querySelector('h3 a').getAttribute('href'), card.dataset.mascotPosition])));
  await page.$$eval('.bl-topics button', buttons => buttons.find(button => button.textContent === 'ATS & AI').click());
  await page.waitForFunction(() => document.querySelector('.bl-topics [aria-pressed="true"]')?.textContent === 'ATS & AI');
  assert(await page.$$eval('.bl-article', (cards, placements) => cards.length > 0 && cards.every(card => placements[card.querySelector('h3 a').getAttribute('href')] === card.dataset.mascotPosition), placements), 'Filtering changed article placements');
  await page.$$eval('.bl-topics button', buttons => buttons.find(button => button.textContent === 'All guides').click());
  await page.waitForFunction(() => document.querySelector('.bl-topics [aria-pressed="true"]')?.textContent === 'All guides');
  await checkCards();
  await page.$eval(mascot, node => node.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.mascotActive === 'true', {}, mascot);
  assert.equal(await page.$eval(animation, image => getComputedStyle(image).animationPlayState), 'running');
  const frames = await page.$eval(animation, async image => {
    const animation = image.getAnimations()[0], frames = [];
    animation.pause();
    for (const time of [0, 840, 1680, 2640]) {
      animation.currentTime = time;
      await new Promise(resolve => requestAnimationFrame(resolve));
      frames.push(getComputedStyle(image).transform);
    }
    animation.play();
    return frames;
  });
  assert(new Set(frames).size >= 3, 'Uploaded artwork must keep its tilt movement');
  await page.screenshot({ path: path.join(output, 'cards-desktop.png') });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.mascotActive === 'false', {}, mascot);
  assert.equal(await page.$eval(animation, image => getComputedStyle(image).animationPlayState), 'paused');
  await page.$eval(mascot, node => node.scrollIntoView({ block: 'center' }));
  const other = await browser.newPage(); await other.bringToFront(); await pause(250);
  assert.equal(await page.$eval(animation, image => getComputedStyle(image).animationPlayState), 'paused');
  await other.close(); await page.bringToFront();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.mascotReduced === 'true', {}, mascot);
  assert.equal(await page.$eval(animation, image => getComputedStyle(image).animationName), 'none');
  assert.equal(await page.$('.bl-article .mascot-sprite'), null);
  assert.equal(await page.$eval(`${mascot} .mascot-image-current`, image => getComputedStyle(image).opacity), '1');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(base + '/blog/', { waitUntil: 'networkidle0' });
    await page.$eval('#guides', node => node.scrollIntoView({ block: 'start' }));
    for (const view of ['Grid', 'List']) {
      await page.click(`[aria-label="${view} view"]`);
      await checkCards();
      await page.screenshot({ path: path.join(output, `cards-${view.toLowerCase()}-${width}.png`) });
    }
  }
  await page.click('[aria-label="Switch to dark mode"]');
  await checkCards();
  assert.equal(await page.$eval('.bl-header .brand-logo img', image => image.getAttribute('src')), '/assets/buildmycvnow-logo.webp');
  await page.emulateMediaType('print');
  assert.equal(await page.$eval(mascot, node => getComputedStyle(node).display), 'none');
  await page.emulateMediaType('screen');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(base + '/', { waitUntil: 'networkidle0' });
    await page.click('.hm-show-all');
    assert.equal(await page.$$eval('.hm-template', cards => cards.length), 10);
    assert.deepEqual(await page.$$eval('.hm-template', cards => [...new Set(cards.map(card => card.dataset.mascotPosition))]), ['top', 'middle-right', 'bottom-left', 'bottom-right']);
    await checkTemplates();
    const positions = await page.$$eval('.hm-template', cards => Object.fromEntries(cards.map(card => [card.dataset.templateId, card.dataset.mascotPosition])));
    await page.$$eval('.hm-template img', images => Promise.all(images.map(async image => {
      image.loading = 'eager';
      await image.decode();
    })));
    await page.$eval('.hm-template-grid', grid => scrollTo({ top: grid.getBoundingClientRect().top + scrollY - document.querySelector('.hm-nav').getBoundingClientRect().height - 16, behavior: 'instant' }));
    await page.screenshot({ path: path.join(output, `templates-${width}.png`) });
    await page.$eval('.hm-category-tabs button:nth-child(5)', button => {
      button.scrollIntoView({ block: 'center', behavior: 'instant' });
      button.click();
    });
    await page.waitForFunction(() => document.querySelectorAll('.hm-template').length === 1);
    assert(await page.$eval('.hm-template', (card, positions) => positions[card.dataset.templateId] === card.dataset.mascotPosition, positions), 'Category filter changed mascot placement');
    await checkTemplates();
    await page.click('.hm-template-preview');
    await page.waitForSelector('.hm-preview-dialog');
    assert.equal(await page.$('.hm-preview-dialog [data-mascot]'), null);
    await page.keyboard.press('Escape');
    assert.equal(await page.$('.hm-preview-dialog'), null);
    assert(await page.$eval('.hm-template-use', link => link.getAttribute('href').includes('category=finance')));
  }
  assert.deepEqual(errors, []);
  console.log('PASS: four positions across article and template cards, stable filtering, all 10 templates, preview dialogs/links, uploaded artwork and tilt movement, static fallback, grid/list, pagination, responsive 320-1440px, hidden-tab/offscreen pause, reduced motion, dark theme, print exclusion and unchanged menu logo.');
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally { await browser.close(); }
