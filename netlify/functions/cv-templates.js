import { cvTemplates, templateColors, templateFonts, getTemplateDesign } from "../../src/data/cvTemplates.js";
import { getTemplateSample } from "../../src/data/cvTemplateSamples.js";
import { makeTemplateDraft } from "../../src/lib/templateDrafts.js";

export const config = { path: ["/api/templates", "/api/templates/:id/sample"] };
const cached = { "Cache-Control": "public, max-age=3600" };

export default function templates(request, context) {
  if (request.method !== "GET") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "GET" } });
  if (context.params.id) {
    const id = context.params.id;
    const sample = cvTemplates.some((item) => item.id === id && item.active) ? getTemplateSample(id) : null;
    return sample ? Response.json({ sample }, { headers: cached }) : Response.json({ error: "INVALID_TEMPLATE" }, { status: 404 });
  }
  return Response.json({ templates: cvTemplates.filter((item) => item.active).map((item) => ({
    ...item, thumbnailUrl: `/assets/cv-templates/${item.id}-p1.webp`,
  })), colorPresets: templateColors.map(({ value }) => value), fonts: templateFonts }, { headers: cached });
}

export async function prepareTemplateDraft(request) {
  const headers = { "Cache-Control": "no-store" };
  if (request.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { ...headers, Allow: "POST" } });
  try {
    const raw = await request.text();
    if (raw.length > 2048) return Response.json({ error: "INVALID_BODY" }, { status: 413, headers });
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_BODY");
    const draft = makeTemplateDraft(input, input.contentSource ?? "sample");
    return Response.json({
      draft, cvId: draft.id, builderUrl: `/builder?cv=${draft.id}`,
      warnings: getTemplateDesign(draft.style).warning ? ["LOW_CONTRAST_ADJUSTED"] : [],
    }, { status: 201, headers });
  } catch (error) {
    return Response.json({ error: /^INVALID_[A-Z_]+$/.test(error.message) ? error.message : "INVALID_BODY" }, { status: 400, headers });
  }
}
