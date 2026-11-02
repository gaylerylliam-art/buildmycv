import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { buildCvHtml, buildCvDocxBlob } from '../src/utils/downloads.js';
import { layouts, themes } from '../src/data/categories.js';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5184';
const output = path.resolve('artifacts/mascot-review');
fs.mkdirSync(output, { recursive: true });
const moods = ['welcoming', 'thoughtful', 'focused', 'confident', 'excited', 'reassuring'];
for (const mood of moods) {
  const image = await loadImage(`public/assets/mascots/${mood}.webp`);
  assert.deepEqual([image.width, image.height], [512, 512]);
  const canvas = createCanvas(512, 512), context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  assert.equal(context.getImageData(0, 0, 1, 1).data[3], 0, `${mood}: transparency lost`);
  const pixels = context.getImageData(0, 0, 512, 512).data;
  let bottom = 0;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) if (pixels[(y * 512 + x) * 4 + 3] > 8) bottom = Math.max(bottom, y);
  assert(bottom >= 494 && bottom <= 497, `${mood}: inconsistent baseline`);
}
const files = fs.readdirSync('dist', { recursive: true }).filter(file => String(file).endsWith('index.html'));
const routes = files.map(file => '/' + path.dirname(file).replaceAll('\\', '/').replace(/^\.$/, '')).map(route => route === '/' ? route : route + '/');
const selected = ['/', '/faq/', '/blog/', '/templates/', '/about/', '/contact/', '/privacy/', '/terms/', '/for-ofw/', '/404/', '/cv-examples/', routes.find(route => route.startsWith('/cv/')), '/blog/visa-status-on-cv-uae/'];
for (const file of files) {
  const html = fs.readFileSync(path.join('dist', file), 'utf8');
  assert(html.includes('/assets/mascot.css'), `${file}: missing shared styles`);
  assert(html.includes('/assets/mascot-motion.js'), `${file}: missing shared controller`);
  if (!String(file).startsWith('builder')) assert(html.includes('data-mascot=""'), `${file}: missing static appearance`);
}
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, userDataDir: fs.mkdtempSync(path.join(output, 'browser-')), args: ['--disable-gpu', '--no-first-run'] });
const page = await browser.newPage(), errors = [], postBodies = [];
let contactPosts = 0, pdfPosts = 0, otpPosts = 0, blockController = false;
await page.setRequestInterception(true);
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
page.on('request', async request => {
  const url = request.url();
  if (blockController && url.endsWith('/assets/mascot-motion.js')) return request.abort();
  if (url.startsWith(base) && url.includes('/.netlify/functions/contact') && request.method() === 'POST') {
    contactPosts++; postBodies.push(request.postData());
    return request.respond({ status: 200, contentType: 'text/html', body: '<h1>Local contact form check</h1>' });
  }
  if (url.startsWith(base) && url.includes('/.netlify/functions/emailOtp') && request.method() === 'POST') {
    otpPosts++;
    const body = JSON.parse(request.postData());
    if (body.action === 'verify') assert.equal(body.otp, '123456');
    return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, challenge: 'local-mascot-test', message: 'Local test only; no email sent.' }) });
  }
  if (url.startsWith(base) && url.includes('/.netlify/functions/export-pdf') && request.method() === 'POST') {
    pdfPosts++;
    const { html } = JSON.parse(request.postData());
    assert(!html.includes('/assets/mascots/') && !html.includes('data-mascot'), 'Mascot leaked into PDF HTML');
    const renderer = await browser.newPage();
    await renderer.setContent(html);
    const bytes = await renderer.pdf({ format: 'A4', printBackground: true });
    await renderer.close();
    return request.respond({ status: 200, contentType: 'application/pdf', body: Buffer.from(bytes) });
  }
  if (url.includes('/.netlify/functions/') || request.method() !== 'GET') return request.abort();
  return url.startsWith(base) || url.startsWith('data:') ? request.continue() : request.abort();
});
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('cvforall:cookie-notice', 'accepted');
  window.mascotEntrances = [];
  document.addEventListener('animationstart', event => {
    if (event.animationName === 'mascot-reveal') window.mascotEntrances.push(event.target.closest('[data-mascot]')?.className);
  });
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const clickText = async text => {
  assert(await page.evaluate(text => {
    const scope = document.querySelector('.mascot-dialog') || document;
    const button = [...scope.querySelectorAll('button')].find(button => button.textContent.trim() === text && button.getClientRects().length);
    button?.click(); return Boolean(button);
  }, text), `Missing button: ${text}`);
};
const geometry = async route => {
  await page.$$eval('[data-mascot] img', images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); })));
  const problems = await page.evaluate(() => {
    const failures = [];
    for (const mascot of document.querySelectorAll('[data-mascot]')) {
      const r = mascot.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (mascot.getAttribute('aria-hidden') !== 'true' || mascot.querySelector('img').alt !== '') failures.push('Decorative semantics');
      if (r.left < -1 || r.right > innerWidth + 1 || Math.abs(r.width - r.height) > 1) failures.push('Mascot bounds');
      for (const control of document.querySelectorAll('a,button,input,textarea,select,summary')) {
        const c = control.getBoundingClientRect();
        if (!c.width || !c.height || control.contains(mascot)) continue;
        if (Math.min(r.right, c.right) - Math.max(r.left, c.left) > 2 && Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) > 2) failures.push(`Overlap: ${control.textContent.slice(0, 40)}`);
      }
    }
    if (document.querySelector('.cv-paper [data-mascot],.letter-paper [data-mascot]')) failures.push('Preview contamination');
    return failures;
  });
  assert.deepEqual(problems, [], route);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${route}: horizontal overflow`);
};
try {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setJavaScriptEnabled(false);
  const checked = process.env.QUICK_MASCOTS ? selected : routes;
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 900 });
    for (const [index, route] of checked.entries()) {
      if (route === '/builder/') continue;
      const response = await page.goto(base + route, { waitUntil: 'load' });
      assert([200, 304].includes(response.status()), `${route}: HTTP ${response.status()}`);
      await page.evaluate(() => document.fonts.ready);
      assert(await page.$('[data-mascot]'), route);
      await geometry(route);
      if (selected.includes(route)) await page.screenshot({ path: path.join(output, `${route.replaceAll('/', '_') || 'home'}-${width}.png`) });
      if (index % 30 === 0) console.log(`Routes: ${width}px ${index + 1}/${checked.length}`);
    }
  }
  console.log(`PASS: ${checked.length} generated routes at desktop/mobile sizes, no-JS visibility, loaded assets, reserved bounds and no control overlaps.`);
  await page.setJavaScriptEnabled(true);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(base, { waitUntil: 'networkidle0' });
  const intro = '.mascot-placement-introduction';
  await page.$eval(intro, node => node.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.mascotActive === 'true', {}, intro);
  await pause(800);
  const entrances = await page.evaluate(() => window.mascotEntrances.filter(name => name.includes('mascot-placement-introduction')).length);
  assert.equal(entrances, 1);
  await page.hover(intro); await pause(250);
  assert.notEqual(await page.$eval(intro + ' .mascot-hover', node => getComputedStyle(node).transform), 'none', 'Mouse hover reaction missing');
  await page.mouse.move(0, 0);
  await page.$eval('.hm-final', node => node.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.mascotActive === 'false', {}, intro);
  assert.equal(await page.$eval(intro + ' .mascot-life', node => getComputedStyle(node).animationPlayState), 'paused');
  await page.$eval(intro, node => node.scrollIntoView({ block: 'center' }));
  await pause(300);
  assert.equal(await page.evaluate(() => window.mascotEntrances.filter(name => name.includes('mascot-placement-introduction')).length), entrances);
  const other = await browser.newPage(); await other.goto('about:blank'); await other.bringToFront();
  await page.waitForFunction(() => document.visibilityState === 'hidden');
  assert.equal(await page.$eval(intro + ' .mascot-life', node => getComputedStyle(node).animationPlayState), 'paused');
  await other.close(); await page.bringToFront();
  await page.$eval('.hm-motion-control button', button => button.click());
  await page.waitForFunction(() => !document.querySelector('[data-mascot-active="true"]'));
  await page.$eval('.hm-motion-control button', button => button.click());
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-mascot]')].every(node => node.dataset.mascotReduced === 'true'));
  assert(await page.$$eval('.mascot-life', nodes => nodes.every(node => getComputedStyle(node).animationName === 'none')));
  await page.emulateMediaType('print');
  assert(await page.$$eval('[data-mascot],.brand-logo', nodes => nodes.every(node => getComputedStyle(node).display === 'none')));
  await page.emulateMediaType('screen');
  blockController = true; await page.goto(base + '/contact/', { waitUntil: 'networkidle0' });
  assert.equal(await page.$eval('.mascot-reveal', node => getComputedStyle(node).opacity), '1');
  blockController = false;
  await page.click('form button[type="submit"]'); assert.equal(contactPosts, 0);
  await page.type('input[name="name"]', 'Mascot Local Test');
  await page.type('input[name="email"]', 'mascot-check@example.com');
  await page.type('textarea[name="message"]', 'Local test only. Do not send.');
  await Promise.all([page.waitForNavigation(), page.click('form button[type="submit"]')]);
  assert.equal(contactPosts, 1); assert.equal(new URLSearchParams(postBodies[0]).get('name'), 'Mascot Local Test');
  await page.goto(base + '/builder', { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[placeholder="Example: Juan Dela Cruz"]');
  const name = 'input[placeholder="Example: Juan Dela Cruz"]';
  await page.click(name); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.type(name, 'Mascot Check Candidate');
  await page.waitForFunction(() => document.querySelector('.cv-paper')?.textContent.includes('Mascot Check Candidate'));
  await geometry('/builder');
  const editor = '.mascot-placement-editor';
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const before = await page.$eval(editor, node => node.getBoundingClientRect().width);
  await page.click('#workspace-tab-design');
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.mascotSwapping === 'true', {}, editor);
  assert.equal(await page.$$eval(editor + ' img', images => images.length), 2);
  assert.equal(await page.$eval(editor, node => node.getBoundingClientRect().width), before);
  await page.waitForFunction(selector => !document.querySelector(selector)?.dataset.mascotSwapping, {}, editor);
  assert.equal(await page.$eval(editor, node => node.dataset.mood), 'thoughtful');
  await page.click('#workspace-tab-ai'); await page.waitForSelector('.workspace-ai-panel:not([hidden])');
  await page.click('#workspace-tab-content');
  const downloads = fs.mkdtempSync(path.join(output, 'downloads-'));
  const protocol = await browser.target().createCDPSession();
  await protocol.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const verifyDownload = async () => {
    await page.$eval('.builder-download-button', button => button.click());
    await page.waitForSelector('.mascot-placement-download-guidance');
    await clickText('Send OTP');
    await page.waitForSelector('input[placeholder="Enter 6-digit OTP"]');
    await page.type('input[placeholder="Enter 6-digit OTP"]', '123456'); await clickText('Verify');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Download DOCX' && !button.disabled));
  };
  const waitFile = async extension => {
    for (let index = 0; index < 600; index++) {
      const found = fs.readdirSync(downloads).find(file => file.endsWith(extension));
      if (found) return path.join(downloads, found);
      await pause(100);
    }
    throw new Error('Download missing: ' + extension);
  };
  await verifyDownload(); await clickText('Download DOCX');
  const word = await waitFile('.docx'); assert.equal(fs.readFileSync(word).subarray(0, 2).toString(), 'PK');
  await page.waitForSelector('.mascot-placement-download-success');
  await verifyDownload(); await clickText('Download Free PDF');
  const pdf = await waitFile('.pdf'); assert.equal(fs.readFileSync(pdf).subarray(0, 4).toString(), '%PDF');
  assert.equal(pdfPosts, 1); assert.equal(otpPosts, 4);
  await page.goto(base + '/builder?access=save', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.mascot-placement-account');
  assert.equal(await page.$eval('.mascot-placement-account', node => node.dataset.mascotStatic), 'true');
  await page.click('button[aria-label="Close sign-in dialog"]');
  await page.click('.workspace-documents button:nth-child(2)');
  await page.waitForSelector('.mascot-placement-cover-editor');
  assert.equal(await page.$('.letter-paper [data-mascot]'), null);
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 900 }); await geometry('/builder cover letter ' + width);
    await page.screenshot({ path: path.join(output, `cover-editor-${width}.png`) });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.click('.builder-type-switch button:first-child');
  await page.waitForSelector('.builder-workspace');
  await page.waitForFunction(() => window.BuildMyCVMascots.count() === document.querySelectorAll('[data-mascot]').length);
  for (const width of [768, 390, 320]) {
    await page.setViewport({ width, height: 844 });
    await page.goto(base + '/builder', { waitUntil: 'networkidle0' }); await page.waitForSelector('.builder-workspace');
    await geometry('/builder ' + width);
    await page.screenshot({ path: path.join(output, `builder-${width}.png`) });
    await page.$eval('.mobile-builder-tabbar button:nth-child(2)', button => button.click());
    await page.waitForSelector('.mobile-sheet .cv-paper');
    assert.equal(await page.$('.cv-paper [data-mascot]'), null);
  }
  const cv = { fullName: 'Local Export Check', jobTitle: 'Receptionist', email: 'example@example.com', phone: '+1 202 555 0142', country: 'Worldwide', summary: 'A local CV export fixture.', education: 'Example qualification', skills: 'Service, Scheduling', languages: 'English', workExperiences: [], references: { mode: 'none', entries: [] }, qrCode: { enabled: false } };
  for (const layout of layouts) {
    const html = await buildCvHtml(cv, themes[0], layout.id);
    assert(!html.includes('/assets/mascots/') && !html.includes('data-mascot'));
    const blob = await buildCvDocxBlob(cv, themes[0], layout.id);
    assert(blob.size > 1000);
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ routes: checked.length, widths: [1440, 390], assets: moods, checks: ['no-JS fallback', 'reserved space', 'no control overlap', 'once-only reveal', 'offscreen pause', 'hidden-tab pause', 'manual pause', 'reduced motion', 'print exclusion', 'controller failure fallback', 'contact validation/submission', 'live CV editing', 'crossfade', 'design and AI tabs', 'local OTP/download integration', 'real local PDF and DOCX files', 'auth placement', 'mobile preview', 'all-layout export isolation'], mockedServices: ['contact', 'email OTP', 'PDF endpoint rendered locally with Chromium'], emailsSent: 0 }, null, 2));
  console.log('PASS: mascot lifecycle/accessibility and cleanup, forms, editable preview, crossfade, real local PDF/DOCX downloads, CV/cover-letter builders and export isolation. External services were mocked; no emails sent.');
} catch (error) {
  console.error('URL:', page.url());
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  throw error;
} finally { await browser.close(); }
