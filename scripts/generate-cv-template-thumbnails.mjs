import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { cvTemplates, resolveTemplateStyle } from "../src/data/cvTemplates.js";
import { getTemplateSample } from "../src/data/cvTemplateSamples.js";
import { renderTemplateDocument, templateDocumentModel, templateFontCss, templatePaperCss } from "../src/lib/templateDocument.js";

const output = "public/assets/cv-templates";
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  userDataDir: await fs.mkdtemp(path.join(os.tmpdir(), "bmcv-templates-")),
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1128 });
  for (const item of cvTemplates.filter(({ active }) => active)) {
    const model = templateDocumentModel({ ...getTemplateSample(item.id), showCredit: false }, resolveTemplateStyle({ templateId: item.id }));
    let fonts = templateFontCss(model.design.font);
    for (const [, file] of fonts.matchAll(/url\("(\/assets\/cv-fonts\/[^"]+)"\)/g)) {
      fonts = fonts.replace(file, "data:font/woff2;base64," + (await fs.readFile("public" + file)).toString("base64"));
    }
    await page.setContent(`<style>${fonts}${templatePaperCss}body{margin:0}.tcv-paper{zoom:.5}</style>${renderTemplateDocument(model, true).html[0]}`);
    await page.evaluate(() => document.fonts.ready);
    const sheet = await page.$(".tcv-paper");
    await sheet.screenshot({ path: `${output}/${item.id}-p1.webp`, type: "webp", quality: 88 });
  }
} finally { await browser.close(); }
