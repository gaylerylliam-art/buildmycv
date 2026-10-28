import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:5178';
const out=path.resolve('artifacts/builder-redesign');fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--disable-gpu','--no-first-run']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.evaluateOnNewDocument(()=>localStorage.setItem('cvforall:cookie-notice','accepted'));
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
const click=async text=>{assert(await page.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===text);b?.click();return !!b;},text),'Missing button '+text);};
try {
await page.setViewport({width:1440,height:1000});await page.goto(base+'/builder',{waitUntil:'networkidle0'});
assert(await page.$('.builder-setup-card'));await page.screenshot({path:path.join(out,'start-desktop.png'),fullPage:true});
await click('Skip and open builder');await page.waitForSelector('.builder-editor-card');
assert.equal(await page.$eval('#builder-editor-heading',x=>x.textContent),'Personal info');
await page.screenshot({path:path.join(out,'editor-desktop.png'),fullPage:true});
const changeName=async value=>page.evaluate(value=>{const el=document.querySelector('input[placeholder="Example: Juan Dela Cruz"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
await changeName('Design Review Person');
await click('Next section →');assert.equal(await page.$eval('#builder-editor-heading',x=>x.textContent),'Experience');
assert(await page.$eval('#builder-section-personal',x=>x.hidden));assert(await page.$eval('#builder-section-experience',x=>!x.hidden));
await click('Next section →');assert.equal(await page.$eval('#builder-editor-heading',x=>x.textContent),'Education');assert(await page.$eval('#builder-section-references',x=>!x.hidden));
await click('Next section →');assert.equal(await page.$eval('#builder-editor-heading',x=>x.textContent),'Skills');
await click('Next section →');assert.equal(await page.$eval('#builder-editor-heading',x=>x.textContent),'Summary and extras');assert(await page.$eval('.builder-save-layout',x=>!x.hidden));assert(await page.$eval('#builder-section-qr',x=>!x.hidden));
await page.click('.builder-stage-tab:first-child');assert.equal(await page.$eval('input[placeholder="Example: Juan Dela Cruz"]',x=>x.value),'Design Review Person');
await click('Upload CV');assert(await page.$eval('#cv-import-content',x=>!x.hidden));await page.click('.builder-stage-tab:nth-child(2)');assert(await page.$eval('#cv-import-content',x=>!x.hidden),'Upload review must stay mounted through section changes');
await page.click('.builder-stage-tab:first-child');await click('Hide upload');
await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:path.join(out,'editor-dark.png')});await page.evaluate(()=>document.documentElement.classList.remove('dark'));
for(const width of [1024,768,390]){await page.setViewport({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,`Overflow at ${width}`);await page.screenshot({path:path.join(out,`editor-${width}.png`)});}
await page.click('.mobile-builder-tabbar button:nth-child(2)');await page.waitForSelector('.mobile-sheet');assert(await page.$('.mobile-sheet .cv-paper'));await click('Close');
await page.setViewport({width:1440,height:1000});await click('Cover Letter Builder');assert(await page.$('.letter-paper'));await click('CV Builder');assert.equal(await page.$eval('input[placeholder="Example: Juan Dela Cruz"]',x=>x.value),'Design Review Person');
assert.deepEqual(errors,[]);console.log('Builder design verified: onboarding, all five sections, edited data retention, references/extras, upload panel persistence, desktop/tablet/mobile/dark, mobile preview; no browser errors.');
} finally {await browser.close();}
