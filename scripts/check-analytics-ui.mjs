import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import puppeteer from 'puppeteer-core';
const output='artifacts/analytics-review';fs.mkdirSync(output,{recursive:true});
const root=path.resolve('dist');const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setRequestInterception(true);
let tagRequests=0;
page.on('request',async request=>{try{const url=new URL(request.url());if(url.hostname==='www.googletagmanager.com'){tagRequests++;return request.respond({status:200,contentType:'application/javascript',body:''});}if(url.hostname!=='buildmycvnow.com')return request.abort();let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)&&file!==root)return request.abort();if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file))return request.abort();const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';return request.respond({status:200,contentType:type,body:fs.readFileSync(file)});}catch{return request.abort();}});
try{
 await page.setViewport({width:390,height:844});
 await page.goto('https://buildmycvnow.com/blog/ats-friendly-cv/?email=private@example.com',{waitUntil:'networkidle0'});
 assert.equal(tagRequests,0);assert(await page.$('#bmcv-privacy-panel'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:output+'/mobile-consent.png'});
 await page.click('#bmcv-privacy-panel button');assert.equal(tagRequests,0);assert.equal(await page.$('#bmcv-privacy-panel'),null);
 await page.reload({waitUntil:'networkidle0'});assert.equal(await page.$('#bmcv-privacy-panel'),null);assert.equal(tagRequests,0);
 await page.click('#bmcv-privacy-settings');await page.click('#bmcv-privacy-panel button:nth-of-type(2)');
 await page.waitForFunction(()=>window.dataLayer?.some(x=>x[1]==='page_view'));
 const commands=await page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));assert.equal(commands.filter(x=>x[0]==='config').length,1);assert(!JSON.stringify(commands).includes('private@example.com'));
 assert.equal(tagRequests,1);
 await page.goto('https://buildmycvnow.com/builder/',{waitUntil:'networkidle0'});await page.waitForSelector('.builder-workspace');
 await page.waitForFunction(()=>window.dataLayer?.some(x=>x[1]==='builder_started'));
 assert.equal(await page.evaluate(()=>window.dataLayer.filter(x=>x[1]==='builder_started').length),1);
 await page.evaluate(()=>window.BuildMyCVAnalytics.init());
 assert.equal(await page.evaluate(()=>window.dataLayer.filter(x=>x[0]==='config').length),1);
 await page.goto('https://buildmycvnow.com/privacy/',{waitUntil:'networkidle0'});assert((await page.$eval('main',n=>n.textContent)).includes('Optional Google Analytics'));
 await page.click('#bmcv-privacy-settings');await page.click('#bmcv-privacy-panel button');
 const count=await page.evaluate(()=>window.dataLayer.filter(x=>x[0]==='event').length);
 await page.evaluate(()=>window.BuildMyCVAnalytics.track('download_completed',{format:'pdf',email:'private@example.com'}));
 assert.equal(await page.evaluate(()=>window.dataLayer.filter(x=>x[0]==='event').length),count);
 await page.setViewport({width:1440,height:1000});await page.goto('https://buildmycvnow.com/blog/',{waitUntil:'networkidle0'});await page.screenshot({path:output+'/desktop-rejected.png'});
 assert.deepEqual(errors,[]);
 const files=fs.readdirSync(root,{recursive:true}).filter(f=>String(f).endsWith('index.html'));
 for(const file of files){const html=fs.readFileSync(path.join(root,file),'utf8');assert.equal((html.match(/src="\/assets\/site-analytics.js"/g)||[]).length,1,file);assert(!html.includes('plausible.io/js/'),file);assert(html.includes('/assets/privacy-controls.css'),file);}
 console.log('PASS: '+files.length+' built pages share consent-aware tracking; mobile/desktop consent, reject persistence, re-enable/revoke, no private query values, real React builder starts once, shared privacy content and no browser errors. Google requests were intercepted; no analytics traffic was sent.');
}finally{await browser.close();}
