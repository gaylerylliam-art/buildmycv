import {createCanvas} from '@napi-rs/canvas';
import {Document,Packer,Paragraph,TextRun} from 'docx';
import {CV_FIELDS} from '../../src/lib/cvImportSchema.js';
export const sourceText='Amina Test\nSupport Engineer\namina@example.com\n+971 50 123 4567\nDubai\nExample Systems\n2020\n2024\nResolved 120 support tickets.\nBSc Computer Science\nTest University\nNetworking\nEnglish\nArabic\nCommunity mentor\nExcellence Award\nPortfolio migration\nUnclassified note';
export const arabicText='أمينة أحمد\nمهندسة دعم\nدبي\nشركة الاختبار\nاللغة العربية';
export function sampleCv(overrides={}) {
  return {...Object.fromEntries(Object.keys(CV_FIELDS).map(key=>[key,''])),fullName:'Amina Test',jobTitle:'Support Engineer',email:'amina@example.com',phone:'+971 50 123 4567',location:'Dubai',skills:'Networking',education:'BSc Computer Science\nTest University',languages:'English\nArabic',projects:'Portfolio migration',awards:'Excellence Award',volunteerExperience:'Community mentor',unclassifiedContent:'Unclassified note',originalLanguage:'English',languageDirection:'ltr',workExperiences:[{jobTitle:'Support Engineer',employer:'Example Systems',companyLocation:'Dubai',fromDate:'2020',toDate:'2024',isCurrent:false,responsibilities:'Resolved 120 support tickets.'}],uncertainties:[],...overrides};
}
export function imageFixture(format='png',text='Amina Test') {
  const canvas=createCanvas(600,200),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,600,200);ctx.fillStyle='black';ctx.font='24px Arial';ctx.fillText(text,20,60);ctx.fillText('Support Engineer - amina@example.com',20,110);
  return canvas.toBuffer(format==='png'?'image/png':'image/jpeg');
}
const escaped=text=>text.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
export function pdfFixture(kinds=['digital'],{columns=false,arabic=false,encrypted=false,link=""}={}) {
  const objects=[];const add=value=>{objects.push(Buffer.isBuffer(value)?value:Buffer.from(value));return objects.length;};
  const stream=(dict,data)=>Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`),data,Buffer.from('\nendstream')]);
  add('<< /Type /Catalog /Pages 2 0 R >>');add('');
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let arabicFont;
  if(arabic){
    const chars=[...new Set(arabicText.replace(/\n/g,''))];
    const map='begincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Test def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n'+chars.length+' beginbfchar\n'+chars.map(c=>{const h=c.charCodeAt(0).toString(16).padStart(4,'0');return `<${h}> <${h}>`;}).join('\n')+'\nendbfchar\nendcmap';
    const cmap=add(stream('',Buffer.from(map)));
    const desc=add('<< /Type /FontDescriptor /FontName /Arial /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>');
    const cid=add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Arial /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /DW 600 >>`);
    arabicFont=add(`<< /Type /Font /Subtype /Type0 /BaseFont /Arial /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${cmap} 0 R >>`);
  }
  const pages=[];
  for(const kind of kinds){
    let image;
    if(kind==='scanned'||kind==='mixed'){const jpeg=imageFixture('jpeg');image=add(stream('/Type /XObject /Subtype /Image /Width 600 /Height 200 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',jpeg));}
    let content='';
    if(kind!=='scanned'){
      if(arabic){content=arabicText.split('\n').map((line,i)=>`BT /F2 12 Tf 300 ${740-i*22} Td <${[...line].reverse().map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('')}> Tj ET`).join('\n');}
      else{content=sourceText.split('\n').map((line,i)=>`BT /F1 12 Tf 50 ${740-i*22} Td (${escaped(line)}) Tj ET`).join('\n');if(columns)content+='\nBT /F1 12 Tf 360 740 Td (Secondary Column) Tj ET\nBT /F1 12 Tf 360 718 Td (Extra qualification) Tj ET';}
    }
    if(image)content+='\nq 500 0 0 160 50 300 cm /Im1 Do Q';
    const commands=add(stream('',Buffer.from(content)));
    const annotation=link?add(`<< /Type /Annot /Subtype /Link /Rect [50 700 150 720] /A << /S /URI /URI (${escaped(link)}) >> >>`):null;
    const page=add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R ${arabicFont?`/F2 ${arabicFont} 0 R`:''} >> ${image?`/XObject << /Im1 ${image} 0 R >>`:''} >> /Contents ${commands} 0 R ${annotation?`/Annots [${annotation} 0 R]`:""} >>`);pages.push(page);
  }
  objects[1]=Buffer.from(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(id=>`${id} 0 R`).join(' ')}] >>`);
  let encryption;
  if(encrypted)encryption=add('<< /Filter /Standard /V 1 /R 2 /Length 40 /O <'+'00'.repeat(32)+'> /U <'+'00'.repeat(32)+'> /P -4 >>');
  let output=Buffer.from('%PDF-1.4\n'),offsets=[0];objects.forEach((object,i)=>{offsets.push(output.length);output=Buffer.concat([output,Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from('\nendobj\n')]);});
  const xref=output.length;output=Buffer.concat([output,Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R ${encryption?`/Encrypt ${encryption} 0 R /ID [<00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff>]`:''} >>\nstartxref\n${xref}\n%%EOF`)]);return output;
}
export async function docxFixture(text=sourceText){return Packer.toBuffer(new Document({sections:[{children:text.split('\n').map(line=>new Paragraph({children:[new TextRun(line)]}))}]}));}
export const upload=(buffer,name)=>({fileName:name,data:buffer.toString('base64')});
// Test double only. Production always calls a configured real provider.
export function fixtureProvider({text=sourceText,failOcr=false,failOrganize=false}={}) {
  const calls=[];return {calls,
    async ocr(input){calls.push({operation:'ocr',mime:input.mime,pages:input.pageCount});if(failOcr)throw new Error('Synthetic OCR failure');return {pages:Array.from({length:input.pageCount},(_,i)=>({pageNumber:i+1,text})),warnings:['Synthetic fixture transcription; not a live OCR accuracy test.']};},
    async organize(){calls.push({operation:'organize'});if(failOrganize)throw new Error('Synthetic organize failure');return sampleCv();},
  };
}
