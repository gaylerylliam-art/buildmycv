import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createServer } from "vite";
import { cvTemplates } from "../src/data/cvTemplates.js";
import { preparePdfHtml } from "../netlify/functions/export-pdf.js";

const server = process.env.PREVIEW_URL ? null : await createServer({ server: { host: "127.0.0.1", port: 0, hmr: false, ws: false } });
await server?.listen();
const base = process.env.PREVIEW_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = path.resolve("artifacts/templates-and-guides-check");
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  userDataDir: await fs.mkdtemp(path.join(output, "browser-")), headless: true,
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("bmcv:analytics-consent:v1", "rejected");
    localStorage.setItem("bmcv_milestones", "[50,80,100]");
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => req.url().includes("/.netlify/functions/export-pdf")
    ? req.respond({ status: 503, body: "Synthetic export outage" })
    : req.url().startsWith(base) || req.url().startsWith("data:") || req.url().startsWith("blob:") ? req.continue() : req.abort());
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base + "/templates", { waitUntil: "networkidle0" });
  await page.waitForSelector(".tpl-preview .tcv-paper");
  assert.equal(await page.$$eval(".tpl-option", (items) => items.length), 5);
  assert(await page.$$eval(".tpl-thumbnail img", (images) => images.every((img) => img.complete && img.naturalHeight > 0)));
  for (const item of cvTemplates) {
    await page.$$eval(".tpl-option", (items, name) => items.find((button) => button.querySelector("strong").textContent === name).click(), item.name);
    await page.waitForFunction((layout) => {
      const sheets = [...document.querySelectorAll(".tpl-preview .tcv-paper")];
      return sheets.length === 2 && sheets.every((sheet) => sheet.dataset.layout === layout);
    }, {}, item.layout);
  }
  await page.$$eval(".tpl-option", (items) => items[1].click());
  await page.select(".tpl-settings select", "sample");
  const fill = async (selector, value) => {
    await page.$eval(selector, (el) => el.scrollIntoView({ block: "center" }));
    await page.click(selector);
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type(selector, value);
  };
  await fill(".tpl-custom input[type=text]", "#EEEEEE");
  assert.equal(await page.$eval(".tpl-custom input[type=text]", (item) => item.value), "#EEEEEE");
  await page.waitForFunction(() => document.querySelector(".tpl-controls").textContent.includes("Very light colour"));
  await page.$$eval(".tpl-fonts button", (buttons) => buttons.find((button) => button.textContent.includes("EB Garamond")).click());
  await page.waitForFunction(() => [...document.querySelectorAll(".tpl-preview .tcv-paper")].every((sheet) =>
    sheet.style.getPropertyValue("--tcv-accent") === "#EEEEEE" && sheet.style.getPropertyValue("--tcv-font").includes("EB Garamond")));
  await page.screenshot({ path: path.join(output, "templates-desktop.png"), fullPage: true });
  const navigation = page.waitForNavigation({ waitUntil: "networkidle0" });
  await page.click(".tpl-settings button.tpl-primary");
  await navigation;
  assert.match(page.url(), /\/builder\?cv=/);
  await page.waitForSelector(".builder-right-stack .tcv-paper");
  assert.equal(await page.$$eval(".builder-right-stack .tcv-paper", (items) => items.length), 2);
  const candidate = '#builder-section-personal input[placeholder="Example: Juan Dela Cruz"]';
  assert.equal(await page.$eval(candidate, (input) => input.value), "Priya Nair");
  await page.click(".builder-download-button");
  await page.waitForFunction(() => document.querySelector(".tpl-warning[role=alert]")?.textContent.includes("Replace"));
  await fill(candidate, "Synthetic Candidate");
  await fill("#builder-section-personal input[type=email]", "updated@example.com");
  await fill("#builder-section-personal input[type=tel]", "+1 202 555 0125");
  await page.click("#workspace-tab-design");
  await page.select(".workspace-design-settings .tpl-controls select", "timeline");
  await page.waitForFunction(() => document.querySelector(".builder-right-stack .tcv-paper")?.dataset.layout === "timeline");
  assert.match(await page.$eval(".builder-right-stack .tcv-paper", (item) => item.textContent), /Synthetic Candidate/);
  await page.waitForFunction(() => {
    const id = new URLSearchParams(location.search).get("cv");
    return JSON.parse(localStorage.getItem("bmcv:template-draft:" + id)).cv.fullName === "Synthetic Candidate";
  });
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.$eval(candidate, (input) => input.value), "Synthetic Candidate");

  const { html, docx, previewCount } = await page.evaluate(async () => {
    const id = new URLSearchParams(location.search).get("cv");
    const { cv } = JSON.parse(localStorage.getItem("bmcv:template-draft:" + id));
    const { buildCvHtml, buildCvDocxBlob } = await import("/src/utils/downloads.js");
    const blob = await buildCvDocxBlob(cv);
    return { html: await buildCvHtml(cv), docx: Array.from(new Uint8Array(await blob.arrayBuffer())),
      previewCount: document.querySelectorAll(".builder-right-stack .tcv-paper").length };
  });
  assert.match(html, /data:font\/woff2;base64,/);
  assert.deepEqual(docx.slice(0, 2), [80, 75]);
  const printer = await browser.newPage();
  await printer.emulateMediaType("print");
  await printer.setContent(preparePdfHtml(html));
  const pdfBytes = await printer.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  await printer.close();
  const task = getDocument({ data: new Uint8Array(pdfBytes) });
  try {
    const pdf = await task.promise;
    assert.equal(pdf.numPages, previewCount);
    const first = (await (await pdf.getPage(1)).getTextContent()).items.map((item) => item.str).join(" ");
    assert.match(first, /Synthetic Candidate/);
    await fs.writeFile(path.join(output, "template-export.pdf"), pdfBytes);
    await fs.writeFile(path.join(output, "template-export.docx"), Buffer.from(docx));
  } finally { await task.destroy(); }
  const fallbackDir = await fs.mkdtemp(path.join(output, "fallback-"));
  const cdp = await page.createCDPSession();
  await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: fallbackDir });
  await page.evaluate(async (source) => {
    const { downloadPdfFromHtml } = await import("/src/utils/downloads.js");
    await downloadPdfFromHtml(source, "template-fallback.pdf", 0);
  }, html);
  let fallbackBytes;
  for (let i = 0; i < 80 && !fallbackBytes; i++) {
    const bytes = await fs.readFile(path.join(fallbackDir, "template-fallback.pdf")).catch(() => null);
    if (bytes?.subarray(-100).includes("%%EOF")) fallbackBytes = bytes;
    else await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(fallbackBytes, "Browser fallback download did not complete");
  const fallback = getDocument({ data: new Uint8Array(fallbackBytes) });
  try {
    const pdf = await fallback.promise;
    assert.equal(pdf.numPages, previewCount, "Fallback page count must match preview");
    for (let index = 1; index <= previewCount; index++) {
      const sheet = await pdf.getPage(index);
      const viewport = sheet.getViewport({ scale: 0.5 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await sheet.render({ canvasContext: context, viewport }).promise;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      assert(pixels.some((channel, i) => i % 4 === 0 && channel < 85), "Fallback page has no visible ink");
    }
  }
  finally { await fallback.destroy(); }

  await page.goto(base + "/blog/", { waitUntil: "networkidle0" });
  const { counts, topics } = await page.evaluate(async () => {
    const { blogCatalog, blogTopics } = await import("/src/content/blogCatalog.js");
    return { topics: blogTopics, counts: Object.fromEntries(blogTopics.map(({ id }) => [id, blogCatalog.filter((article) => article.topic === id).length])) };
  });
  const card = ".bl-flash:first-child";
  await page.waitForSelector(card);
  assert.equal(await page.$$eval(".bl-flash", (items) => items.length), 9);
  await page.$eval(card, (item) => item.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.hover(card + " .bl-flash-tag");
  await page.waitForSelector(card + '[data-open="true"]');
  await page.waitForFunction((selector) => {
    const turn = document.querySelector(selector + " .bl-flash-turn");
    return new DOMMatrix(getComputedStyle(turn).transform).m11 < -0.98;
  }, {}, card);
  await page.screenshot({ path: path.join(output, "blog-hover.png") });
  await page.hover(".bl-results");
  await page.waitForSelector(card + '[data-open="false"]');
  await page.$eval(card + " button", (button) => button.focus());
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.classList.contains("bl-flash-read"));
  await page.keyboard.press("Escape");
  await page.waitForSelector(card + '[data-open="false"]');
  assert(await page.$eval(card + " button", (button) => button === document.activeElement));
  for (const { id, label } of topics.filter((item) => item.id !== "all")) {
    await page.$$eval(".bl-topics button", (items, label) => items.find((button) => button.textContent === label).click(), label);
    const expected = Math.min(9, counts[id]);
    assert(expected > 0, label + " has no articles");
    await page.waitForFunction((count) => document.querySelectorAll(".bl-flash").length === count, {}, expected);
  }
  await page.type('input[type=search]', "nofoundtest123");
  await page.waitForSelector(".bl-empty");

  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + "/blog/", { waitUntil: "networkidle0" });
  await page.tap(card + " button");
  await page.waitForSelector(card + '[data-open="true"]');
  assert.equal(await page.$eval(".bl-guide-ring", (item) => getComputedStyle(item).display), "none");
  const readLink = card + " .bl-flash-read";
  const readUrl = await page.$eval(readLink, (link) => {
    const style = getComputedStyle(link);
    if (style.color === style.backgroundColor) throw new Error("Guide link has no visible foreground contrast");
    return link.href;
  });
  await page.screenshot({ path: path.join(output, "blog-mobile.png") });
  await Promise.all([page.waitForNavigation(), page.tap(readLink)]);
  assert.equal(page.url().replace(/\/$/, ""), readUrl.replace(/\/$/, ""));
  for (const route of ["/blog/", "/templates"]) {
    await page.goto(base + route, { waitUntil: "networkidle0" });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route + " overflows on mobile");
  }
  await page.screenshot({ path: path.join(output, "templates-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS: five layouts, two-page previews, colour/font, editable handoff, sample guard, PDF/Word generation and browser PDF fallback, blog hover/keyboard/touch, filters, reduced motion and mobile fit.");
} finally { await browser.close(); await server?.close(); }
