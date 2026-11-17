import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { preview } from "vite";

const output = path.resolve("artifacts/homepage-liquid-check");
await fs.mkdir(output, { recursive: true });
const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    userDataDir: await fs.mkdtemp(path.join(output, "browser-")),
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluateOnNewDocument(() => localStorage.setItem("bmcv:analytics-consent:v1", "rejected"));
  await page.setRequestInterception(true);
  page.on("request", (req) => req.url().startsWith(base + "/") || /^data:|^blob:/.test(req.url()) ? req.continue() : req.abort());
  const go = (route) => page.goto(base + route, { waitUntil: "networkidle0" });
  const assertFits = async (route) => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route + " has horizontal overflow");
  const assertGlass = async (selector = ".site-header") => {
    const background = await page.$eval(selector, (header) => {
      const style = getComputedStyle(header);
      return [style.backgroundColor, style.backdropFilter];
    });
    assert.deepEqual(background, ["rgba(160, 221, 230, 0.72)", "blur(18px) saturate(1.6)"]);
  };
  const assertCurrent = async (selector, href) => {
    assert.equal(await page.$eval(selector, (link) => link.getAttribute("href")), href);
    assert.equal(await page.$eval(selector, (link) => getComputedStyle(link).borderBottomColor), "rgb(20, 20, 20)");
  };
  const wave = '.hm-liquid-wave[data-tone="improve"] path';
  const wavePath = () => page.$eval(wave, (element) => element.getAttribute("d"));

  await page.setViewport({ width: 1440, height: 960 });
  await go("/");
  await assertGlass();
  assert.equal(await page.$eval(".hm-hero h1", (h1) => h1.textContent), "Make your CV job-ready today.");
  assert(await page.evaluate(async () => (await document.fonts.load("700 52px Jost"))[0]?.status === "loaded"));
  assert.equal(await page.$eval(".site-build-cta", (el) => getComputedStyle(el).backgroundColor), "rgb(215, 38, 30)");
  assert.equal(await page.$eval(".site-logo-badge", (el) => getComputedStyle(el).backgroundColor), "rgb(20, 20, 20)");
  await assertFits("/");
  await page.screenshot({ path: path.join(output, "home-desktop.png") });
  await page.mouse.move(133, 240);
  await page.mouse.move(329, 300);
  await page.waitForFunction(() => Number(document.querySelector(".hm-liquid-cursor").style.opacity) > 0.8);
  assert.equal(await page.$eval(".hm-liquid-cursor", (svg) => getComputedStyle(svg).pointerEvents), "none");
  assert.equal(await page.$eval(".hm-liquid-cursor", (svg) => svg.getBoundingClientRect().width), 320);
  await page.screenshot({ path: path.join(output, "home-cursor.png") });
  await page.hover(".site-build-cta");
  await page.waitForFunction(() => Number(document.querySelector(".hm-liquid-cursor").style.opacity) < 0.01);
  await page.click(".hm-motion-settings summary");
  await page.focus('input[aria-label="Liquid thickness"]');
  await page.keyboard.press("End");
  assert.equal(await page.$eval(".hm-motion-settings output", (el) => el.textContent), "100%");
  await page.focus('input[aria-label="Wave strength"]');
  await page.keyboard.press("Home");
  await page.$eval(wave, (el) => el.closest("svg").scrollIntoView({ block: "start" }));
  await page.waitForFunction((selector) => document.querySelector(selector).getAttribute("d").startsWith("M0 28.0 C60 28.0"), {}, wave);
  await page.focus('input[aria-label="Wave strength"]');
  await page.keyboard.press("End");
  await page.click(".hm-motion-settings summary");
  await page.$eval(wave, (el) => el.closest("svg").scrollIntoView({ block: "center" }));
  assert(await page.$eval(wave, (el) => el.closest("svg").clientWidth >= innerWidth - 2));
  const start = await wavePath();
  await page.waitForFunction((selector, previous) => document.querySelector(selector).getAttribute("d") !== previous, {}, wave, start);
  const transform = await page.$eval(".hm-liquid-shapes i", (el) => el.style.transform);
  await page.evaluate(() => scrollBy(0, 240));
  await page.waitForFunction((previous) => document.querySelector(".hm-liquid-shapes i").style.transform !== previous, {}, transform);
  await page.screenshot({ path: path.join(output, "home-waves-desktop.png") });
  await page.click(".hm-motion-control > button");
  const paused = await wavePath();
  await page.$eval(wave, (el) => el.closest("svg").scrollIntoView({ block: "center" }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(await wavePath(), paused);
  assert.equal(await page.$eval(".hm-liquid-shapes i", (el) => el.style.transform), "");
  await page.click(".hm-motion-control > button");

  for (const [route, active] of [
    ["/templates/", "/templates"], ["/faq/", "/faq"], ["/blog/", "/blog"],
    ["/blog/visa-status-on-cv-uae/", "/blog"], ["/about/"], ["/contact/"], ["/privacy/"], ["/terms/"], ["/cv-examples/"], ["/for-ofw/"],
  ]) {
    await go(route);
    await assertGlass();
    await assertFits(route);
    assert.equal(await page.$eval(".site-build-cta", (link) => link.getAttribute("href")), "/builder");
    if (active) await assertCurrent('.site-header-nav [aria-current="page"]', active);
  }
  await page.click(".site-build-cta");
  await page.waitForSelector(".builder-topbar");
  await assertGlass(".builder-topbar");
  await page.click(".builder-download-button");
  await page.waitForFunction(() => document.body.innerText.includes("Verify to download"));

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await go("/");
  await assertFits("mobile homepage");
  await page.tap(".site-header-menu summary");
  await page.waitForSelector(".site-header-menu[open] .site-header-dropdown");
  assert.equal(await page.$$eval(".site-header-dropdown a", (links) => links.length), 5);
  await page.screenshot({ path: path.join(output, "home-mobile-menu.png") });
  await page.tap(".site-header-dropdown a[href='/#improve']");
  await page.waitForFunction(() => location.hash === "#improve");
  assert.equal(await page.$eval(".site-header-menu", (menu) => menu.open), false);
  assert.equal(await page.$eval(".hm-liquid-cursor", (svg) => getComputedStyle(svg).display), "none");
  await page.$eval(wave, (el) => el.closest("svg").scrollIntoView({ block: "center" }));
  const mobileWave = await wavePath();
  await page.waitForFunction((selector, previous) => document.querySelector(selector).getAttribute("d") !== previous, {}, wave, mobileWave);
  await page.screenshot({ path: path.join(output, "home-mobile.png") });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await go("/");
  await page.$eval(wave, (el) => el.closest("svg").scrollIntoView({ block: "center" }));
  const calm = await wavePath();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(await wavePath(), calm);
  assert.equal(await page.$eval(".hm-liquid-shapes i", (el) => el.style.transform), "");
  assert.equal(await page.$eval(".hm-motion-control", (el) => getComputedStyle(el).display), "none");
  await go("/blog/visa-status-on-cv-uae/");
  await assertFits("mobile static article");
  await page.tap(".site-header-menu summary");
  await assertCurrent('.site-header-dropdown [aria-current="page"]', "/blog");
  await go("/builder");
  await assertGlass(".builder-topbar");
  await assertFits("mobile builder");

  assert.deepEqual(errors, []);
  console.log("PASS: site-wide glass navigation, active links, mobile menu, Jost, cursor, sliders, scroll response, pause, reduced motion and builder download dialog.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
