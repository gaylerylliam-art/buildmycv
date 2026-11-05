import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import puppeteer from "puppeteer-core";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { preparePdfHtml } from "../netlify/functions/export-pdf.js";
import { buildCvHtml } from "../src/utils/downloads.js";

const theme = { color: "#0f66d0", dark: "#153454" };
const cv = {
  fullName: "Alex Example", jobTitle: "Mechanical Engineer", email: "alex@example.com",
  summary: "Experienced in mechanical maintenance and equipment inspections.",
  languages: "English", references: { mode: "on-request" }, pageBorderPreset: "1cm",
  workExperiences: Array.from({ length: 15 }, (_, i) => ({
    id: `role-${i}`, jobTitle: "Mechanical Engineer", employer: `Example Company ${i + 1}`,
    responsibilities: Array.from({ length: 6 }, (_, j) =>
      `Duty ${j + 1}: Maintained equipment and documented inspections.`).join("\n"),
  })),
};
const output = path.resolve("artifacts/cv-sidebar-pages");
await fs.mkdir(output, { recursive: true });
const assets = await fs.readdir("dist/assets");
const css = (await Promise.all(assets.filter((file) => file.endsWith(".css"))
  .map((file) => fs.readFile(path.join("dist/assets", file), "utf8")))).join("\n");
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false } });
let LiveCVPreview;
try {
  ({ LiveCVPreview } = await vite.ssrLoadModule("/src/App.jsx"));
} finally {
  await vite.close();
}

const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  userDataDir: await fs.mkdtemp(path.join(output, "browser-")),
  headless: true,
});
try {
  const page = await browser.newPage();
  for (const { width, height, direction, layout } of [
    { width: 1440, height: 1000, direction: "ltr", layout: "sidebar" },
    { width: 390, height: 844, direction: "ltr", layout: "sidebar" },
    { width: 1440, height: 1000, direction: "rtl", layout: "sidebar" },
    ...["classic", "header", "compact"].map((layout) => ({ width: 1440, height: 1000, direction: "ltr", layout })),
  ]) {
    await page.setViewport({ width, height });
    const html = renderToString(React.createElement(LiveCVPreview, { cv: { ...cv, languageDirection: direction }, theme, layout }));
    await page.setContent(`<style>${css}</style><div class="builder-app-shell" style="--preview-zoom:${width < 400 ? 0.46 : 0.8}">${html}</div>`);
    const pages = await page.$$eval(".cv-paper-page", (sheets) => sheets.map((sheet) => {
      const rail = sheet.querySelector(".cv-sidebar");
      const railBox = rail?.getBoundingClientRect();
      const bodyBox = rail?.nextElementSibling.getBoundingClientRect();
      return {
        sidebar: rail?.textContent,
        background: rail && getComputedStyle(rail).backgroundColor,
        correctSide: rail && (sheet.dir === "rtl" || getComputedStyle(sheet).direction === "rtl"
          ? railBox.left >= bodyBox.right - 1 : railBox.right <= bodyBox.left + 1),
        continuation: Boolean(sheet.querySelector(".cv-continuation-header")),
        number: sheet.querySelector(".cv-page-number").textContent,
      };
    }));
    assert(pages.length >= 3);
    for (const [index, sheet] of pages.entries()) {
      assert.equal(sheet.number, `Page ${index + 1} of ${pages.length}`);
      if (layout === "sidebar") {
        assert.match(sheet.sidebar, /Alex Example.*alex@example\.com/);
        assert.equal(sheet.background, "rgb(21, 52, 84)");
        assert(sheet.correctSide);
        assert.equal(sheet.continuation, false);
      } else {
        assert.equal(sheet.sidebar, undefined);
        assert.equal(sheet.continuation, index > 0);
      }
    }
    if (layout === "sidebar") {
      await page.$(".cv-paper-page:nth-child(2)").then((sheet) => sheet.screenshot({
        path: path.join(output, `preview-page-2-${width}-${direction}.png`),
      }));
    }
  }

  await page.emulateMediaType("print");
  for (const direction of ["ltr", "rtl"]) {
    for (const workExperiences of [cv.workExperiences.slice(0, 1), cv.workExperiences]) {
      const long = workExperiences.length > 1;
      const html = await buildCvHtml({ ...cv, workExperiences, languageDirection: direction }, theme, "sidebar");
      await page.setContent(preparePdfHtml(html));
      const bytes = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
      const task = getDocument({ data: new Uint8Array(bytes) });
      try {
        const pdf = await task.promise;
        assert(long ? pdf.numPages >= 3 : pdf.numPages === 1);
        const content = [];
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const pdfPage = await pdf.getPage(i);
          const text = (await pdfPage.getTextContent()).items.map((item) => item.str).join(" ");
          assert.match(text, /Alex Example/);
          assert.match(text, /alex@example\.com/);
          content.push(text);
          const viewport = pdfPage.getViewport({ scale: 1 });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          const ctx = canvas.getContext("2d");
          await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
          const x = direction === "rtl" ? canvas.width - 40 : 40;
          assert.deepEqual([...ctx.getImageData(x, 400, 1, 1).data], [21, 52, 84, 255]);
          if (long && i === 2) await fs.writeFile(path.join(output, `pdf-page-2-${direction}.png`), canvas.toBuffer("image/png"));
        }
        for (const { employer } of workExperiences) assert(content.join(" ").includes(employer));
        assert.match(content.at(-1), /References available upon request/);
      } finally {
        await task.destroy();
      }
    }
  }
  console.log("PASS: Sidebar repeats in desktop/mobile previews and single/multi-page PDFs, including RTL. Other layouts keep their continuation headers.");
} finally {
  await browser.close();
}
