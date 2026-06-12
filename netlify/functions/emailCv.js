import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";

const hits = new Map();
const MAX_BODY_BYTES = 180_000;

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

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

const safeFilename = (fullName = "BuildMyCVNow") =>
  `${String(fullName || "BuildMyCVNow").trim().replace(/[^\w-]+/g, "_").slice(0, 60) || "BuildMyCVNow"}_CV.pdf`;

const cvText = (cv = {}) => {
  const experiences = Array.isArray(cv.workExperiences) ? cv.workExperiences : [];
  return [
    cv.fullName,
    cv.jobTitle,
    [cv.email, cv.phone, cv.country].filter(Boolean).join(" | "),
    "",
    "PROFESSIONAL SUMMARY",
    cv.summary,
    "",
    "WORK EXPERIENCE",
    ...experiences.flatMap((entry) => [
      [entry.jobTitle, entry.employer, entry.companyLocation, [entry.fromDate, entry.isCurrent ? "Present" : entry.toDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | "),
      ...lines(entry.responsibilities).map((line) => `- ${line}`),
      "",
    ]),
    "EDUCATION",
    cv.education,
    "",
    "SKILLS",
    cv.skills,
    "",
    "CERTIFICATIONS",
    cv.certifications,
    "",
    "LANGUAGES",
    cv.languages,
    "",
    "REFERENCES",
    typeof cv.references === "string" ? cv.references : "References available upon request",
  ].filter((line) => line !== undefined && line !== null).join("\n");
};

const cvHtml = (cv = {}) =>
  `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55">
    <h1 style="margin:0;color:#0f172a">${escapeHtml(cv.fullName || "Applicant Name")}</h1>
    <p style="font-weight:bold;color:#0f66d0">${escapeHtml(cv.jobTitle)}</p>
    <p>${escapeHtml([cv.email, cv.phone, cv.country].filter(Boolean).join(" | "))}</p>
    <h2>Professional Summary</h2><p>${escapeHtml(cv.summary)}</p>
    <h2>Work Experience</h2>
    ${(Array.isArray(cv.workExperiences) ? cv.workExperiences : []).map((entry) => `
      <p><strong>${escapeHtml(entry.jobTitle)}</strong><br>${escapeHtml([entry.employer, entry.companyLocation, [entry.fromDate, entry.isCurrent ? "Present" : entry.toDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | "))}</p>
      <ul>${lines(entry.responsibilities).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    `).join("")}
    <h2>Education</h2><p>${escapeHtml(cv.education)}</p>
    <h2>Skills</h2><p>${escapeHtml(cv.skills)}</p>
    <h2>Certifications</h2><p>${escapeHtml(cv.certifications)}</p>
    <h2>Languages</h2><p>${escapeHtml(cv.languages)}</p>
    <p style="margin-top:20px;color:#64748b">This CV copy was generated with BuildMyCVNow.</p>
  </div>`;

const cvPdfHtml = (cv = {}) => `<!doctype html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        @page { size: A4; margin: 0; }
        body { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.42; color: #111827; background: #ffffff; }
        h1 { margin: 0 0 4px; color: #0f172a; font-size: 25px; }
        h2 { margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #0f66d0; color: #0f172a; font-size: 12px; text-transform: uppercase; }
        p { margin: 0 0 8px; white-space: pre-line; }
        ul { margin: 0; padding-left: 18px; }
        li { margin-bottom: 3px; }
        header { border-bottom: 3px solid #0f66d0; margin-bottom: 10px; padding-bottom: 10px; }
      </style>
    </head>
    <body>${cvHtml(cv)}</body>
  </html>`;

const makePdfBase64 = async (cv) => {
  let browser;
  try {
    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default || chromiumModule;
    const executablePath = await chromium.executablePath();
    if (!executablePath) return "";
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
    await page.setContent(cvPdfHtml(cv), { waitUntil: "domcontentloaded", timeout: 15_000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    return Buffer.from(pdf).toString("base64");
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

const getUser = async (event) => {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Sign in is required to email a CV copy.");
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) throw new Error("Email verification is required before sending CV copies.");
  return data.user;
};

const rateLimited = (event, userId) => {
  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  const key = `${userId}:${ip}`;
  const now = Date.now();
  const bucket = hits.get(key)?.filter((time) => now - time < 60_000) || [];
  hits.set(key, [...bucket, now]);
  return bucket.length >= 4;
};

const sendWithResend = async ({ toEmail, cv, pdfBase64, filename }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !pdfBase64) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.CV_EMAIL_FROM || "BuildMyCVNow <no-reply@buildmycvnow.com>",
      to: [toEmail],
      subject: `Your BuildMyCVNow CV - ${cv.fullName || "CV"}`,
      html: cvHtml(cv),
      text: cvText(cv),
      attachments: [{ filename, content: pdfBase64 }],
    }),
  });
  if (!response.ok) throw new Error(`Could not email CV: ${await response.text()}`);
  return true;
};

const sendWithEmailJs = async ({ toEmail, cv, pdfBase64, filename }) => {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_CV_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  if (!serviceId || !templateId || !publicKey) return false;

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_email: toEmail,
        from_name: "BuildMyCVNow",
        reply_to: process.env.CONTACT_TO_EMAIL || "support@buildmycvnow.com",
        subject: `Your BuildMyCVNow CV - ${cv.fullName || "CV"}`,
        cv_name: cv.fullName || "Your CV",
        cv_text: cvText(cv),
        cv_html: cvHtml(cv),
        cv_pdf_base64: pdfBase64,
        cv_pdf_filename: filename,
      },
    }),
  });
  if (!response.ok) throw new Error(`Could not email CV: ${await response.text()}`);
  return true;
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Use POST." });
  if (Buffer.byteLength(event.body || "", "utf8") > MAX_BODY_BYTES) return json(413, { ok: false, message: "CV payload is too large." });

  try {
    const user = await getUser(event);
    if (rateLimited(event, user.id)) return json(429, { ok: false, message: "Too many email requests. Please try again shortly." });
    const payload = JSON.parse(event.body || "{}");
    if (!payload.cv?.fullName) return json(400, { ok: false, message: "CV data is required." });

    const toEmail = user.email.toLowerCase();
    const filename = safeFilename(payload.cv.fullName);
    const pdfBase64 = await makePdfBase64(payload.cv);
    const forwarded = await sendWithResend({ toEmail, cv: payload.cv, pdfBase64, filename })
      || await sendWithEmailJs({ toEmail, cv: payload.cv, pdfBase64, filename });

    return json(200, {
      ok: true,
      forwarded,
      message: forwarded
        ? `PDF CV copy sent to ${toEmail}.`
        : "CV email was authorized, but no email provider is configured for CV delivery.",
    });
  } catch (error) {
    return json(400, { ok: false, message: error.message || "Could not email your CV." });
  }
};
