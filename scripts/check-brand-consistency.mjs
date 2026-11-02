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
  const image = logo.querySelector('img'), rect = image.getBoundingClientRect();
  return {src:image.getAttribute('src'),alt:image.alt,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,width:rect.width,height:rect.height,fit:getComputedStyle(image).objectFit,filter:getComputedStyle(image).filter};
});
const checkImages = async () => {
  await page.$$eval('.brand-logo img', images => Promise.all(images.map(image => image.decode())));
  assert(await page.$$eval('.brand-logo img', images => images.every(image => {
    const r = image.getBoundingClientRect(), parent = image.closest('a,button'), header = image.closest('header,.nav');
    const h = header?.getBoundingClientRect();
    return image.alt === 'BuildMyCVNow' && r.left >= 0 && r.right <= innerWidth && r.width >= 79 && r.height > 0 &&
      Math.abs(r.width / r.height - 448 / 405) < .01 && Boolean(parent?.getAttribute('aria-label')) &&
      (!h || (r.top >= h.top - 1 && r.bottom <= h.bottom + 1));
  })), 'Logo must load without cropping, distortion or header clipping');
};
try {
  for (const width of [1440,390,320]) {
    await page.setViewport({width,height:900});
    let reference;
    for (const route of ['/', '/templates', '/about', '/contact', '/faq', '/blog', '/blog/visa-status-on-cv-uae', '/privacy', '/terms']) {
      await page.setJavaScriptEnabled(false);
      await page.goto(base + route + (route === '/' ? '' : '/'), {waitUntil:'networkidle0'});
      await page.evaluate(()=>document.fonts.ready);
      await checkImages();
      const current = await snapshot();
      assert.equal(current.src,'/assets/buildmycvnow-logo.webp');
      assert.deepEqual([current.naturalWidth,current.naturalHeight],[448,405]);
      reference ||= current;
      assert.deepEqual(current,reference,`${width}px ${route}: inconsistent static logo`);
      assert.equal(await page.$$eval('.brand-logo',logos=>logos.length),2,`${route}: missing header/footer branding`);
      const bounds = await page.$eval('.brand-logo',logo=>{const r=logo.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth;});
      assert(bounds,`${width}px ${route}: clipped logo`);
      if (route === '/' || route === '/blog' || route === '/blog/visa-status-on-cv-uae') await page.screenshot({path:path.join(output,`${route === '/' ? 'home' : route === '/blog' ? 'blog' : 'article'}-${width}.png`)});
    }
    await page.setJavaScriptEnabled(true);
    await page.goto(base+'/builder?start=upload',{waitUntil:'networkidle0'});
    await page.waitForSelector('.builder-workspace');
    await page.$eval('button[aria-label="Light"]',button=>button.click());
    await checkImages();
    assert.deepEqual(await snapshot(),reference,`${width}px: builder logo differs`);
    await page.$eval('button[aria-label="Dark"]',button=>button.click());
    const dark = await snapshot();
    assert.deepEqual(dark,reference,'Dark mode must preserve the supplied artwork and colors');
    await checkImages();
    await page.screenshot({path:path.join(output,'builder-'+width+'.png')});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: supplied logo artwork, accessible home links, intrinsic size, aspect ratio, responsive sizes and no header clipping across homepage, blog, article, builder and supporting pages; artwork unchanged in dark mode.');
} finally {await browser.close();}
