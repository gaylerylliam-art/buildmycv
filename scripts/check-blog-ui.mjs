import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {blogArticles} from '../src/data/blogArticles.js';
import {parseBlogFrontmatter} from '../src/lib/blogFrontmatter.js';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5181';
const output = path.resolve('artifacts/blog-review');
fs.mkdirSync(output,{recursive:true});
const slugs = new Set([...blogArticles.map(article=>article.slug),...fs.readdirSync('content/blog').filter(file=>file.endsWith('.md')).map(file=>parseBlogFrontmatter(fs.readFileSync(path.join('content/blog',file),'utf8')).data.slug)]);
for (const slug of slugs) {
  const html = fs.readFileSync(path.join('dist/blog',slug,'index.html'),'utf8');
  assert(html.includes('class="brand-logo"'),slug+': missing shared logo');
  assert(html.includes(`https://buildmycvnow.com/blog/${slug}`),slug+': missing canonical');
  assert.equal([...html.matchAll(/<h1\b/g)].length,1,slug+': wrong heading count');
}
const browser = await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,userDataDir:fs.mkdtempSync(path.join(output,'browser-'))});
const page = await browser.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.setCacheEnabled(false);
await page.setRequestInterception(true);
page.on('request',request=>request.url().startsWith(base)&&!request.url().includes('/.netlify/functions/')||request.url().startsWith('data:')?request.continue():request.abort());
await page.evaluateOnNewDocument(()=>{localStorage.setItem('cvforall:cookie-notice','accepted');localStorage.setItem('bmcv_theme','light');});
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
const click = async text => assert(await page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(item=>item.getClientRects().length&&item.textContent.trim()===text);button?.click();return Boolean(button);},text),'Missing '+text);
const ready = async () => {await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.querySelector('.bl-feature > img')?.naturalWidth>0);};
const rects = () => page.$$eval('.bl-header,.bl-heading,.bl-feature,.bl-guides-heading',items=>items.map(item=>{const r=item.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];}));
try {
  await page.setViewport({width:1440,height:1000});
  await page.setJavaScriptEnabled(false);await page.goto(base+'/blog/',{waitUntil:'networkidle0'});await ready();
  assert.equal(await page.$$eval('h1',items=>items.length),1);
  assert.equal(await page.$$eval('noscript .bl-all-links a',items=>items.length),slugs.size);
  const staticLayout=await rects();
  await page.screenshot({path:path.join(output,'static-desktop.png')});
  await page.setJavaScriptEnabled(true);await page.reload({waitUntil:'networkidle0'});await ready();
  assert.deepEqual(await rects(),staticLayout,'Static and interactive layout differ');
  assert.equal(await page.$$eval('.bl-article',items=>items.length),9);
  while(await page.$('.bl-load button')) await page.click('.bl-load button');
  assert.equal(await page.$$eval('.bl-article',items=>items.length),slugs.size);
  for (const slug of slugs) assert(await page.$(`.bl-article a[href="/blog/${slug}"]`),'Missing article '+slug);
  await page.type('.bl-search input','ats');
  assert(await page.$$eval('.bl-article',items=>items.length>0&&items.every(item=>item.textContent.toLowerCase().includes('ats'))));
  await page.click('.bl-search input',{clickCount:3});await page.keyboard.type('no-matching-career-guide-xyz');
  await page.waitForSelector('.bl-empty');await click('Clear filters');
  assert.equal(await page.$eval('.bl-search input',input=>input.value),'');
  await click('ATS & AI');assert.equal(await page.$eval('.bl-topics [aria-pressed=true]',button=>button.textContent),'ATS & AI');
  assert(await page.$$eval('.bl-article-image > span',items=>items.length>0&&items.every(item=>item.textContent==='ATS & AI')));
  await click('All guides');await page.click('[aria-label="List view"]');assert(await page.$('.bl-articles.bl-list'));
  await page.click('[aria-label="Grid view"]');
  for(const width of [1920,1440,1024,768,390,320]) {
    await page.setViewport({width,height:900});await page.goto(base+'/blog',{waitUntil:'networkidle0'});await ready();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+': horizontal overflow');
    const logo=await page.$eval('.brand-logo',logo=>{const r=logo.getBoundingClientRect();return r.right<=innerWidth&&r.left>=0;});assert(logo,width+': clipped logo');
    await page.screenshot({path:path.join(output,'blog-'+width+'.png')});
    await page.$eval('#guides',element=>element.scrollIntoView({behavior:'instant',block:'start'}));
    await page.$$eval('.bl-articles img',items=>items.forEach(image=>image.loading='eager'));
    await page.waitForFunction(()=>[...document.querySelectorAll('.bl-articles img')].every(image=>image.complete&&image.naturalWidth>0));
    assert(await page.$$eval('.bl-topics button',items=>items.every(item=>{const r=item.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})),width+': clipped topics');
    await page.screenshot({path:path.join(output,'guides-'+width+'.png')});
    if(width===390){await page.click('[aria-label="List view"]');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'list-mobile.png')});}
  }
  await page.setViewport({width:1440,height:1000});await page.goto(base+'/blog',{waitUntil:'networkidle0'});
  await page.click('[aria-label="Switch to dark mode"]');
  assert(await page.$eval('html',element=>element.classList.contains('dark')));
  assert.equal(await page.$eval('.bl-header .brand-logo-word',word=>getComputedStyle(word).color),'rgb(241, 243, 250)');
  await page.screenshot({path:path.join(output,'dark-desktop.png')});
  const targets=['ats-friendly-cv',blogArticles[0].slug];
  for(const slug of targets){const response=await page.goto(base+'/blog/'+slug+'/',{waitUntil:'networkidle0'});assert.equal(response.status(),200);const title=blogArticles.find(article=>article.slug===slug)?.title||parseBlogFrontmatter(fs.readFileSync('content/blog/'+slug+'.md','utf8')).data.title;assert.equal(await page.$eval('h1',heading=>heading.textContent),title);assert(await page.$('a[href="/builder"]'));}
  await page.goto(base+'/builder',{waitUntil:'networkidle0'});await page.waitForSelector('.builder-workspace');assert.equal(await page.$('.builder-onboarding'),null);
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${slugs.size} existing article routes, static/React parity, search/filter/reset, all-article pagination, grid/list, real images, shared branding, dark theme, responsive 320-1920px, and direct builder entry.`);
}catch(error){console.log(JSON.stringify({url:page.url(),errors,image:await page.$eval('.bl-feature > img',img=>({src:img.currentSrc,naturalWidth:img.naturalWidth,complete:img.complete})).catch(()=>null),body:await page.evaluate(()=>document.body.innerText.slice(0,500))}));await page.screenshot({path:path.join(output,'failure.png')});throw error;}finally{await browser.close();}
