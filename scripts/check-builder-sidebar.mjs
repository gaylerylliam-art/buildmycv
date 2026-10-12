import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const baseUrl = process.env.PREVIEW_URL || "http://127.0.0.1:5174";
const output = path.resolve("artifacts/sidebar-review");
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => request.url().startsWith(baseUrl) || request.url().startsWith("data:") ? request.continue() : request.abort());
  await page.evaluateOnNewDocument(() => localStorage.setItem("cvforall:cookie-notice", "accepted"));
  for (const [width, height] of [[1440, 1000], [1024, 768], [1920, 1080], [390, 844], [320, 720]]) {
    await page.setViewport({ width, height });
    await page.goto(`${baseUrl}/builder?start=upload&category=finance`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".builder-layout-v2");
    const selector = width > 900 ? ".builder-sidebar-v2" : ".builder-template-dock-mobile";
    const result = await page.$eval(selector, (panel) => {
      const panelRect = panel.getBoundingClientRect();
      const cards = [...panel.querySelectorAll(".template-card-button")];
      const overflowing = [...panel.querySelectorAll(".template-card-button, .template-card-name, .template-card-sub, .template-card-badge, .sidebar-swatch, .builder-color-strip button")].filter((item) => {
        const rect = item.getBoundingClientRect();
        return rect.left < panelRect.left - 1 || rect.right > panelRect.right + 1;
      }).map((item) => item.textContent.trim());
      return { count: cards.length, overflowing, scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth };
    });
    assert.equal(result.count, 10, `${width}px: missing categories`);
    assert.deepEqual(result.overflowing, [], `${width}px: category labels or options extend outside panel`);
    assert(result.scrollWidth <= result.clientWidth + 1, `${width}px: panel needs horizontal scrolling`);
    if (width > 900) {
      assert(await page.$eval(".builder-right-stack", (item) => item.getBoundingClientRect().right <= innerWidth + 1), `${width}px: preview off screen`);
      await page.$eval(selector, (panel) => { panel.scrollTop = panel.querySelector(".template-card-grid").offsetTop - panel.offsetTop; });
    }
    await page.screenshot({ path: path.join(output, `builder-${width}.png`) });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/builder?start=upload&category=finance`, { waitUntil: "networkidle0" });
  await page.click('.builder-sidebar-v2 button[value="engineering"]');
  await page.evaluate(() => [...document.querySelectorAll("button")].find((item) => /keep my data/i.test(item.textContent))?.click());
  await page.waitForSelector('.builder-sidebar-v2 button[value="engineering"][aria-pressed="true"]');
  await page.click('.builder-sidebar-v2 button[title="Green"]');
  await page.waitForSelector('.builder-sidebar-v2 button[title="Green"].selected');
  assert.deepEqual(errors, []);
  console.log("PASS: all 10 categories and colour options fit at 320/390/1024/1440/1920px; desktop preview stays on screen; category and colour selection work.");
} finally {
  await browser.close();
}
