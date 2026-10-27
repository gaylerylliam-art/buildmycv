export class ImportError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export const env = key => globalThis.Netlify?.env?.get(key) ?? process.env[key];
export function boundedText(text) {
  const value = String(text).replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
  if (value.length > 60000) throw new ImportError('TEXT_LIMIT', 'This CV has too much text. Upload a shorter document (maximum 60,000 characters).');
  return value;
}
