import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {categories,layouts} from '../src/data/categories.js';
import {PASSPORT_PHOTO} from '../src/lib/profilePhoto.js';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:5183',verifyExports=process.env.SKIP_EXPORT_TESTS!=='1';
if(verifyExports)assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Export module tests run locally only');
const output=path.resolve('artifacts/photo-review');fs.mkdirSync(output,{recursive:true});
const source=createCanvas(700,1000),ctx=source.getContext('2d');ctx.fillStyle='#e2f3f1';ctx.fillRect(0,0,700,1000);ctx.fillStyle='#185fa5';ctx.fillRect(80,600,540,400);ctx.fillStyle='#dbb8a4';ctx.beginPath();ctx.arc(350,420,170,0,Math.PI*2);ctx.fill();ctx.fillStyle='#142735';ctx.beginPath();ctx.arc(300,400,14,0,Math.PI*2);ctx.arc(400,400,14,0,Math.PI*2);ctx.fill();
const fixtures=[];for(const format of ['png','jpeg','webp']){const file=path.join(output,'synthetic-photo.'+(format==='jpeg'?'jpg':format));fs.writeFileSync(file,source.toBuffer('image/'+format));fixtures.push(file);}
const bad=path.join(output,'corrupt.png'),large=path.join(output,'large.png');fs.writeFileSync(bad,'not an image');fs.writeFileSync(large,Buffer.alloc(2*1024*1024+1));
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,userDataDir:fs.mkdtempSync(path.join(output,'browser-'))});
const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.setRequestInterception(true);page.on('request',request=>request.url().startsWith(base)&&!request.url().includes('/.netlify/functions/')||/^(data|blob):/.test(request.url())?request.continue():request.abort());
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
await page.evaluateOnNewDocument(()=>{localStorage.setItem('cvforall:cookie-notice','accepted');localStorage.setItem('bmcv_theme','light');localStorage.setItem('bmcv_milestones','[50,80,100]');});
const click=async(text,selector='button')=>assert(await page.evaluate(({text,selector})=>{const button=[...document.querySelectorAll(selector)].find(item=>item.getClientRects().length&&item.textContent.trim()===text);button?.click();return Boolean(button);},{text,selector}),'Missing '+text);
const input=()=>page.$('input[aria-label="Choose profile photo"]');
const photoData=()=>page.$eval('.builder-right-stack .cv-passport-image',image=>image.src);
const geometry=()=>page.$eval('.builder-right-stack .cv-passport-frame',frame=>{const style=getComputedStyle(frame),image=frame.querySelector('img'),paper=frame.closest('.cv-paper'),a=frame.getBoundingClientRect(),b=paper.getBoundingClientRect();return{width:parseFloat(style.width),height:parseFloat(style.height),shape:frame.dataset.photoShape,fit:getComputedStyle(image).objectFit,inBounds:a.left>=b.left&&a.right<=b.right+1};});
async function checkMask(data,shape){const image=await loadImage(data),canvas=createCanvas(420,540);assert.equal(image.width,420);assert.equal(image.height,540);canvas.getContext('2d').drawImage(image,0,0);const context=canvas.getContext('2d');assert.equal(context.getImageData(210,0,1,1).data[3],0);assert.equal(context.getImageData(210,270,1,1).data[3],255);assert.equal(context.getImageData(5,65,1,1).data[3],shape==='square'?255:0);}
try{
 await page.setViewport({width:1600,height:1000});await page.goto(base+'/builder',{waitUntil:'networkidle0'});await page.waitForSelector('.workspace-photo-tools');await page.click('.workspace-photo-tools > summary');
 await click('Square','.photo-shape-row button');
 for(const file of fixtures){await(await input()).uploadFile(file);await page.waitForSelector('.photo-crop-ring canvas',{visible:true});await click('Apply to CV');await page.waitForSelector('.builder-right-stack .cv-passport-image');await checkMask(await photoData(),'square');}
 for(const [file,message]of [[large,'under 2 MB'],[bad,'Could not read']]){const before=await photoData();await(await input()).uploadFile(file);await page.waitForFunction(message=>document.querySelector('.photo-crop-message')?.textContent.includes(message),{},message);assert.equal(await photoData(),before,'Invalid uploads must keep the previous photo');}
 await click('Re-crop');await page.waitForSelector('.photo-crop-ring canvas',{visible:true});await page.focus('[aria-label="Photo zoom"]');await page.keyboard.press('ArrowRight');await page.focus('[aria-label="Photo brightness"]');await page.keyboard.press('ArrowLeft');await page.click('[aria-label="Move photo left"]');await click('Apply to CV');
 const saved={};
 for(const [label,shape]of [['Round','circle'],['Square','square']]){
  await click('Personal details','.workspace-sections button');await click(label,'.photo-shape-row button');await page.waitForFunction(shape=>document.querySelector('.builder-right-stack .cv-passport-frame')?.dataset.photoShape===shape,{},shape);const data=await photoData();await checkMask(data,shape);saved[shape]=data;
  await page.click('#workspace-tab-design');
  for(const category of categories){await page.$eval(`.template-card-button[value="${category.id}"]`,button=>button.click());await page.waitForFunction(id=>document.querySelector('.template-card-button.selected')?.value===id||[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Keep My Data'),{},category.id);if(await page.evaluate(()=>[...document.querySelectorAll('button')].some(button=>button.getClientRects().length&&button.textContent.trim()==='Keep My Data')))await click('Keep My Data');
   for(const layout of layouts){await click(layout.name);const result=await geometry();assert(Math.abs(result.width-35/25.4*96)<.1);assert(Math.abs(result.height-45/25.4*96)<.1);assert.equal(result.shape,shape);assert.equal(result.fit,'contain');assert(result.inBounds,category.id+'/'+layout.id+': photo outside paper');assert.equal(await photoData(),data,'Template changes must preserve the uploaded photo');}
  }
  await page.screenshot({path:path.join(output,shape+'-desktop.png')});
 }
 await click('Personal details','.workspace-sections button');
 for(const width of [1024,768,390,320]){await page.setViewport({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.$eval('.workspace-photo-tools',element=>element.scrollIntoView({behavior:'instant',block:'start'}));assert(await page.$eval('.photo-shape-row',row=>row.scrollWidth<=row.clientWidth));await page.screenshot({path:path.join(output,'photo-'+width+'.png')});}
 await page.setViewport({width:1600,height:1000});
 if(verifyExports){
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const paper=await browser.newPage();await paper.setViewport({width:1000,height:1200});
  for(const shape of ['circle','square'])for(const layout of layouts){
   const result=await page.evaluate(async({base,data,shape,layout,format})=>{const{buildCvHtml,buildCvDocxBlob}=await import(base+'/src/utils/downloads.js');const cv={fullName:'Photo Test',jobTitle:'Hotel Receptionist',email:'photo@example.com',summary:'Synthetic CV for verifying photo dimensions.',education:'Test diploma',skills:'Planning',workExperiences:[],references:{mode:'none',entries:[]},profilePhoto:data,photoShape:shape,photoFrameFormat:format};const theme={color:'#185fa5',dark:'#123c65'};const blob=await buildCvDocxBlob(cv,theme,layout);return{html:await buildCvHtml(cv,theme,layout),word:Array.from(new Uint8Array(await blob.arrayBuffer()))};},{base,data:saved[shape],shape,layout:layout.id,format:PASSPORT_PHOTO.format});
   fs.writeFileSync(path.join(output,`${shape}-${layout.id}.docx`),Buffer.from(result.word));
   await paper.setContent(result.html,{waitUntil:'load'});await paper.waitForFunction(()=>document.querySelector('.cv-passport-image')?.naturalWidth>0);
   const size=await paper.$eval('.cv-passport-frame',frame=>{const r=frame.getBoundingClientRect();return{width:r.width,height:r.height};});assert(Math.abs(size.width-35/25.4*96)<.1);assert(Math.abs(size.height-45/25.4*96)<.1);
   const bytes=await paper.pdf({path:path.join(output,`${shape}-${layout.id}.pdf`),format:'A4',printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});
   const task=pdfjs.getDocument({data:new Uint8Array(bytes)}),doc=await task.promise,first=await doc.getPage(1),viewport=first.getViewport({scale:1.5}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await first.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;fs.writeFileSync(path.join(output,`${shape}-${layout.id}-pdf.png`),canvas.toBuffer('image/png'));await task.destroy();
  }
  await paper.close();
 }
 await click('Personal details','.workspace-sections button');await click('Remove photo');assert.equal(await page.$('.builder-right-stack .cv-passport-image'),null);assert(await page.$('.photo-dropzone'));
 assert.deepEqual(errors,[]);
 console.log('PASS: JPG/PNG/WEBP upload, 35 x 45 mm masks, zoom/pan/brightness, invalid-file safety, round/square switching, all 10 categories x 4 layouts, retained photos, mobile 320-1024px, remove, '+(verifyExports?'actual browser DOCX exports and rendered PDFs.':'live UI checks without API writes.'));
}catch(error){console.log(JSON.stringify({url:page.url(),errors,message:await page.$eval('.photo-crop-message',element=>element.textContent).catch(()=>null)}));await page.screenshot({path:path.join(output,'failure.png')});throw error;}finally{await browser.close();}
