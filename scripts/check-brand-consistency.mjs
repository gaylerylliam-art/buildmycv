import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5181';
const output = path.resolve('artifacts/brand-review');
fs.mkdirSync(output, {recursive:true});
const browser = await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless:true, userDataDir:fs.mkdtempSync(path.join(output,'browser-'))});
const page = await browser.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.setRequestInterception(true);
page.on('request', request => request.url().startsWith(base) && !request.url().includes('/.netlify/functions/') || request.url().startsWith('data:') ? request.continue() : request.abort());
await page.evaluateOnNewDocument(()=>localStorage.setItem('cvforall:cookie-notice','accepted'));
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
const snapshot = async () => page.$eval('.brand-logo', logo => {
  const style = getComputedStyle(logo), word = logo.querySelector('.brand-logo-word'), mark = logo.querySelector('.brand-logo-mark');
  return {text:logo.textContent, font:style.fontFamily, weight:style.fontWeight, size:style.fontSize, spacing:style.letterSpacing, word:getComputedStyle(word).color, accent:getComputedStyle(logo.querySelector('.brand-logo-now')).color, icon:getComputedStyle(mark).backgroundColor, width:mark.offsetWidth, height:mark.offsetHeight};
});
try {
  for (const width of [1440,390,320]) {
    await page.setViewport({width,height:900});
    let reference;
    for (const route of ['/', '/templates', '/about', '/contact', '/faq', '/blog', '/privacy', '/terms']) {
      await page.setJavaScriptEnabled(false);
      await page.goto(base + route, {waitUntil:'networkidle0'});
      await page.evaluate(()=>document.fonts.ready);
      const current = await snapshot();
      assert.equal(current.text,'BuildMyCVNow');
      reference ||= current;
      assert.deepEqual(current,reference,`${width}px ${route}: inconsistent static logo`);
      assert.equal(await page.$$eval('.brand-logo',logos=>logos.length),2,`${route}: missing header/footer branding`);
      const bounds = await page.$eval('.brand-logo',logo=>{const r=logo.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth;});
      assert(bounds,`${width}px ${route}: clipped logo`);
    }
    await page.setJavaScriptEnabled(true);
    await page.goto(base+'/builder?start=upload',{waitUntil:'networkidle0'});
    await page.waitForSelector('.builder-workspace');
    await page.$eval('button[aria-label="Light"]',button=>button.click());
    assert.deepEqual(await snapshot(),reference,`${width}px: builder logo differs`);
    await page.$eval('button[aria-label="Dark"]',button=>button.click());
    const dark = await snapshot();
    assert.equal(dark.word,'rgb(241, 243, 250)');
    assert.equal(dark.accent,'rgb(82, 211, 162)');
    assert.equal(dark.icon,reference.icon);
    await page.screenshot({path:path.join(output,'builder-'+width+'.png')});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: matching logo text, local font, weight, spacing, colors, icon and responsive sizes across homepage, builder and seven supporting pages; dark variant remains readable.');
} finally {await browser.close();}
