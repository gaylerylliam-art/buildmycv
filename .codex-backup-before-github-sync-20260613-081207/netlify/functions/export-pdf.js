import puppeteer from "puppeteer-core";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const safeFilename = (value = "BuildMyCVNow-CV.pdf") => {
  const filename = String(value || "BuildMyCVNow-CV.pdf")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
  return filename.toLowerCase().endsWith(".pdf") ? filename : `${filename || "BuildMyCVNow-CV"}.pdf`;
};

const injectPrintCss = (html = "") => {
  const printCss = `
    <style>
      @page { size: A4; margin: 0; }
      html { width: 210mm; min-height: 297mm; background: #ffffff !important; }
      body { max-width: 210mm; min-height: 297mm; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section { break-inside: auto; page-break-inside: auto; }
      .section h2 { break-after: avoid; page-break-after: avoid; }
      .experience-item, .references-block, .reference-card { break-inside: avoid; page-break-inside: avoid; }
    </style>
  `;
  if (html.includes("</head>")) return html.replace("</head>", `${printCss}</head>`);
  return `<html><head>${printCss}</head><body>${html}</body></html>`;
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method not allowed" };
  }

  let browser;

  try {
    const payload = JSON.parse(event.body || "{}");
    const html = String(payload.html || "");
    const filename = safeFilename(payload.filename);

    if (!html.trim()) {
      return { statusCode: 400, headers, body: "HTML is required." };
    }

    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default || chromiumModule;
    const executablePath = await chromium.executablePath();
    if (!executablePath) {
      throw new Error("Chromium executable path is unavailable in this Netlify runtime.");
    }

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport || { width: 1240, height: 1754 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.emulateMediaType("screen");
    await page.setContent(injectPrintCss(html), { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
      body: Buffer.from(pdf).toString("base64"),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message || "PDF export failed." }),
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};
