import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const baseUrl = process.env.PREVIEW_URL || "http://127.0.0.1:5174";
const executablePath = process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const output = path.resolve("artifacts/homepage-review");
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, userDataDir: fs.mkdtempSync(path.join(output, "browser-")), headless: true, args: ["--disable-gpu", "--no-first-run"] });
const errors = [];
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on("request", (request) => request.url().startsWith(baseUrl) || request.url().startsWith("data:") ? request.continue() : request.abort());
page.on("pageerror", (error) => errors.push(error.message));
await page.evaluateOnNewDocument(() => localStorage.setItem("cvforall:cookie-notice", "accepted"));
const clickText = async (text) => {
  const found = await page.evaluate((text) => {
    const element = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === text);
    element?.click();
    return Boolean(element);
  }, text);
  assert(found, `Missing button: ${text}`);
};
const rectangles = () => page.evaluate(() => [...document.querySelectorAll(".hm-nav, .hm-hero, #templates, #how-it-works")].map((item) => {
  const { width, height } = item.getBoundingClientRect();
  return { width: Math.round(width), height: Math.round(height) };
}));
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setJavaScriptEnabled(false);
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  const staticRects = await rectangles();
  const staticH1 = await page.$eval("h1", (item) => item.textContent);
  await page.screenshot({ path: path.join(output, "desktop-static.png"), fullPage: true });
  await page.setJavaScriptEnabled(true);
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.$eval("h1", (item) => item.textContent), staticH1);
  assert.deepEqual(await rectangles(), staticRects, "Static and React homepage layout differs");
  assert.equal(await page.$$eval(".hm-template", (items) => items.length), 6);
  await clickText("Mechanical Engineer");
  assert.match(await page.$eval(".hm-example-paper img", (item) => item.src), /mechanical-engineer/);
  await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
  await page.screenshot({ path: path.join(output, "desktop-top.png") });
  await page.select(".hm-filter select", "finance");
  assert.equal(await page.$$eval(".hm-template", (items) => items.length), 1);
  await page.click(".hm-template-preview");
  await page.waitForSelector('[role="dialog"]');
  assert.equal(await page.$eval("#hm-preview-title", (item) => item.textContent), "Finance");
  await page.keyboard.press("Escape");
  assert.equal(await page.$('[role="dialog"]'), null);
  assert(await page.$eval(".hm-template-preview", (item) => item === document.activeElement));
  await page.select(".hm-filter select", "all");
  await clickText("Explore all 10 job categories");
  assert.equal(await page.$$eval(".hm-template", (items) => items.length), 10);
  for (const [name, width, height] of [["tablet", 1024, 768], ["mobile", 390, 844], ["small-mobile", 320, 720]]) {
    await page.setViewport({ width, height });
    await page.goto(baseUrl, { waitUntil: "networkidle0" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `${name}: horizontal overflow`);
    const imagesLoaded = await page.$$eval(".hm-example-paper img", (items) => items.every((item) => item.complete && item.naturalWidth > 0));
    assert(imagesLoaded, `${name}: CV image missing`);
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    await page.screenshot({ path: path.join(output, `${name}-top.png`) });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  await page.select(".hm-filter select", "finance");
  await page.click(".hm-template-use");
  await page.waitForFunction(() => location.pathname === "/builder");
  assert.match(page.url(), /category=finance/);
  await clickText("Skip and open builder");
  await page.waitForSelector(".builder-layout-v2");
  assert.match(await page.$eval(".builder-sidebar-v2 .template-card-button.selected", (item) => item.textContent), /Finance/);
  assert(await page.evaluate(() => [...document.querySelectorAll(".builder-form-inner button")].some((item) => item.textContent.includes("Classic single-column") && item.className.includes("bg-blue-50"))), "Selected layout was not passed into the builder");
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  await page.click('.hm-actions a[href="/builder?start=upload"]');
  await page.waitForSelector(".builder-layout-v2");
  assert.match(await page.$eval(".builder-form-inner", (item) => item.textContent), /Upload & Translate CV/);
  await page.goto(`${baseUrl}/builder?access=save`, { waitUntil: "networkidle0" });
  assert.match(await page.evaluate(() => document.body.textContent), /Continue without cloud saving/);
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log("PASS: static/React parity, desktop/tablet/mobile, CV image switch, category filter, preview keyboard handling, template selection, upload and account entry routes.");
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
