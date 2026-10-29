import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { CV_FIELDS } from "../src/lib/cvImportSchema.js";
import { docxFixture } from "../tests/cv-import/fixtures.mjs";

const baseUrl = process.env.PREVIEW_URL || "http://127.0.0.1:5180";
assert(["127.0.0.1", "localhost"].includes(new URL(baseUrl).hostname), "Mocked import tests must run locally");
const output = path.resolve("artifacts/builder-workspace-review");
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true, userDataDir: await fs.mkdtemp(path.join(output, "browser-")) });
const page = await browser.newPage(), errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const imported = {
  fullName: "Taylor Example", jobTitle: "Hotel Receptionist", email: "taylor@example.com", phone: "+1 202 555 0142", country: "Worldwide",
  summary: "Experienced receptionist supporting front desk operations and welcoming guests with care.", education: "Diploma in Hospitality", skills: "Guest relations, Scheduling", languages: "English", originalLanguage: "English", outputLanguage: "English", languageDirection: "ltr",
  workExperiences: [
    { id: "sample-role-1", jobTitle: "Receptionist", employer: "Example Hotel", companyLocation: "London", fromDate: "2023", toDate: "Present", responsibilities: "Welcomed guests and coordinated daily bookings.", achievements: "" },
    { id: "sample-role-2", jobTitle: "Guest Assistant", employer: "Example Resort", companyLocation: "London", fromDate: "2021", toDate: "2023", responsibilities: "Answered enquiries and arranged guest requests.", achievements: "" },
  ],
};
await page.setRequestInterception(true);
page.on("request", async (request) => {
  if (request.url().includes("/.netlify/functions/cvImport")) {
    const operation = request.postData() ? JSON.parse(request.postData()).operation : null;
    const cv = { ...Object.fromEntries(Object.keys(CV_FIELDS).map(key => [key, imported[key] || ""])), location: imported.country, languageDirection: "ltr", uncertainties: [], workExperiences: imported.workExperiences.map(({ id, achievements, ...entry }) => ({ ...entry, isCurrent: entry.toDate === "Present" })) };
    const result = operation === "extract" ? { ok: true, importId: "synthetic-workspace-import", receipt: "test-only", source: { text: "Synthetic CV", pages: [{pageNumber: 1, method: "embedded", text: "Synthetic CV"}], warnings: [] } } : operation === "organize" ? { ok: true, cv } : { ok: true };
    return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  }
  if (request.url().includes("/.netlify/functions/translateCv")) return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, cv: imported }) });
  if (request.url().includes("/.netlify/functions/")) return request.abort();
  return request.url().startsWith(baseUrl) || request.url().startsWith("data:") || request.url().startsWith("blob:") ? request.continue() : request.abort();
});
await page.evaluateOnNewDocument(() => {
  localStorage.setItem("cvforall:cookie-notice", "accepted");
  localStorage.setItem("bmcv_milestones", "[50,80,100]");
});
const clickText = async (text, selector = "button") => {
  assert(await page.evaluate(({ text, selector }) => {
    const button = [...document.querySelectorAll(selector)].find((item) => item.getClientRects().length && item.textContent.replace(/\s+/g, " ").trim() === text);
    button?.click(); return Boolean(button);
  }, { text, selector }), `Missing visible button: ${text}`);
};
const section = async (name) => { await clickText(name, ".workspace-sections button"); await page.waitForFunction((name) => document.querySelector('.workspace-sections [aria-current="step"]')?.textContent.trim() === name, {}, name); };
const mode = (name) => page.click(`[role="tab"][id="workspace-tab-${name}"]`);
const fill = async (label, value) => {
  const input = await page.evaluateHandle((label) => [...document.querySelectorAll(".form-label")].find((item) => item.textContent === label && item.closest("label")?.getClientRects().length)?.closest("label")?.querySelector("input,textarea"), label);
  assert(input.asElement(), `Missing visible input: ${label}`);
  await input.asElement().evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await input.asElement().click(); await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control");
  await page.keyboard.press("Backspace"); await input.asElement().type(value);
};
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/builder?start=upload`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".builder-workspace");
  await page.click("#workspace-tab-content");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.$eval("#workspace-tab-design", (button) => button.getAttribute("aria-selected")), "true");
  await page.keyboard.press("ArrowLeft");
  assert(await page.$eval("html", (element) => element.classList.contains("dark")), "New users default to the reference's dark appearance");
  await section("Personal details");
  await page.screenshot({ path: path.join(output, "desktop-dark.png") });
  await fill("Full name", "Morgan Example");
  await page.waitForFunction(() => document.querySelector(".builder-right-stack .cv-paper-page").textContent.includes("Morgan Example"));
  await mode("design");
  assert.equal(await page.$$eval(".workspace-design-templates .template-card-button", (items) => items.length), 10);
  await clickText("Header-focused layout");
  assert(await page.$eval(".builder-right-stack .cv-paper-page > header", (header) => Boolean(header.style.background)));
  await clickText("1 inch");
  assert.equal(await page.$eval(".builder-right-stack .cv-paper-page", (paper) => paper.style.padding), "96px");
  await page.screenshot({ path: path.join(output, "desktop-design.png") });
  await mode("ai");
  await page.waitForSelector(".workspace-ai-panel .ats-job-field textarea", { visible: true });
  await page.type(".workspace-ai-panel .ats-job-field textarea", "Hotel receptionist with scheduling, guest relations and communication skills.");
  await page.screenshot({ path: path.join(output, "desktop-ai.png") });
  await section("Personal details");
  assert.equal(await page.$eval('#builder-section-personal input[placeholder="Example: Juan Dela Cruz"]', (input) => input.value), "Morgan Example", "Mode changes must retain edits");
  await page.click('button[aria-label="Light"]');
  await page.screenshot({ path: path.join(output, "desktop-light.png") });
  await page.reload({ waitUntil: "networkidle0" });
  assert(!(await page.$eval("html", (element) => element.classList.contains("dark"))), "Saved light preference must be preserved");
  await page.click('button[aria-label="Dark"]');
  await clickText("Upload & translate", ".workspace-sidebar-tools button");
  await clickText("Upload CV");
  const fixture = path.join(output, "synthetic-cv.docx");
  await fs.writeFile(fixture, await docxFixture());
  const input = await page.$('.cv-import-browse input'); await input.uploadFile(fixture);
  await page.waitForSelector('.cv-import-review');
  await page.click('.cv-import-confirm input');
  await clickText('Confirm and import reviewed CV');
  await page.waitForSelector('.cv-import-success');
  await section("Work history");
  assert.equal(await page.$$eval('#builder-section-experience .entry-card', (items) => items.length), 2);
  await clickText("Example Hotel", ".entry-card-title");
  await fill("Employer name", "Edited Hotel");
  await clickText("Add another role");
  assert.equal(await page.$$eval('#builder-section-experience .entry-card', (items) => items.length), 3);
  await clickText("Remove role");
  assert.equal(await page.$$eval('#builder-section-experience .entry-card', (items) => items.length), 2);
  await clickText("Move down");
  assert.match(await page.$eval('#builder-section-experience .entry-card-header', (button) => button.textContent), /Example Resort/);
  await clickText("Move up");
  assert.match(await page.$eval('#builder-section-experience .entry-card-header', (button) => button.textContent), /Edited Hotel/);
  await page.screenshot({ path: path.join(output, "desktop-experience.png") });
  await clickText("Save online", ".workspace-account");
  await page.waitForSelector('[aria-label="Close sign-in dialog"]');
  await page.click('[aria-label="Close sign-in dialog"]');
  await clickText("Cover letter", ".workspace-documents button");
  await page.waitForFunction(() => !document.querySelector(".builder-workspace"));
  await clickText("CV Builder", ".builder-type-switch button");
  await page.waitForSelector(".builder-workspace");
  await page.click(".builder-download-button");
  await page.waitForSelector('[aria-label="Close download dialog"]');
  assert.equal(await page.$$eval("button", (items) => items.find((button) => button.textContent === "Download DOCX").disabled), true, "Existing OTP gate must remain enabled");
  await page.click('[aria-label="Close download dialog"]');
  for (const [width, height] of [[1920,1080],[1280,800],[1024,768],[768,1024],[390,844],[320,720]]) {
    await page.setViewport({ width, height });
    await section("Personal details");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}: page overflow`);
    const overflow = await page.$$eval(".builder-topbar button,.workspace-tabs button,.workspace-editor-footer button,.builder-form-panel-v2 input:not([type=file])", (items) => items.filter((item) => item.getClientRects().length).some((item) => {
      const r = item.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;
    }));
    assert.equal(overflow, false, `${width}: controls extend outside viewport`);
    assert(await page.evaluate(() => document.querySelector('.builder-logo').getBoundingClientRect().right <= document.querySelector('.builder-topbar-actions').getBoundingClientRect().left + 1), `${width}: header actions overlap the brand`);
    if (width > 1100) assert(await page.$eval(".builder-right-stack .cv-paper-page", (paper) => { const a=paper.getBoundingClientRect(), b=paper.closest(".preview-sheet-scroll").getBoundingClientRect(); return a.width <= b.width && a.right <= b.right+1; }), `${width}: default preview must fit`);
    await page.screenshot({ path: path.join(output, `workspace-${width}.png`) });
    if (width <= 1100) {
      await clickText("Preview", ".mobile-builder-tabbar button");
      await page.waitForSelector(".mobile-sheet");
      await page.waitForFunction(() => { const paper=document.querySelector(".mobile-sheet .cv-paper-page"), sheet=document.querySelector(".mobile-sheet .preview-sheet-scroll"); return paper.getBoundingClientRect().width <= sheet.clientWidth; });
      await page.screenshot({ path: path.join(output, `preview-${width}.png`) });
      await clickText("Close", ".mobile-sheet button");
      if (width === 390) {
        await page.click(".workspace-account-menu summary");
        await clickText("Sign in to save online", ".workspace-account-menu button");
        await page.waitForSelector('[aria-label="Close sign-in dialog"]');
        assert(await page.$eval('[aria-label="Close sign-in dialog"]', (button) => { const box=button.getBoundingClientRect(); return box.top>=0 && box.bottom <= innerHeight; }), "Mobile sign-in dialog close control must remain visible");
        await page.click('[aria-label="Close sign-in dialog"]');
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log("PASS: workspace modes, native preview edits, design/margins, ATS editing, theme preference, mocked editable CV import, OTP gate, and responsive desktop/tablet/mobile controls.");
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
