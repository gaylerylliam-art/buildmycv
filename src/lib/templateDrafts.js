import { resolveTemplateStyle } from "../data/cvTemplates.js";

const prefix = "bmcv:template-draft:";
const expiry = 15 * 86400000;
export function makeTemplateDraft(style, contentSource, id = crypto.randomUUID()) {
  if (!["sample", "blank", "existing_cv"].includes(contentSource)) throw new Error("INVALID_CONTENT_SOURCE");
  return { id, style: resolveTemplateStyle(style), contentSource, expiresAt: Date.now() + expiry };
}

export function storeTemplateDraft(draft, cv, categoryId, ownerId = null) {
  const record = { ...draft, cv, categoryId, ownerId };
  (ownerId ? sessionStorage : localStorage).setItem(prefix + draft.id, JSON.stringify(record));
  return `/builder?cv=${encodeURIComponent(draft.id)}`;
}

export function readTemplateDraft(id) {
  if (!/^[a-f0-9-]{36}$/i.test(id || "") || !globalThis.localStorage) return null;
  try {
    const record = JSON.parse(sessionStorage.getItem(prefix + id) ?? localStorage.getItem(prefix + id));
    if (!record || !Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now()) {
      localStorage.removeItem(prefix + id);
      sessionStorage.removeItem(prefix + id);
      return null;
    }
    return { ...record, style: resolveTemplateStyle(record.style) };
  } catch { return null; }
}

export function updateTemplateDraft(id, cv, categoryId) {
  const record = readTemplateDraft(id);
  if (!record) return;
  const { cv: _, ...draft } = record;
  storeTemplateDraft(draft, cv, categoryId, record.ownerId);
}
