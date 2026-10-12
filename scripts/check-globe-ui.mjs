import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const baseUrl = process.env.PREVIEW_URL || "http://127.0.0.1:5174";
const output = path.resolve("artifacts/globe-review");
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", userDataDir: await fs.mkdtemp(path.join(output, "browser-")), headless: true, args: ["--enable-unsafe-swiftshader", "--no-first-run"] });
const page = await browser.newPage(), errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.setRequestInterception(true);
page.on("request", (request) => request.url().startsWith(baseUrl) || request.url().startsWith("data:") ? request.continue() : request.abort());
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const imagePixels = async (png) => page.evaluate(async (url) => {
  const image = new Image(); image.src = url; await image.decode();
  const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let colored = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 1] - data[i] > 15 || data[i + 2] - data[i] > 15) colored++;
  return colored;
}, `data:image/png;base64,${Buffer.from(png).toString("base64")}`);
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["tablet", 768, 900], ["mobile", 390, 844], ["small-mobile", 320, 720]]) {
    await page.setViewport({ width, height });
    await page.goto(baseUrl, { waitUntil: "networkidle0" });
    await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent === "I understand")?.click());
    assert.equal(await page.$(".hm-globe-stage canvas"), null, "Globe must defer WebGL initialization until visible");
    await page.$eval(".hm-globe-stage", (element) => element.scrollIntoView({ block: "center" }));
    await page.waitForSelector(".hm-globe-pause", { timeout: 20000 });
    const stage = await page.$(".hm-globe-stage");
    const first = await stage.screenshot();
    assert(await imagePixels(first) > 1500, `${name}: globe is blank`);
    await delay(700);
    const moving = await stage.screenshot();
    assert(!Buffer.from(first).equals(Buffer.from(moving)), `${name}: globe does not rotate`);
    await page.click('button[aria-label="Pause globe animation"]');
    await page.$eval(".hm-globe-stage", (element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await delay(350);
    const paused = await stage.screenshot();
    await delay(450);
    assert(Buffer.from(paused).equals(Buffer.from(await stage.screenshot())), `${name}: pause does not stop rendering`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
    const bounds = await stage.boundingBox();
    assert(bounds.width > 250 && bounds.width <= width && Math.abs(bounds.width - bounds.height) < 2, `${name}: globe framing`);
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    await page.click('button[aria-label="Play globe animation"]');
    await delay(400);
    assert(!Buffer.from(paused).equals(Buffer.from(await stage.screenshot())), `${name}: resume does not restart`);
    if (name === "desktop") {
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await page.waitForFunction(() => !document.querySelector(".hm-globe-pause"));
      const reduced = await stage.screenshot(); await delay(400);
      assert(Buffer.from(reduced).equals(Buffer.from(await stage.screenshot())), "Reduced motion must be still");
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    }
  }
  await page.setJavaScriptEnabled(false);
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  assert(await page.$eval(".hm-globe-fallback", (image) => image.complete && image.naturalWidth > 0), "No-JS still image missing");
  await page.setJavaScriptEnabled(true);
  await page.setRequestInterception(false);
  page.removeAllListeners("request");
  await page.setRequestInterception(true);
  page.on("request", (request) => request.url().includes("globe-land-points") || !request.url().startsWith(baseUrl) ? request.abort() : request.continue());
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  await page.$eval(".hm-globe-stage", (element) => element.scrollIntoView({ block: "center" }));
  await delay(800);
  assert(await page.$eval(".hm-globe-fallback", (image) => getComputedStyle(image).visibility === "visible"), "Failed asset needs a visible fallback");
  assert.deepEqual(errors, []);
  console.log("PASS: deferred loading, nonblank geographic globe, rotation, pause/resume, reduced motion, responsive bounds, no-JS and failed-asset fallbacks.");
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
