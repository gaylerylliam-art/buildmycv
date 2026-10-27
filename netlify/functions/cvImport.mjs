import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { extractDocument } from '../lib/cv-import/extract.js';
import { groundCv, openAIImportProvider } from '../lib/cv-import/provider.js';
import { ImportError, env, boundedText } from '../lib/cv-import/errors.js';
const COOKIE = 'bmcv_import_session';
const MAX_BODY = 4.3 * 1024 * 1024;
const response = (status, data, headers = {}) => Response.json(data, {
  status,
  headers: {
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  }
});
const secretKey = () => {
  const key = env('CV_IMPORT_SIGNING_SECRET');
  if (!key || key.length < 32) throw new ImportError('NOT_CONFIGURED', 'CV upload is not configured. Please contact support or enter your CV manually.', 503);
  return key;
};
const signature = text => createHmac('sha256', secretKey()).update(text).digest('base64url');
export function signImportToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${signature(data)}`;
}
export function verifyImportToken(token) {
  try {
    const [data, sig, extra] = String(token || '').split('.');
    if (!data || !sig || extra || token.length > 1500) throw new Error();
    const expected = Buffer.from(signature(data)),
      actual = Buffer.from(sig);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) throw new Error();
    return payload;
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError('SESSION_EXPIRED', 'Your private upload session expired. Retry to start a new session; the file remains in this tab.', 401);
  }
}
const digest = text => createHash('sha256').update(text).digest('hex');
async function readBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ImportError('CONTENT_TYPE', 'Send this upload as JSON.', 415);
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new ImportError('BODY_LIMIT', 'The upload exceeds the 3 MB file limit.', 413);
  if (!request.body) throw new ImportError('INVALID_REQUEST', 'The upload is empty.', 400);
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.length;
      if (length > MAX_BODY) {
        await reader.cancel();
        throw new ImportError('BODY_LIMIT', 'The upload exceeds the 3 MB file limit.', 413);
      }
      chunks.push(Buffer.from(item.value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ImportError('INVALID_REQUEST', 'The upload request could not be read.', 400);
  }
}
export function createCvImportHandler(provider = openAIImportProvider) {
  return async function cvImport(request) {
    try {
      const url = new URL(request.url);
      const processingSignal = AbortSignal.any([request.signal, AbortSignal.timeout(50000)]);
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new ImportError('ORIGIN', 'Open the CV builder on this website before uploading.', 403);
      if (request.method === 'GET') {
        const existing = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
        if (existing) {
          try {
            const payload = verifyImportToken(existing);
            if (payload.type === 'session' && payload.exp > Date.now() + 120000) return response(200, {
              ok: true
            });
          } catch (error) {
            if (error.code === 'NOT_CONFIGURED') throw error;
          }
        }
        const token = signImportToken({
          id: randomUUID(),
          type: 'session',
          exp: Date.now() + 30 * 60000
        });
        return response(200, {
          ok: true
        }, {
          'Set-Cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/.netlify/functions/cvImport; Max-Age=1800${url.protocol === 'https:' ? '; Secure' : ''}`
        });
      }
      if (request.method === 'DELETE') return response(200, {
        ok: true
      }, {
        'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/.netlify/functions/cvImport; Max-Age=0${url.protocol === 'https:' ? '; Secure' : ''}`
      });
      if (request.method !== 'POST') return response(405, {
        ok: false,
        code: 'METHOD',
        message: 'Use POST to process a CV.'
      }, {
        Allow: 'GET, POST, DELETE'
      });
      if (!origin) throw new ImportError('ORIGIN', 'Upload from the CV builder on this website.', 403);
      const cookie = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
      const session = verifyImportToken(cookie);
      if (session.type !== 'session') throw new ImportError('SESSION_EXPIRED', 'Start a new upload session.', 401);
      const payload = await readBody(request);
      if (payload.operation === 'extract') {
        const source = await extractDocument(payload, provider, processingSignal);
        const id = randomUUID();
        const receipt = signImportToken({
          id,
          type: 'source',
          owner: session.id,
          hash: digest(source.text),
          exp: Date.now() + 30 * 60000
        });
        return response(200, {
          ok: true,
          source,
          receipt,
          importId: id
        });
      }
      if (payload.operation === 'organize') {
        const receipt = verifyImportToken(payload.receipt);
        const text = boundedText(payload.text);
        if (receipt.type !== 'source' || receipt.owner !== session.id || receipt.hash !== digest(text)) throw new ImportError('SOURCE_MISMATCH', 'This extraction belongs to another upload session. Reprocess the retained file.', 403);
        if (!text) throw new ImportError('NO_TEXT', 'No readable text was extracted.');
        const cv = groundCv(await provider.organize({
          text,
          signal: processingSignal
        }), text);
        return response(200, {
          ok: true,
          cv,
          importId: receipt.id
        });
      }
      throw new ImportError('OPERATION', 'Unknown processing operation.', 400);
    } catch (error) {
      // Never return provider responses, file names, source text, headers, or document contents in errors or logs.
      if (error instanceof ImportError) return response(error.status, {
        ok: false,
        code: error.code,
        message: error.message
      });
      return response(500, {
        ok: false,
        code: 'PROCESSING_FAILED',
        message: 'The CV could not be processed. No builder data was changed. Please retry.'
      });
    }
  };
}
export default createCvImportHandler();
export const config = {
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['ip'],
    windowSize: 60,
    windowLimit: 20
  }
};
