import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import {createCvImportHandler} from '../netlify/functions/cvImport.mjs';
import {fixtureProvider,docxFixture,sampleCv,arabicText} from '../tests/cv-import/fixtures.mjs';
process.env.CV_IMPORT_SIGNING_SECRET='browser-test-only-signing-secret-32-characters';
const provider=fixtureProvider();let organizeAttempts=0;
provider.organize=async({text})=>{if(++organizeAttempts===1)throw new Error('Synthetic transient provider failure');if(text.includes('أمينة'))return sampleCv({...Object.fromEntries(Object.keys(sampleCv()).filter(key=>typeof sampleCv()[key]==='string').map(key=>[key,''])),fullName:'أمينة أحمد',jobTitle:'مهندسة دعم',location:'دبي',originalLanguage:'Arabic',languageDirection:'rtl',workExperiences:[],uncertainties:[]});return sampleCv();};
const handler=createCvImportHandler(provider),dist=path.resolve('dist'),output=path.resolve('artifacts/cv-import-review');fs.mkdirSync(output,{recursive:true});
const english=path.join(output,'synthetic-cv.docx'),arabic=path.join(output,'synthetic-arabic.docx'),bad=path.join(output,'corrupt.pdf'),unsupported=path.join(output,'unsupported.txt');
fs.writeFileSync(english,await docxFixture());fs.writeFileSync(arabic,await docxFixture(arabicText));fs.writeFileSync(bad,'%PDF-corrupt');fs.writeFileSync(unsupported,'not a supported file');
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url?.split('?')[0]==='/.netlify/functions/cvImport'){
   const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(req.url?.startsWith('/.netlify/functions/')){res.writeHead(404);res.end('{}');return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let target=path.resolve(dist,'.'+pathname);
  if(!target.startsWith(dist+path.sep)&&target!==dist){res.writeHead(403);res.end();return;}
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');if(!fs.existsSync(target))target=path.join(dist,'index.html');
  const types={'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(fs.readFileSync(target));
 }catch{res.writeHead(500);res.end('{}');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',userDataDir:fs.mkdtempSync(path.join(output,'browser-')),headless:true,args:['--disable-gpu','--no-first-run']});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewport({width:1440,height:1000});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.evaluateOnNewDocument(()=>localStorage.setItem('cvforall:cookie-notice','accepted'));await page.setRequestInterception(true);page.on('request',request=>request.url().startsWith(base)||request.url().startsWith('data:')?request.continue():request.abort());
const click=async text=>{assert(await page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()===text);button?.click();return Boolean(button);},text));};
const builderField=async(label,value)=>page.evaluate((label,value)=>{const caption=[...document.querySelectorAll('.form-label')].find(item=>item.textContent.trim()===label);const input=caption?.closest('label')?.querySelector('input,textarea');if(!input)throw new Error('Missing builder field '+label);if(value!==undefined){Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}return input.value;},label,value);
try{
 await page.goto(`${base}/builder?start=upload`,{waitUntil:'networkidle0'});await page.waitForSelector('.cv-importer');await click('Upload CV');
 await builderField('Full name','Existing Person');
 await(await page.$('.cv-import-browse input')).uploadFile(english);
 await page.waitForSelector('.cv-import-error');assert.match(await page.$eval('.cv-import-error',e=>e.textContent),/could not be processed/);assert.equal(await builderField('Full name'),'Existing Person');assert(await page.$('.cv-import-source'));
 await click('Retry organizing retained text');await page.waitForSelector('.cv-import-review');
 assert.equal(organizeAttempts,2);assert.equal(await builderField('Full name'),'Existing Person');
 assert.equal(await page.$eval('.cv-import-primary',e=>e.disabled),true);
 await page.$eval('.cv-import-review input',input=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Reviewed Person');input.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.match(await page.$eval('.cv-import-source pre',e=>e.textContent),/Amina Test/);
 await page.click('.cv-import-confirm input');await page.$eval('.cv-import-primary',button=>{button.click();button.click();});
 await page.waitForSelector('.cv-import-success');assert.equal(await builderField('Full name'),'Reviewed Person');await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent.trim().startsWith('Education and certifications'));if(button?.getAttribute('aria-expanded')!=='true')button?.click();});assert.equal(await builderField('Awards'),'Excellence Award');assert.equal(await builderField('Volunteer experience'),'Community mentor');
 await page.waitForFunction(()=>document.querySelector('.cv-paper-page')?.textContent.includes('Excellence Award'));
 await page.screenshot({path:path.join(output,'review-desktop.png'),fullPage:true});
 await page.click('.cv-import-confirm input');await click('Undo this import');assert.equal(await builderField('Full name'),'Existing Person');
 await click('Clear this upload');assert.equal(await page.$('.cv-import-source'),null);assert.equal(await page.$('.cv-import-review'),null);
 await(await page.$('.cv-import-browse input')).uploadFile(unsupported);await page.waitForSelector('.cv-import-error');assert.match(await page.$eval('.cv-import-error',e=>e.textContent),/PDF, DOCX, JPG, or PNG/);
 await(await page.$('.cv-import-browse input')).uploadFile(bad);await page.waitForFunction(()=>document.querySelector('.cv-import-error')?.textContent.includes('PDF is corrupted'));assert.equal(await builderField('Full name'),'Existing Person');await click('Clear this upload');
 await page.evaluate(data=>{const bytes=Uint8Array.from(atob(data),char=>char.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],'synthetic-arabic.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));document.querySelector('.cv-import-drop').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));},fs.readFileSync(arabic).toString('base64'));await page.waitForSelector('.cv-import-review');assert.equal(await page.$eval('.cv-import-review select',e=>e.value),'rtl');assert.equal(await page.$eval('.cv-import-review input',e=>e.value),'أمينة أحمد');
 await page.click('.cv-import-confirm input');await click('Confirm and import reviewed CV');await page.waitForSelector('.cv-import-success');assert.equal(await page.$eval('.cv-page-stack',e=>e.getAttribute('dir')),'rtl');
 await page.setViewport({width:390,height:844});await page.screenshot({path:path.join(output,'review-arabic-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS: real DOCX parsing + synthetic provider contract, retry preserves source and builder data, editable review, required confirmation, import mapping/preview, undo, invalid uploads, Arabic RTL and mobile layout. Live OCR is a separate opt-in test.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
