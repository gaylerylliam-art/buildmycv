import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { homeCvExamples } from "../src/data/homeCvExamples.js";
import { categories, layouts, themes } from "../src/data/categories.js";

const baseUrl = process.env.PREVIEW_URL || "http://127.0.0.1:5174";
assert(new URL(baseUrl).hostname === "127.0.0.1" || new URL(baseUrl).hostname === "localhost", "Generate examples locally, never against a visitor's production session");
const output = path.resolve("public/assets/cv-examples");
await fs.mkdir(output, { recursive: true });
await fs.mkdir("artifacts/cv-example-review", { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true, userDataDir: await fs.mkdtemp("artifacts/cv-example-review/browser-") });
const page = await browser.newPage(), snapshot = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
for (const tab of [page, snapshot]) {
  await tab.setViewport({ width: 1440, height: 1400 });
  await tab.setRequestInterception(true);
  tab.on("request", (request) => request.url().startsWith(baseUrl) || request.url().startsWith("data:") || request.url() === "about:blank" ? request.continue() : request.abort());
}
await page.evaluateOnNewDocument(() => localStorage.setItem("cvforall:cookie-notice", "accepted"));
const cssFiles = (await fs.readdir("dist/assets")).filter((file) => file.endsWith(".css"));
const css = (await Promise.all(cssFiles.map((file) => fs.readFile(path.join("dist/assets", file), "utf8")))).join("\n");
try {
  for (const example of homeCvExamples) {
    assert(categories.some((item) => item.id === example.id));
    assert(layouts.some((item) => item.id === example.layout));
    assert(themes.some((item) => item.id === example.theme));
    await page.goto(`${baseUrl}/builder?start=upload&category=${example.id}&layout=${example.layout}&theme=${example.theme}`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".cv-paper-page");
    await page.evaluate(() => {
      for (const title of ["Education and certifications", "Skills and languages", "Professional summary"]) {
        const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim().startsWith(title));
        if (button?.getAttribute("aria-expanded") !== "true") button?.click();
      }
    });
    await page.waitForFunction(() => [...document.querySelectorAll(".form-label")].some((item) => item.textContent === "Professional summary / objective"));
    const fields = {
      "Full name": example.person,
      "Job title": example.role,
      "Contact email": "name@example.com",
      "Contact number": "+1 202 555 0142",
      Country: "Worldwide",
      Nationality: "", "Visa status": "", "Driving license": "",
      "Job title / position": example.role,
      "Employer name": "Example employer",
      "Date employed from": "2023", "Date employed to": "Present",
      "Company location": "",
      "Responsibilities / achievements": `${example.duty}\nWorked with colleagues to maintain quality and reliable service.`,
      Education: "Relevant qualification\nCollege / training provider",
      "Certifications & licenses": "",
      Skills: `${example.skill}, Communication, Organisation`,
      "Languages spoken": "English",
      "Professional summary / objective": `Dependable ${example.role.toLowerCase()} with a practical approach to supporting teams and delivering quality work.`,
    };
    await page.evaluate((fields) => {
      for (const [label, value] of Object.entries(fields)) {
        const caption = [...document.querySelectorAll(".form-label")].find((item) => item.textContent === label);
        const input = caption?.closest("label")?.querySelector("input,textarea");
        if (!input) throw new Error(`Missing example form field: ${label}`);
        const prototype = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, fields);
    await page.waitForFunction((example) => {
      const paper = document.querySelector(".cv-paper-page");
      return paper.textContent.includes(example.person) && paper.textContent.includes(example.duty) && paper.textContent.includes("College / training provider");
    }, {}, example);
    const paper = await page.$eval(".cv-paper-page", (element) => element.outerHTML);
    // Keep native CV markup and compiled builder CSS, removing only surrounding UI.
    await snapshot.setContent(`<html><head><style>${css}</style><style>html,body{margin:0;background:white;scroll-behavior:auto!important;} .builder-app-shell{display:block;padding:0;min-height:0;} .cv-paper{margin:0;box-shadow:none;}</style></head><body><main class="builder-app-shell">${paper}</main></body></html>`);
    await snapshot.evaluate(() => document.fonts.ready);
    const documentElement = await snapshot.$(".cv-paper-page");
    const bounds = await documentElement.boundingBox();
    assert.equal(bounds.width, 794);
    assert.equal(bounds.height, 1123);
    await documentElement.screenshot({ path: path.join(output, path.basename(example.image)) });
    await fs.writeFile(path.join("artifacts/cv-example-review", `${example.id}.html`), paper);
    console.log(`Captured actual builder: ${example.category} / ${example.name}`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
