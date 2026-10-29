import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5181';
const output = path.resolve('artifacts/builder-redesign');
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  userDataDir: fs.mkdtempSync(path.join(output, 'browser-')), headless: true,
});
const page = await browser.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.setRequestInterception(true);
page.on('request', request => request.url().startsWith(base) || request.url().startsWith('data:') ? request.continue() : request.abort());
await page.evaluateOnNewDocument(() => localStorage.setItem('cvforall:cookie-notice', 'accepted'));
const click = async text => assert(await page.evaluate(text => {
  const button = [...document.querySelectorAll('button')].find(item => item.getClientRects().length && item.textContent.trim() === text);
  button?.click(); return Boolean(button);
}, text), 'Missing visible button ' + text);
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base + '/builder', { waitUntil: 'networkidle0' });
  assert(await page.$('.builder-setup-card'));
  await page.screenshot({ path: path.join(output, 'start-desktop.png'), fullPage: true });
  await click('Skip and open builder');
  await page.waitForSelector('.builder-workspace');
  assert.equal(await page.$eval('#builder-editor-heading', item => item.textContent), 'Personal information');
  await page.$eval('input[placeholder="Example: Juan Dela Cruz"]', input => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Design Review Person');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  for (const [label, id] of [['Work history', 'experience'], ['Education', 'education'], ['Skills & languages', 'skills'], ['Summary', 'summary'], ['References & extras', 'extras']]) {
    await click(label);
    assert.equal(await page.$eval('#builder-section-personal', item => item.hidden), true);
    if (id !== 'extras') assert.equal(await page.$eval('#builder-section-' + id, item => item.hidden), false);
    else assert(await page.$eval('#builder-section-references', item => Boolean(item.getClientRects().length)));
  }
  await click('Personal details');
  assert.equal(await page.$eval('input[placeholder="Example: Juan Dela Cruz"]', item => item.value), 'Design Review Person');
  await click('Upload & translate'); await click('Upload CV');
  await click('Work history'); await click('Upload & translate');
  assert.equal(await page.$eval('#cv-import-content', item => item.hidden), false, 'Import review stays mounted between sections');
  await click('Hide upload');
  await click('Personal details');
  await page.screenshot({ path: path.join(output, 'editor-desktop.png') });
  await click('Cover letter'); await page.waitForSelector('.letter-paper');
  await click('CV Builder'); await page.waitForSelector('.builder-workspace');
  assert.equal(await page.$eval('input[placeholder="Example: Juan Dela Cruz"]', item => item.value), 'Design Review Person');
  assert.deepEqual(errors, []);
  console.log('PASS: onboarding, six focused sections, retained edits, extras, persistent upload review, and CV/cover-letter navigation.');
} finally { await browser.close(); }
