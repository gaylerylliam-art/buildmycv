import { MAX_CV_BYTES } from './cvImportSchema.js';
const endpoint = '/.netlify/functions/cvImport';
export async function startImportSession(signal) {
  const response = await fetch(endpoint, {
    signal,
    credentials: 'same-origin',
    cache: 'no-store'
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.message || 'CV processing is unavailable. Please try again later.');
}
export function uploadCv(file, {
  signal,
  onUploaded,
  onProgress
}) {
  if (file.size > MAX_CV_BYTES) return Promise.reject(new Error('The maximum file size is 3 MB.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader(),
      xhr = new XMLHttpRequest();
    const abort = () => {
      reader.abort();
      xhr.abort();
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, {
      once: true
    });
    const cleanup = () => signal?.removeEventListener('abort', abort);
    if (signal?.aborted) {
      abort();
      cleanup();
      return;
    }
    reader.onerror = () => {
      cleanup();
      reject(new Error('This file could not be read. Choose a fresh copy.'));
    };
    reader.onload = () => {
      if (signal?.aborted) return;
      xhr.open('POST', endpoint);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 58000;
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
      };
      xhr.upload.onload = () => onUploaded?.();
      xhr.onerror = () => {
        cleanup();
        reject(new Error('The upload connection failed. Your file is kept in this tab. Retry when connected.'));
      };
      xhr.ontimeout = () => {
        cleanup();
        reject(new Error('Extraction timed out. Try again or use a shorter CV.'));
      };
      xhr.onabort = () => {
        cleanup();
        reject(new DOMException('Cancelled', 'AbortError'));
      };
      xhr.onload = () => {
        cleanup();
        let result;
        try {
          result = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error('The server returned an unreadable response. Please retry.'));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && result.ok) resolve(result);else {
          const error = new Error(result.message || 'The CV could not be processed. Please retry.');
          error.code = result.code;
          reject(error);
        }
      };
      xhr.send(JSON.stringify({
        operation: 'extract',
        fileName: file.name,
        data: String(reader.result).split(',')[1]
      }));
    };
    reader.readAsDataURL(file);
  });
}
export async function organizeCv(source, signal) {
  const timeout = AbortSignal.timeout(58000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.any([signal, timeout].filter(Boolean)),
      body: JSON.stringify({
        operation: 'organize',
        text: source.source.text,
        receipt: source.receipt
      })
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(timeout.aborted ? 'Organizing timed out. Your extracted text is kept for retry.' : 'The connection was interrupted. Your extracted text is kept for retry.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const error = new Error(result?.message || 'Organizing the CV failed. Your extracted text is kept for retry.');
    error.code = result?.code;
    throw error;
  }
  return result;
}
export function clearImportSession() {
  return fetch(endpoint, {
    method: 'DELETE',
    credentials: 'same-origin'
  }).catch(() => {});
}
