import puppeteer from "puppeteer-core";

const allowedOrigins = new Set([
  "https://buildmycvnow.com",
  "https://www.buildmycvnow.com",
  "http://localhost:8888",
  "http://localhost:5173",
  "http://127.0.0.1:8888",
  "http://127.0.0.1:5173",
]);
const hits = new Map();
const MAX_BODY_BYTES = 180_000;

const originHeaders = (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://buildmycvnow.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const escapeHtml = (value = "") =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const lines = (value = "") =>
  String(value || "")
    .split("\n")
    .map((line) => line.trim().replace(/^[-\u2022*]\s*/, ""))
    .filter(Boolean);

const safeFilename = (value = "BuildMyCVNow-CV.pdf") => {
  const filename = String(value || "BuildMyCVNow-CV.pdf")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
  return filename.toLowerCase().endsWith(".pdf") ? filename : `${filename || "BuildMyCVNow-CV"}.pdf`;
};

const cleanTheme = (theme = {}) => ({
  color: /^#[0-9a-f]{6}$/i.test(theme.color || "") ? theme.color : "#0f66d0",
  dark: /^#[0-9a-f]{6}$/i.test(theme.dark || "") ? theme.dark : "#0f172a",
});

const visibleSections = (cv = {}) => {
  const order = Array.isArray(cv.sectionOrder)
    ? cv.sectionOrder
    : ["summary", "experience", "education", "skills", "certifications", "languages", "references"];
  const hidden = Array.isArray(cv.hiddenSections) ? cv.hiddenSections : [];
  return order.filter((id) => !hidden.includes(id));
};

const referenceHtml = (references) => {
  if (!references || references.mode === "on-request") return "<p>References available upon request</p>";
  if (references.mode !== "listed" || !Array.isArray(references.entries)) return "";
  const entries = references.entries.filter((entry) => entry.consentGiven && entry.name && entry.company);
  return entries.map((entry) => `
    <p><strong>${escapeHtml(entry.name)}</strong><br>
    ${escapeHtml([entry.jobTitle, entry.company, entry.relationship].filter(Boolean).join(" | "))}<br>
    ${escapeHtml([[entry.phoneCode, entry.phone].filter(Boolean).join(" "), entry.email].filter(Boolean).join(" | "))}</p>
  `).join("");
};

const normalizeEducationEntries = (cv = {}) => {
  if (Array.isArray(cv.educationEntries) && cv.educationEntries.length) return cv.educationEntries;
  const educationLines = String(cv.education || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (!educationLines.length) return [];
  const entries = [];
  for (let index = 0; index < educationLines.length; index += 3) {
    const [qualification = "", school = "", dates = ""] = educationLines.slice(index, index + 3);
    entries.push({ qualification, school, location: "", fromDate: dates, toDate: "", details: "" });
  }
  return entries;
};

const educationHtml = (cv = {}) =>
  normalizeEducationEntries(cv).map((entry) => {
    const dates = [entry.fromDate, entry.toDate].filter(Boolean).join(" - ");
    if (![entry.qualification, entry.school, entry.location, dates, entry.details].some(Boolean)) return "";
    return `<div class="education-item">
      ${entry.qualification ? `<p><strong>${escapeHtml(entry.qualification)}</strong></p>` : ""}
      ${[entry.school, entry.location, dates].filter(Boolean).length ? `<p>${escapeHtml([entry.school, entry.location, dates].filter(Boolean).join(" | "))}</p>` : ""}
      ${entry.details ? `<p>${escapeHtml(entry.details)}</p>` : ""}
    </div>`;
  }).join("");

const sectionHtml = (cv = {}, id) => {
  const experiences = Array.isArray(cv.workExperiences) ? cv.workExperiences : [];
  const sections = {
    summary: cv.summary ? `<section><h2>Professional Summary</h2><p>${escapeHtml(cv.summary)}</p></section>` : "",
    experience: experiences.length ? `<section><h2>Work Experience</h2>${experiences.map((entry) => `
      <div class="experience-item">
        <p><strong>${escapeHtml(entry.jobTitle)}</strong></p>
        <p>${escapeHtml([entry.employer, entry.companyLocation, [entry.fromDate, entry.isCurrent ? "Present" : entry.toDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | "))}</p>
        <ul>${lines(entry.responsibilities).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      </div>
    `).join("")}</section>` : "",
    education: normalizeEducationEntries(cv).length ? `<section><h2>Education</h2>${educationHtml(cv)}</section>` : "",
    skills: cv.skills ? `<section><h2>Skills</h2><p>${escapeHtml(cv.skills)}</p></section>` : "",
    certifications: cv.certifications ? `<section><h2>Certifications</h2><p>${escapeHtml(cv.certifications)}</p></section>` : "",
    languages: cv.languages ? `<section><h2>Languages</h2><p>${escapeHtml(cv.languages)}</p></section>` : "",
    references: `<section><h2>References</h2>${referenceHtml(cv.references)}</section>`,
  };
  return sections[id] || "";
};

const buildCvHtml = ({ cv = {}, theme = {}, layout = "classic" }) => {
  const safeTheme = cleanTheme(theme);
  const contact = [cv.email, cv.phone, cv.country, cv.linkedIn, cv.portfolioUrl].filter(Boolean).join(" | ");
  const personal = [
    cv.nationality ? `Nationality: ${cv.nationality}` : "",
    cv.visaStatus ? `Visa Status: ${cv.visaStatus}` : "",
    cv.drivingLicense ? `Driving License: ${cv.drivingLicense}` : "",
    cv.expectedSalaryEnabled && cv.expectedSalary ? `Expected Salary: ${cv.expectedSalary}` : "",
  ].filter(Boolean);
  return `<!doctype html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.42; color: #111827; background: #ffffff; overflow-wrap: anywhere; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        h1 { margin: 0 0 4px; color: #0f172a; font-size: 25px; line-height: 1.15; }
        h2 { margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid ${safeTheme.color}; color: ${safeTheme.dark}; font-size: 12px; text-transform: uppercase; }
        p { margin: 0 0 8px; white-space: pre-line; }
        ul { margin: 0; padding-left: 18px; }
        li { margin-bottom: 3px; }
        header { border-bottom: 3px solid ${safeTheme.color}; margin-bottom: 10px; padding-bottom: 10px; }
        .title { color: ${safeTheme.color}; font-weight: 700; }
        .contact { color: #475569; }
        .experience-item { break-inside: avoid; page-break-inside: avoid; margin-bottom: 9px; }
        .education-item { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8px; }
      </style>
    </head>
    <body class="${escapeHtml(layout)}">
      <header>
        <h1>${escapeHtml(cv.fullName || "Applicant Name")}</h1>
        <p class="title">${escapeHtml(cv.jobTitle || "")}</p>
        <p class="contact">${escapeHtml(contact)}</p>
      </header>
      ${personal.length ? `<section><h2>Personal Details</h2><p>${escapeHtml(personal.join("\n"))}</p></section>` : ""}
      ${visibleSections(cv).map((id) => sectionHtml(cv, id)).join("")}
    </body>
  </html>`;
};

const rateLimited = (event) => {
  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  const now = Date.now();
  const bucket = hits.get(ip)?.filter((time) => now - time < 60_000) || [];
  hits.set(ip, [...bucket, now]);
  return bucket.length >= 12;
};

export const handler = async (event) => {
  const headers = originHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };
  if (!allowedOrigins.has(event.headers.origin || event.headers.Origin || "")) return { statusCode: 403, headers, body: "Origin not allowed" };
  if (rateLimited(event)) return { statusCode: 429, headers, body: "Too many PDF exports. Please try again shortly." };
  if (Buffer.byteLength(event.body || "", "utf8") > MAX_BODY_BYTES) return { statusCode: 413, headers, body: "CV payload is too large." };

  let browser;
  try {
    const payload = JSON.parse(event.body || "{}");
    if (!payload.cv || typeof payload.cv !== "object") return { statusCode: 400, headers, body: "Structured CV data is required." };
    const filename = safeFilename(payload.filename);
    const html = buildCvHtml(payload);

    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default || chromiumModule;
    const executablePath = await chromium.executablePath();
    if (!executablePath) throw new Error("Chromium executable path is unavailable in this Netlify runtime.");

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport || { width: 1240, height: 1754 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (/^(data:|about:|blob:)/i.test(url)) request.continue();
      else request.abort();
    });
    await page.emulateMediaType("screen");
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
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
