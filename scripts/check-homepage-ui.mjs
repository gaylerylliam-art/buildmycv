import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { homeCvExamples } from "../src/data/homeCvExamples.js";
import { categories, layouts, themes } from "../src/data/categories.js";
import { HOME_VIDEO } from "../src/content/homepage.js";

const baseUrl = process.env.PREVIEW_URL || "http://127.0.0.1:5174";
const executablePath = process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const output = path.resolve("artifacts/homepage-review");
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, userDataDir: fs.mkdtempSync(path.join(output, "browser-")), headless: true, args: ["--disable-gpu", "--no-first-run"] });
const errors = [];
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
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
const checkOfficeSections = async (label) => {
  const scroll = await page.evaluate(() => ({ left: scrollX, top: scrollY }));
  const photo = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/assets/office-background.jpg';
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  assert.deepEqual(photo, [1600, 1200], 'Office photograph did not load');
  for (const id of ['how-it-works', 'faq']) {
    const background = await page.$eval('#' + id, section => getComputedStyle(section).backgroundImage);
    assert(background.includes('/assets/office-background.jpg'), id + ': missing office background');
    assert(background.includes('linear-gradient'), id + ': missing readability overlay');
    await page.$eval('#' + id, section => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await (await page.$('#' + id)).screenshot({ path: path.join(output, `${id}-${label}.png`) });
  }
  assert.equal(await page.$$eval('#how-it-works .hm-timeline > li', items => items.length), 6);
  assert(await page.$('#how-it-works video[controls]'));
  assert.equal(await page.$eval('#how-it-works video source', source => source.src), HOME_VIDEO.url);
  assert(await page.$('#how-it-works a[href="/builder"]'));
  await page.click('#faq details:first-child summary');
  assert(await page.$eval('#faq details:first-child', details => details.open));
  await page.click('#faq details:first-child summary');
  assert.equal(await page.$eval('#faq details:first-child', details => details.open), false);
  await page.evaluate(scroll => window.scrollTo({ ...scroll, behavior: 'instant' }), scroll);
};
const checkHeroPhoto = async () => {
  const result = await page.$eval('.hm-hero-photo img', async image => {
    await image.decode();
    const rect = image.getBoundingClientRect(), copy = document.querySelector('.hm-hero-copy').getBoundingClientRect();
    const paintedWidth = Math.min(rect.width, rect.height * image.naturalWidth / image.naturalHeight);
    const firstFaceLeft = rect.right - paintedWidth + paintedWidth * 580 / image.naturalWidth;
    return { width: image.naturalWidth, height: image.naturalHeight, src: image.currentSrc, fit: getComputedStyle(image).objectFit, alt: image.alt, left: rect.left, right: rect.right, bottom: rect.bottom, copyTop: copy.top, copyRight: copy.right, firstFaceLeft, viewport: innerWidth };
  });
  const mobile = result.viewport <= 850;
  assert.deepEqual([result.width, result.height], mobile ? [1000, 717] : [1672, 941]);
  assert(result.src.endsWith(mobile ? '/assets/hero-professionals-mobile.webp' : '/assets/hero-professionals.webp'));
  assert.equal(result.fit, 'contain', 'Keep every professional inside the image area');
  assert(result.left >= -1 && result.right <= result.viewport + 1, 'Hero image extends outside viewport');
  if (mobile) assert(result.bottom <= result.copyTop + 1, 'Hero copy overlaps the mobile group photo');
  else assert(result.copyRight <= result.firstFaceLeft, 'Hero copy overlaps the approved group face area');
  assert.match(result.alt, /AI-generated group/);
  assert(await page.$('.hm-hero-actions a[href="/builder?start=upload"]'));
  assert(await page.$('.hm-hero-actions a[href="#templates"]'));
  await page.evaluate(() => {
    const word = document.querySelector('.hm-rotating-word');
    window.heroWordForTest = word.textContent;
  });
  for (const text of ['job-ready', 'interview-ready', 'recruiter-ready', 'stand out']) {
    const fits = await page.evaluate(text => {
      const word = document.querySelector('.hm-rotating-word'); word.textContent = text;
      return word.getBoundingClientRect().right <= document.querySelector('.hm-hero-copy').getBoundingClientRect().right + 1;
    }, text);
    assert(fits, text + ': animated headline overflows hero copy');
  }
  await page.evaluate(() => { document.querySelector('.hm-rotating-word').textContent = window.heroWordForTest; delete window.heroWordForTest; });
};
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setJavaScriptEnabled(false);
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  await page.$$eval('.hm-industry-photo, .hm-template-preview img', images => images.forEach(image => image.loading = 'eager'));
  await page.waitForFunction(() => [...document.querySelectorAll('.hm-industry-photo, .hm-template-preview img')].every(image => image.complete && image.naturalWidth > 0));
  const staticRects = await rectangles();
  const staticH1 = await page.$eval("h1", (item) => item.textContent);
  await checkHeroPhoto();
  await page.screenshot({ path: path.join(output, "desktop-static.png"), fullPage: true });
  await checkOfficeSections('static-desktop');
  await page.setJavaScriptEnabled(true);
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.$eval("h1", (item) => item.textContent), staticH1);
  assert.deepEqual(await rectangles(), staticRects, "Static and React homepage layout differs");
  await checkOfficeSections('desktop');
  assert.equal(await page.$$eval(".hm-template", (items) => items.length), 6);
  await page.screenshot({ path: path.join(output, "desktop-hotel-top.png") });
  await page.$$eval('.hm-industry-photo, .hm-template-preview img', async images => {
    for (const image of images) { image.loading = 'eager'; await image.decode(); }
  });
  await page.$eval('#templates', section => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: path.join(output, 'templates-with-industry-photos-desktop.png') });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await clickText("Your version");
  assert.match(await page.$eval(".hm-improve-card blockquote", item => item.textContent), /Did check in/);
  await clickText("Accept change");
  assert.match(await page.$eval(".hm-strength-heading", item => item.textContent), /Strong/);
  await clickText("Keep mine");
  assert.match(await page.$eval(".hm-strength-heading", item => item.textContent), /Good/);
  await checkHeroPhoto();
  assert.equal(await page.$eval("h1 mark", item => item.textContent), "job-ready");
  for (const width of [1920, 1280, 1101, 1100, 1024, 900, 851, 850, 768, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    await checkHeroPhoto();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, width + ': hero overflow');
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
  await page.screenshot({ path: path.join(output, "desktop-top.png") });
  await page.click('.hm-category-tabs button:nth-child(5)');
  await page.waitForFunction(() => document.querySelectorAll('.hm-template').length === 1);
  assert.equal(await page.$$eval(".hm-template", (items) => items.length), 1);
  await page.click(".hm-template-preview");
  await page.waitForSelector('[role="dialog"]');
  await page.waitForFunction(() => document.querySelector('.hm-preview-dialog img')?.naturalWidth === 794);
  assert.equal(await page.$eval("#hm-preview-title", (item) => item.textContent), "Finance");
  await page.keyboard.press("Escape");
  assert.equal(await page.$('[role="dialog"]'), null);
  assert(await page.$eval(".hm-template-preview", (item) => item === document.activeElement));
  await page.click('.hm-category-tabs button:first-child');
  await clickText("Explore all 10 job categories");
  assert.equal(await page.$$eval(".hm-template", (items) => items.length), 10);
  for (const example of homeCvExamples) {
    assert(categories.some((item) => item.id === example.id));
    assert(layouts.some((item) => item.id === example.layout && item.name === example.name));
    assert(themes.some((item) => item.id === example.theme));
    await page.evaluate((label) => [...document.querySelectorAll(".hm-category-tabs button")].find(item => item.textContent === label).click(), example.category);
    await page.$eval(".hm-template-preview", (element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForFunction(() => document.querySelector(".hm-builder-example")?.naturalWidth === 794);
    assert.equal(await page.$eval(".hm-builder-example", (image) => image.getAttribute("src")), example.image);
    assert.equal(await page.$eval(".hm-template-info h3", (heading) => heading.textContent), example.name);
    const industry = await page.$eval('.hm-industry-photo', async image => { await image.decode(); return { src: image.getAttribute('src'), alt: image.alt, width: image.naturalWidth }; });
    assert.deepEqual(industry, { src: example.industryPhoto.src, alt: example.industryPhoto.alt, width: 400 });
    assert.match(await page.$eval(".hm-template-use", (link) => link.href), new RegExp(`layout=${example.layout}`));
  }
  for (const [name, width, height] of [["tablet", 1024, 768], ["mobile", 390, 844], ["small-mobile", 320, 720]]) {
    await page.setViewport({ width, height });
    await page.goto(baseUrl, { waitUntil: "networkidle0" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `${name}: horizontal overflow`);
    await checkHeroPhoto();
    await checkOfficeSections(name);
    await page.$$eval('.hm-industry-photo, .hm-template-preview img', async images => {
      for (const image of images) { image.loading = 'eager'; await image.decode(); }
    });
    const captionsFit = await page.$$eval('.hm-template-caption', captions => captions.filter(caption => caption.getClientRects().length).every(caption => {
      const box = caption.getBoundingClientRect(), image = caption.querySelector('img').getBoundingClientRect(), copy = caption.firstElementChild.getBoundingClientRect();
      return image.right <= box.right + 1 && copy.right <= image.left && box.right <= innerWidth;
    }));
    assert(captionsFit, name + ': industry photos overlap template captions');
    if (name === 'mobile') await (await page.$('.hm-template')).screenshot({ path: path.join(output, 'template-with-industry-photo-mobile.png') });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    await page.screenshot({ path: path.join(output, `${name}-top.png`) });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  await page.click('.hm-category-tabs button:nth-child(5)');
  await page.click(".hm-template-use");
  await page.waitForFunction(() => location.pathname === "/builder");
  assert.match(page.url(), /category=finance/);
  await page.waitForSelector(".builder-layout-v2");
  assert.equal(await page.$('.builder-setup-card, .builder-onboarding'), null, "Template links must open the actual editor directly");
  await page.click("#workspace-tab-design");
  assert.match(await page.$eval(".workspace-design-templates .template-card-button.selected", (item) => item.textContent), /Finance/);
  assert(await page.evaluate(() => [...document.querySelectorAll(".builder-form-inner button")].some((item) => item.textContent.includes("Classic single-column") && item.className.includes("bg-blue-50"))), "Selected layout was not passed into the builder");
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  await page.click('.hm-actions a[href="/builder?start=upload"]');
  await page.waitForSelector(".builder-layout-v2");
  assert.match(await page.$eval(".builder-form-inner", (item) => item.textContent), /Upload Existing CV/);
  await page.goto(`${baseUrl}/builder?access=save`, { waitUntil: "networkidle0" });
  assert.match(await page.evaluate(() => document.body.textContent), /Continue without cloud saving/);
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log("PASS: office backgrounds and overlays in How It Works/FAQ, six steps, preserved video/CTA, FAQ interactions, static/React parity, desktop/tablet/mobile, 10 native CV templates, preview keyboard handling, template selection, upload and account entry routes.");
  console.log(`Screenshots: ${output}`);
} catch (error) {
  console.log(JSON.stringify({ url: page.url(), errors }));
  await page.screenshot({ path: path.join(output, 'failure.png') });
  throw error;
} finally {
  await browser.close();
}
