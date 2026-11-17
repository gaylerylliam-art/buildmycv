import assert from "node:assert/strict";
import { test } from "node:test";
import { cvTemplates, getTemplateDesign, resolveTemplateStyle } from "../src/data/cvTemplates.js";
import { getTemplateSample, getTemplateSampleStatus } from "../src/data/cvTemplateSamples.js";
import { templateDocumentModel, renderTemplateDocument } from "../src/lib/templateDocument.js";
import catalog, { prepareTemplateDraft } from "../netlify/functions/cv-templates.js";

test("all five templates have editable samples and two-page previews", () => {
  for (const template of cvTemplates) {
    const cv = getTemplateSample(template.id);
    const model = templateDocumentModel(cv, resolveTemplateStyle({ templateId: template.id }));
    const { html } = renderTemplateDocument(model, true);
    assert.equal(html.length, 2);
    assert.match(html[0], /Page 1 of 2/);
    assert.match(html[1], /Page 2 of 2/);
    assert.doesNotMatch(html[1], /tcv-portrait/);
    assert.match(cv.email, /@example\.com$/);
  }
});

test("colour, light accent contrast, invalid font and invalid template validation", async () => {
  assert.equal(resolveTemplateStyle({ templateId: "classic", accentColor: "#abc" }).accentColor, "#AABBCC");
  assert.equal(getTemplateDesign({ templateId: "classic", accentColor: "#fff" }).onAccent, "#111827");
  for (const [config, error] of [
    [{ templateId: "unknown" }, "INVALID_TEMPLATE"],
    [{ templateId: "classic", accentColor: "red" }, "INVALID_COLOR"],
    [{ templateId: "classic", fontId: "unknown" }, "INVALID_FONT"],
    [{ templateId: "classic", showPhoto: "false" }, "INVALID_PHOTO_SETTING"],
  ]) {
    const response = await prepareTemplateDraft(new Request("https://example.com/api/cvs/from-template", {
      method: "POST", body: JSON.stringify(config),
    }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error });
  }
  const response = await prepareTemplateDraft(new Request("https://example.com/api/cvs/from-template", {
    method: "POST", body: JSON.stringify({ templateId: "sidebar", accentColor: "#fff", fontId: "garamond", contentSource: "sample" }),
  }));
  assert.equal(response.status, 201);
  const { draft, cvId, builderUrl, warnings } = await response.json();
  assert.deepEqual(warnings, ["LOW_CONTRAST_ADJUSTED"]);
  assert.equal(draft.style.fontId, "garamond");
  assert.equal(builderUrl, `/builder?cv=${cvId}`);
  const list = catalog(new Request("https://example.com/api/templates"), { params: {} });
  assert.equal((await list.json()).templates.length, 5);
  assert.equal(list.headers.get("cache-control"), "public, max-age=3600");
});

test("flag unchanged sample contact details and escape user data in all layouts", () => {
  const cv = { ...getTemplateSample("sidebar"), sampleTemplateId: "sidebar" };
  assert.deepEqual(getTemplateSampleStatus(cv).personal, ["fullName", "email", "phone"]);
  assert.deepEqual(getTemplateSampleStatus({ ...cv, fullName: "TEST", email: "new@example.com", phone: "555-0100" }).personal, []);
  const injected = { ...cv, fullName: "<script>alert(1)</script>", summary: "Arabic content: \u0627\u0644\u0644\u063a\u0629", profilePhoto: "javascript:alert(1)" };
  for (const item of cvTemplates) {
    const model = templateDocumentModel(injected, resolveTemplateStyle({ templateId: item.id }));
    const { html } = renderTemplateDocument(model, true);
    assert.match(html[0], /dir="rtl"/);
    assert.match(html[0], /&lt;script&gt;/);
    assert.doesNotMatch(html.join(""), /<script>|javascript:/);
  }
});
