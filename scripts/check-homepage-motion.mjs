import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5175';
const output=path.resolve('artifacts/homepage-review');
fs.mkdirSync(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,userDataDir:fs.mkdtempSync(path.join(output,'motion-browser-')),args:['--disable-gpu','--no-first-run']});
const page=await browser.newPage(), errors=[];
let blockMotion = false;
page.on('pageerror',e=>errors.push(e.message));
await page.setRequestInterception(true);
page.on('request',r=> { if (blockMotion && r.url().includes('ScrollTrigger-')) return r.abort(); return r.url().startsWith(base)||r.url().startsWith('data:') ? r.continue():r.abort(); });
await page.evaluateOnNewDocument(()=>localStorage.setItem('cvforall:cookie-notice','accepted'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
  await page.setViewport({width:1440,height:1000});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('.hm-rotating-word')?.textContent !== 'job-ready',{timeout:12000});
  const first=await page.$eval('.hm-rotating-word',e=>e.textContent);
  assert(['interview-ready','recruiter-ready','stand out'].includes(first));
  const initial=await page.$eval('.hm-marquee-track',e=>getComputedStyle(e).transform);
  await delay(200);
  assert.notEqual(await page.$eval('.hm-marquee-track',e=>getComputedStyle(e).transform),initial,'Marquee did not move');
  for(const selector of ['#improve','#templates','#free-download','.hm-translate','#faq','.hm-final']) {
    await page.$eval(selector,e=>e.scrollIntoView({behavior:'instant',block:'center'}));
    await delay(900);
    assert(await page.$eval(selector,e=>getComputedStyle(e).opacity !== '0'));
  }
  assert.equal(await page.$$eval('.hm-improve-card,.hm-template,.hm-access-grid article,.hm-faq details',items=>items.filter(e=>getComputedStyle(e).opacity==='0').length),0,'Content stranded invisible');
  await page.click('.hm-category-tabs button:nth-child(5)');
  await page.$eval('.hm-template', e=>e.scrollIntoView({behavior:'instant',block:'center'})); await delay(1000);
  assert.equal(await page.$eval('.hm-template',e=>getComputedStyle(e).opacity),'1');
  await page.evaluate(()=>scrollTo(0,0)); await delay(600);
  await page.click('.hm-motion-control button');
  assert.equal(await page.$eval('.hm-rotating-word',e=>e.textContent),'job-ready');
  assert.equal(await page.$eval('.hm-marquee-track',e=>getComputedStyle(e).transform),'none');
  await delay(2800);
  assert.equal(await page.$eval('.hm-rotating-word',e=>e.textContent),'job-ready');
  await page.click('.hm-motion-control button');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await delay(200);
  assert.equal(await page.$eval('.hm-rotating-word',e=>e.textContent),'job-ready');
  assert.equal(await page.$eval('.hm-marquee-track',e=>getComputedStyle(e).transform),'none');
  for(const width of [320,390,768,1024,1440]) {
    await page.setViewport({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
    const rect=await page.$eval('.hm-rotating-line',e=>({height:e.clientHeight,width:e.clientWidth}));
    assert(rect.height>0 && rect.width<=width);
  }
  await page.setViewport({width:1440,height:1000});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.goto(`${base}/builder?start=upload`,{waitUntil:'networkidle0'});
  await page.waitForSelector('.builder-layout-v2'); await delay(1200);
  await page.click('.builder-step-list button:nth-of-type(2)'); await delay(700);
  assert.equal(await page.$eval('.builder-form-inner',e=>getComputedStyle(e).opacity),'1');
  await page.goto(base,{waitUntil:'networkidle0'}); await delay(1200);
  blockMotion = true;
  await page.goto(base,{waitUntil:'networkidle0'}); await delay(3200);
  assert.equal(await page.$eval('.hm-rotating-word',e=>e.textContent),'job-ready');
  assert.equal(await page.$eval('.hm-marquee-track',e=>getComputedStyle(e).transform),'none');
  assert.equal(await page.$eval('.hm-improve-card,.hm-template,.hm-access-grid article,.hm-faq details',items=>items.filter(e=>getComputedStyle(e).opacity==='0').length),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: rotation, moving bands, scroll reveals, no invisible content, pause/resume, live reduced-motion changes, mobile overflow, builder transitions, route cleanup and animation-load failure fallback.');
} catch(error) { console.log(JSON.stringify({url:page.url(),errors,body:await page.evaluate(()=>document.body.innerText.slice(0,1600))})); throw error; } finally { await browser.close(); }
