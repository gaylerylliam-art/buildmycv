import mammoth from 'mammoth';
import yauzl from 'yauzl';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { loadImage } from '@napi-rs/canvas';
import { MAX_CV_BYTES, validateUploadFile } from '../../../src/lib/cvImportSchema.js';
import { ImportError, boundedText } from './errors.js';
const require = createRequire(import.meta.url);
const MAX_PAGES = 12;
export function decodeUpload({
  fileName,
  data
}) {
  if (typeof data !== 'string' || data.length > Math.ceil(MAX_CV_BYTES / 3) * 4 || data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(data)) throw new ImportError('INVALID_FILE', 'The uploaded file is corrupted or too large.', 400);
  const buffer = Buffer.from(data, 'base64');
  if (buffer.toString('base64') !== data) throw new ImportError('INVALID_FILE', 'The uploaded file is corrupted.', 400);
  try {
    validateUploadFile({
      name: fileName,
      size: buffer.length
    });
  } catch (error) {
    throw new ImportError('INVALID_FILE', error.message, 400);
  }
  const extension = fileName.toLowerCase().split('.').pop();
  const expected = extension === 'pdf' ? buffer.subarray(0, 5).toString() === '%PDF-' : extension === 'docx' ? buffer.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) : extension === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (!expected) {
    if (extension === 'docx' && buffer.subarray(0, 8).equals(Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]))) throw new ImportError('PASSWORD', 'This Word file is password-protected or uses an unsupported encrypted format. Save an unprotected DOCX copy.');
    throw new ImportError('SIGNATURE', 'The file contents do not match its extension. It may be corrupted.');
  }
  return {
    buffer,
    extension,
    mime: extension === 'pdf' ? 'application/pdf' : extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : extension === 'png' ? 'image/png' : 'image/jpeg'
  };
}
async function validateDocxZip(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, {
      lazyEntries: true,
      validateEntrySizes: true,
      strictFileNames: true
    }, (error, zip) => {
      if (error) return reject(new ImportError('CORRUPT_DOCX', 'This DOCX file is corrupted. Please save a fresh copy.'));
      let total = 0,
        count = 0,
        hasDocument = false,
        stopped = false;
      const links = [];
      const fail = error => {
        if (stopped) return;
        stopped = true;
        zip.close();
        reject(error instanceof ImportError ? error : new ImportError('CORRUPT_DOCX', 'This DOCX file is corrupted.'));
      };
      zip.on('error', fail);
      zip.on('end', () => {
        if (stopped) return;
        if (!hasDocument) return fail(new ImportError('CORRUPT_DOCX', 'This ZIP is not a valid DOCX document.'));
        resolve({
          links
        });
      });
      zip.on('entry', entry => {
        if (entry.generalPurposeBitFlag & 1) return fail(new ImportError('PASSWORD', 'Password-protected Word files cannot be imported. Save an unprotected copy.'));
        if (++count > 300 || entry.uncompressedSize > 8 * 1024 * 1024 || total + entry.uncompressedSize > 20 * 1024 * 1024) return fail(new ImportError('DOCX_LIMIT', 'This Word document expands beyond the safe processing limit. Save a simpler copy.'));
        if (/vbaProject|embeddings\/|\.exe$/i.test(entry.fileName)) return fail(new ImportError('UNSAFE_DOCX', 'Embedded programs and macros are not supported. Save a clean DOCX copy.'));
        if (entry.fileName === 'word/document.xml') hasDocument = true;
        if (entry.fileName.endsWith('/')) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (error, stream) => {
          if (error) return fail(error);
          let size = 0;
          const xmlChunks = [];
          stream.on('error', fail);
          stream.on('data', chunk => {
            total += chunk.length;
            size += chunk.length;
            if (total > 20 * 1024 * 1024 || size > 8 * 1024 * 1024) {
              stream.destroy();
              return fail(new ImportError('DOCX_LIMIT', 'This Word document expands beyond the safe processing limit.'));
            }
            if (/\.(xml|rels)$/i.test(entry.fileName)) xmlChunks.push(chunk);
          });
          stream.on('end', () => {
            if (stopped) return;
            if (xmlChunks.length && /<!DOCTYPE|<!ENTITY/i.test(Buffer.concat(xmlChunks).toString('utf8'))) return fail(new ImportError('UNSAFE_XML', 'This Word document contains unsupported XML declarations. Save a clean copy.'));
            if (/\.rels$/i.test(entry.fileName)) {
              const xml = Buffer.concat(xmlChunks).toString('utf8');
              for (const tag of xml.match(/<Relationship\b[^>]*>/g) || []) {
                if (!/\/hyperlink["']/.test(tag)) continue;
                const target = tag.match(/\bTarget=["']([^"']*)["']/)?.[1];
                if (!target) continue;
                const decoded = target.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_match, code) => {
                  const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
                  return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
                });
                if (/^(https?:|mailto:|tel:)/i.test(decoded) && decoded.length <= 2048) links.push(decoded);
              }
            }
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

// Keep lines separate and detect a gutter before choosing column order. Ambiguous layouts use vision OCR.
export function orderPdfText(items, pageWidth) {
  const words = items.filter(item => typeof item.str === 'string' && item.str.trim()).map(item => ({
    text: item.str,
    x: item.transform[4],
    y: item.transform[5],
    width: item.width || 0,
    rtl: item.dir === 'rtl'
  }));
  const lines = new Map();
  for (const word of words) {
    const y = Math.round(word.y / 3) * 3;
    const row = lines.get(y) || [];
    row.push(word);
    lines.set(y, row);
  }
  let multiColumn = words.filter(word => word.x < pageWidth * .45).length >= 3 && words.filter(word => word.x > pageWidth * .55).length >= 3;
  const text = [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => {
    row.sort((a, b) => a.x - b.x);
    if (row.some((word, i) => i && word.x - (row[i - 1].x + row[i - 1].width) > pageWidth * .12)) multiColumn = true;
    const rtl = row.filter(item => item.rtl).length > row.length / 2;
    if (rtl) row.reverse();
    return row.map(word => word.text).join(' ');
  }).join('\n');
  return {
    text: boundedText(text),
    multiColumn
  };
}
function imageDimensions(buffer, extension) {
  if (extension === 'png' && buffer.length >= 24) return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  let i = 2;
  while (i + 8 < buffer.length) {
    if (buffer[i++] !== 255) break;
    while (buffer[i] === 255) i++;
    const marker = buffer[i++];
    if ([0xd8, 0xd9, 0x01].includes(marker)) continue;
    const size = buffer.readUInt16BE(i);
    if (size < 2 || i + size > buffer.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return [buffer.readUInt16BE(i + 5), buffer.readUInt16BE(i + 3)];
    i += size;
  }
  throw new ImportError('CORRUPT_IMAGE', 'This image is corrupted or cannot be decoded.');
}
export async function extractDocument(upload, provider, signal) {
  const {
    buffer,
    extension,
    mime
  } = decodeUpload(upload);
  if (signal?.aborted) throw new ImportError('CANCELLED', 'Processing was cancelled.', 499);
  if (extension === 'docx') {
    const archive = await validateDocxZip(buffer);
    let result;
    try {
      result = await mammoth.extractRawText({
        buffer
      }, {
        externalFileAccess: false
      });
    } catch {
      throw new ImportError('CORRUPT_DOCX', 'The Word document could not be read. Please save a fresh DOCX copy.');
    }
    const text = boundedText([result.value, ...[...new Set(archive.links)].filter(link => !result.value.includes(link))].join('\n'));
    if (!text) throw new ImportError('EMPTY_DOCX', 'No embedded text was found in this Word file. Export it as a PDF for OCR.');
    return {
      text,
      pages: [{
        pageNumber: 1,
        text,
        embeddedText: text,
        method: 'embedded'
      }],
      warnings: ['DOCX embedded images are not transcribed. If your CV text is inside images, export it as a PDF for OCR.']
    };
  }
  if (extension !== 'pdf') {
    const [width, height] = imageDimensions(buffer, extension);
    if (!width || !height || width * height > 16000000 || width > 12000 || height > 12000) throw new ImportError('IMAGE_LIMIT', 'The image is too large to process safely. Resize it to at most 16 megapixels.');
    try {
      await loadImage(buffer);
    } catch {
      throw new ImportError('CORRUPT_IMAGE', 'The image could not be decoded. Upload a fresh JPG or PNG copy.');
    }
    const result = await provider.ocr({
      buffer,
      mime,
      pageCount: 1,
      signal
    });
    const text = boundedText(result.pages[0].text);
    if (!text) throw new ImportError('EMPTY_OCR', 'No readable text was found. Try a sharper, well-lit image.');
    return {
      text,
      pages: [{
        pageNumber: 1,
        text,
        embeddedText: '',
        method: 'ocr'
      }],
      warnings: [...result.warnings, 'OCR can misread names and numbers. Check the source carefully.']
    };
  }
  // Do not execute document actions, embedded scripts, XFA, fonts or attachments.
  if (/\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/.test(buffer.toString('latin1'))) throw new ImportError('UNSAFE_PDF', 'This PDF contains active content or attachments. Print it to a clean PDF before uploading.');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
  let task, document;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      enableXfa: false,
      disableFontFace: true,
      useSystemFonts: false,
      maxImageSize: 16000000,
      stopAtErrors: true,
      verbosity: 0
    });
    document = await task.promise;
    if (document.numPages > MAX_PAGES) throw new ImportError('PAGE_LIMIT', 'Upload a CV with no more than 12 pages.');
    const embedded = [];
    let needsVision = false;
    for (let number = 1; number <= document.numPages; number++) {
      if (signal?.aborted) throw new ImportError('CANCELLED', 'Processing was cancelled.', 499);
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const ordered = orderPdfText(content.items, page.getViewport({
        scale: 1
      }).width);
      const links = (await page.getAnnotations({
        intent: 'display'
      })).map(item => item.url || item.unsafeUrl || '').filter(link => /^(https?:|mailto:|tel:)/i.test(link) && link.length <= 2048);
      ordered.text = boundedText([ordered.text, ...[...new Set(links)].filter(link => !ordered.text.includes(link))].join('\n'));
      const operators = await page.getOperatorList();
      const images = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageXObjectRepeat, pdfjs.OPS.paintImageMaskXObject]);
      const hasImage = operators.fnArray.some(op => images.has(op));
      const ocr = ordered.text.length < 60 || hasImage || ordered.multiColumn;
      needsVision ||= ocr;
      embedded.push({
        pageNumber: number,
        text: ordered.text,
        embeddedText: ordered.text,
        method: ocr ? 'ocr' : 'embedded'
      });
      page.cleanup();
    }
    let warnings = [];
    if (needsVision) {
      const result = await provider.ocr({
        buffer,
        mime,
        pageCount: document.numPages,
        signal
      });
      warnings = [...result.warnings, 'Some pages required visual OCR or layout analysis. Check names, dates and reading order.'];
      for (let i = 0; i < embedded.length; i++) {
        if (embedded[i].method !== 'ocr') continue;
        const text = boundedText(result.pages[i].text);
        if (!text) throw new ImportError('OCR_EMPTY_PAGE', `No readable text was found on page ${i + 1}. Remove blank pages or upload a clearer copy. No partial CV was imported.`);
        embedded[i].text = text;
      }
    }
    const folded = value => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    const text = boundedText(embedded.map(page => {
      const ocr = folded(page.text);
      const retained = page.method === 'ocr' ? page.embeddedText.split('\n').filter(line => line.trim() && !ocr.includes(folded(line))) : [];
      return [page.text, ...retained].join('\n');
    }).join('\n\n'));
    if (!text) throw new ImportError('EMPTY_PDF', 'No readable CV text was found. Try a clearer PDF or image.');
    return {
      text,
      pages: embedded,
      warnings
    };
  } catch (error) {
    if (error instanceof ImportError) throw error;
    if (error.name === 'PasswordException') throw new ImportError('PASSWORD', 'This PDF is password-protected. Save an unprotected copy before uploading.');
    throw new ImportError('CORRUPT_PDF', 'This PDF is corrupted or uses an unsupported format. Save a fresh PDF copy.');
  } finally {
    if (task) await task.destroy();
  }
}
