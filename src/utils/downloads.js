import QRCode from "qrcode";
import { normalizeQrUrl } from "../lib/validateQrUrl";
import { sanitizeQrSvg } from "../hooks/useQrSvg";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const joinLines = (value = "") =>
  value
    .split("\n")
    .filter(Boolean)
    .map((line) => `<li>${escapeHtml(String(line).trim().replace(/^[-•●▪◦*]\s*/, ""))}</li>`)
    .join("");

const fileBaseName = (fullName, suffix) => {
  const [firstName = "My", lastName = "Document"] = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return `${firstName}_${lastName}_${suffix}`.replace(/[^\w-]+/g, "_");
};

const sanitizeCoverLetterText = (value = "") =>
  String(value || "")
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
        .replace(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/gi, "")
        .replace(/linkedin\.com\/[^\s)]+/gi, "")
        .replace(/https?:\/\/[^\s)]+/gi, "")
        .replace(/\+?\d[\d\s().-]{7,}\d/g, "")
        .replace(/\s*[#|•]\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((line) => line && !/^(contact|email|phone|mobile|linkedin|location)\b/i.test(line))
    .join("\n")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

const sanitizeCoverLetter = (letter = {}) => ({
  ...letter,
  opening: sanitizeCoverLetterText(letter.opening),
  body: sanitizeCoverLetterText(letter.body),
  qualifications: sanitizeCoverLetterText(letter.qualifications),
  value: sanitizeCoverLetterText(letter.value),
  closing: sanitizeCoverLetterText(letter.closing),
});

const cvContactLines = (cv) =>
  [
    cv.email,
    cv.phone,
    cv.country,
    cv.linkedIn ? `LinkedIn: ${cv.linkedIn}` : "",
    cv.portfolioUrl ? `Portfolio: ${cv.portfolioUrl}` : "",
  ].filter(Boolean);

const inlineContactHtml = (lines = []) =>
  lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("<span class=\"contact-separator\">|</span>");

const cvPersonalDetails = (cv) =>
  [
    cv.nationality ? `Nationality: ${cv.nationality}` : "",
    cv.visaStatus ? `Visa Status: ${cv.visaStatus}` : "",
    cv.drivingLicense ? `Driving License: ${cv.drivingLicense}` : "",
    cv.expectedSalaryEnabled && cv.expectedSalary ? `Expected Salary: ${cv.expectedSalary}` : "",
  ].filter(Boolean);

const defaultSectionOrder = ["summary", "experience", "education", "skills", "certifications", "languages", "references"];
const defaultQrCode = { enabled: false, url: "", label: "Scan for LinkedIn", position: "header" };

const normalizeSectionOrder = (cv = {}) => {
  const order = Array.isArray(cv.sectionOrder) ? cv.sectionOrder : [];
  return [...order.filter((id) => defaultSectionOrder.includes(id)), ...defaultSectionOrder.filter((id) => !order.includes(id))];
};

const normalizeReferences = (references) => {
  if (!references) return { mode: "on-request", entries: [] };
  if (typeof references === "string") {
    return /available upon request/i.test(references) || !references.trim()
      ? { mode: "on-request", entries: [] }
      : { mode: "listed", entries: [{ name: references, consentGiven: false }] };
  }
  return {
    mode: references.mode || "on-request",
    entries: Array.isArray(references.entries) ? references.entries : [],
  };
};

const referencesHasContent = (references) => {
  const normalized = normalizeReferences(references);
  if (normalized.mode === "on-request") return true;
  if (normalized.mode !== "listed") return false;
  return normalized.entries.some((entry) => entry.consentGiven && entry.name && entry.company);
};

const exportPhotoShapeClass = (shape = "circle") => {
  if (shape === "circle" || shape === "round") return "round";
  if (shape === "rounded") return "rounded";
  return "square";
};

const normalizeCvWorkExperiences = (cv) => {
  if (Array.isArray(cv.workExperiences) && cv.workExperiences.length) {
    return cv.workExperiences;
  }
  return [
    {
      id: "legacy",
      jobTitle: cv.jobTitle || "",
      employer: "",
      fromDate: "",
      toDate: "",
      isCurrent: false,
      responsibilities: cv.experience || "",
    },
  ];
};

const sectionHasContent = (cv = {}, id) => {
  if (id === "experience") return normalizeCvWorkExperiences(cv).some((entry) => [entry.jobTitle, entry.employer, entry.responsibilities].some((value) => String(value || "").trim()));
  if (id === "references") return referencesHasContent(cv.references);
  return Boolean(String(cv[id] || "").trim());
};

const visibleSectionOrder = (cv = {}) => {
  const hidden = Array.isArray(cv.hiddenSections) ? cv.hiddenSections : [];
  return normalizeSectionOrder(cv).filter((id) => !hidden.includes(id) && sectionHasContent(cv, id));
};

const workExperienceHtml = (cv) =>
  normalizeCvWorkExperiences(cv)
    .map((entry) => {
      const dates = [entry.fromDate, entry.isCurrent ? "Present" : entry.toDate].filter(Boolean).join(" - ");
      return `
        <div class="experience-item">
          <p><strong>${escapeHtml(entry.jobTitle || "Job title")}</strong></p>
          <p>${escapeHtml(entry.employer || "Employer name")}${dates ? ` | ${escapeHtml(dates)}` : ""}</p>
          <ul>${joinLines(entry.responsibilities || "")}</ul>
        </div>
      `;
    })
    .join("");

const referencesHtml = (references) => {
  const normalized = normalizeReferences(references);
  if (normalized.mode === "on-request") return `<p>References available upon request</p>`;
  if (normalized.mode !== "listed") return "";
  const entries = normalized.entries.filter((entry) => entry.consentGiven && entry.name && entry.company);
  if (!entries.length) return "";
  return `<div class="references-grid">${entries.map((entry) => `
    <div class="reference-card">
      <p><strong>${escapeHtml(entry.name)}</strong></p>
      <p>${escapeHtml([entry.jobTitle, entry.company].filter(Boolean).join(", "))}</p>
      ${entry.relationship ? `<p class="muted">${escapeHtml(entry.relationship)}</p>` : ""}
      ${entry.phone ? `<p>${escapeHtml([entry.phoneCode, entry.phone].filter(Boolean).join(" "))}</p>` : ""}
      ${entry.email ? `<p>${escapeHtml(entry.email)}</p>` : ""}
    </div>
  `).join("")}</div>`;
};

const cvSectionHtml = (cv, id) => {
  const sections = {
    summary: `<div class="section"><h2>Professional Summary</h2><p>${escapeHtml(cv.summary)}</p></div>`,
    experience: `<div class="section"><h2>Work Experience</h2>${workExperienceHtml(cv)}</div>`,
    education: `<div class="section"><h2>Education</h2><p>${escapeHtml(cv.education)}</p></div>`,
    skills: `<div class="section"><h2>Skills</h2><p>${escapeHtml(cv.skills)}</p></div>`,
    certifications: `<div class="section"><h2>Certifications</h2><p>${escapeHtml(cv.certifications)}</p></div>`,
    languages: `<div class="section"><h2>Languages</h2><p>${escapeHtml(cv.languages)}</p></div>`,
    references: `<div class="section references-block"><h2>References</h2>${referencesHtml(cv.references)}</div>`,
  };
  return sections[id] || "";
};

const buildQrSvg = async (qrCode = {}, fallbackUrl = "", color = "#1E293B") => {
  const config = { ...defaultQrCode, ...qrCode };
  const normalized = normalizeQrUrl(config.url || fallbackUrl);
  if (!config.enabled || !normalized.ok) return "";
  const svg = await QRCode.toString(normalized.url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: color, light: "#FFFFFF00" },
  });
  return sanitizeQrSvg(svg);
};

const qrBlockHtml = (svg, label, size = 64) =>
  svg ? `<div class="qr-block" style="width:${size}px"><div class="qr-svg" style="width:${size}px;height:${size}px">${svg}</div><p>${escapeHtml(label || "Scan for LinkedIn")}</p></div>` : "";

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const downloadPdfFromServer = async (html, filename) => {
  const response = await fetch("/.netlify/functions/export-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, filename }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || "Server PDF export failed.");
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error("Server PDF export returned an empty file.");
  saveBlob(blob, filename);
};

const downloadPdfFromHtml = async (html, filename) => {
  try {
    await downloadPdfFromServer(html, filename);
    return;
  } catch (error) {
    console.warn("Server PDF export unavailable; using browser fallback.", error);
  }

  const module = await import("html2pdf.js");
  const html2pdf = module.default || module;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  wrapper.style.background = "#ffffff";
  wrapper.style.width = "8.27in";
  document.body.appendChild(wrapper);

  try {
    await html2pdf()
      .set({
        filename,
        margin: 0.35,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(wrapper)
      .save();
  } finally {
    wrapper.remove();
  }
};

const downloadCoverLetterDocx = async (letter, cv, filename) => {
  const cleanLetter = sanitizeCoverLetter(letter);
  const { AlignmentType, Document, Packer, Paragraph, TextRun } = await import("docx");
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const paragraph = (text = "", options = {}) =>
    new Paragraph({
      spacing: { after: options.after ?? 180 },
      alignment: options.alignment,
      children: [
        new TextRun({
          text: String(text || ""),
          bold: options.bold,
          size: options.size || 22,
        }),
      ],
    });
  const contactLines = [
    `${cv.email} | ${cv.phone} | ${cv.country}`,
    cleanLetter.linkedIn ? `LinkedIn: ${cleanLetter.linkedIn}` : "",
    cleanLetter.nationality ? `Nationality: ${cleanLetter.nationality}` : "",
    cleanLetter.visaStatus ? `Visa Status: ${cleanLetter.visaStatus}` : "",
  ].filter(Boolean);
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          paragraph(cv.fullName, { bold: true, size: 32, after: 80 }),
          ...contactLines.map((line) => paragraph(line, { size: 18, after: 70 })),
          paragraph(today),
          paragraph(cleanLetter.companyName),
          paragraph(cleanLetter.companyAddress),
          paragraph(`Dear ${cleanLetter.hiringManager || "Hiring Manager"},`),
          paragraph(cleanLetter.opening),
          paragraph(cleanLetter.body),
          cleanLetter.qualifications ? paragraph(cleanLetter.qualifications) : paragraph("", { after: 0 }),
          cleanLetter.value ? paragraph(cleanLetter.value) : paragraph("", { after: 0 }),
          paragraph(cleanLetter.closing),
          paragraph("Sincerely,", { after: 80 }),
          paragraph(cv.fullName, { bold: true }),
          paragraph("", { alignment: AlignmentType.LEFT, after: 0 }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  saveBlob(blob, filename);
};

const downloadCvDocx = async (cv, filename) => {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const paragraph = (text = "", options = {}) =>
    new Paragraph({
      spacing: { after: options.after ?? 150 },
      children: [new TextRun({ text: String(text || ""), bold: options.bold, size: options.size || 22 })],
    });
  const sectionHeading = (text) => paragraph(text, { bold: true, size: 24, after: 100 });
  const personalDetails = cvPersonalDetails(cv);
  const workExperiences = normalizeCvWorkExperiences(cv);
  const referenceParagraphs = () => {
    const references = normalizeReferences(cv.references);
    if (references.mode === "on-request") return [paragraph("References available upon request")];
    if (references.mode !== "listed") return [];
    return references.entries
      .filter((entry) => entry.consentGiven && entry.name && entry.company)
      .flatMap((entry) => [
        paragraph(entry.name, { bold: true, after: 60 }),
        paragraph([entry.jobTitle, entry.company, entry.relationship].filter(Boolean).join(" | "), { size: 20, after: 60 }),
        paragraph([[entry.phoneCode, entry.phone].filter(Boolean).join(" "), entry.email].filter(Boolean).join(" | "), { size: 18, after: 90 }),
      ]);
  };
  const sectionChildren = (id) => {
    const sections = {
      summary: [sectionHeading("Professional Summary"), paragraph(cv.summary)],
      experience: [
        sectionHeading("Work Experience"),
        ...workExperiences.flatMap((entry) => [
          paragraph(entry.jobTitle || "Job title", { bold: true, after: 60 }),
          paragraph([entry.employer, [entry.fromDate, entry.isCurrent ? "Present" : entry.toDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | "), { size: 20, after: 60 }),
          ...String(entry.responsibilities || "").split("\n").filter(Boolean).map((line) => paragraph(`- ${line}`)),
        ]),
      ],
      education: [sectionHeading("Education"), paragraph(cv.education)],
      skills: [sectionHeading("Skills"), paragraph(cv.skills)],
      certifications: [sectionHeading("Certifications"), paragraph(cv.certifications)],
      languages: [sectionHeading("Languages"), paragraph(cv.languages)],
      references: [sectionHeading("References"), ...referenceParagraphs()],
    };
    return sections[id] || [];
  };
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          paragraph(cv.fullName, { bold: true, size: 34, after: 80 }),
          paragraph(cv.jobTitle, { bold: true, size: 24, after: 80 }),
          paragraph(cvContactLines(cv).join(" | "), { size: 18 }),
          ...(personalDetails.length ? [sectionHeading("Personal Details"), ...personalDetails.map((line) => paragraph(line))] : []),
          ...visibleSectionOrder(cv).flatMap((id) => sectionChildren(id)),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  saveBlob(blob, filename);
};

export const buildCvHtml = async (cv, theme = { color: "#0f66d0", dark: "#0f172a" }, layout = "classic") => {
  const qrConfig = { ...defaultQrCode, ...(cv.qrCode || {}) };
  const qrSvg = await buildQrSvg(qrConfig, cv.linkedIn || cv.portfolioUrl, layout === "sidebar" && qrConfig.position === "sidebar" ? "#FFFFFF" : "#1E293B");
  const qrHeader = qrConfig.position === "header" ? qrBlockHtml(qrSvg, qrConfig.label, 64) : "";
  const qrSidebar = qrConfig.position === "sidebar" ? qrBlockHtml(qrSvg, qrConfig.label, 80) : "";
  const qrFooter = qrConfig.position === "footer" ? qrBlockHtml(qrSvg, qrConfig.label, 64) : "";
  return `
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        * { box-sizing: border-box; }
        html { background: #ffffff; }
        body { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm; font-family: Arial, sans-serif; font-size: 12px; color: #111827; line-height: 1.45; background: #ffffff; overflow-wrap: anywhere; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        h1 { color: #0f172a; margin: 0 0 4px; font-size: 30px; line-height: 1.15; }
        h2 { color: ${theme.dark}; border-bottom: 1px solid ${theme.color}; padding-bottom: 5px; margin: 18px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0; }
        p { margin: 0 0 8px; white-space: pre-line; }
        ul { margin: 0; padding-left: 18px; }
        li { margin-bottom: 4px; break-inside: auto; page-break-inside: auto; }
        .header { display: flex; gap: 14px; align-items: center; border-bottom: 3px solid ${theme.color}; padding-bottom: 14px; margin-bottom: 12px; min-width: 0; }
        .header-main { flex: 1 1 auto; min-width: 0; }
        .contact { display: flex; flex-wrap: wrap; gap: 2px 7px; align-items: center; color: #4b5563; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
        .contact-separator { color: #cbd5e1; }
        .title { color: ${theme.color}; font-weight: 700; }
        .photo { width: 86px; height: 86px; object-fit: cover; flex: 0 0 auto; }
        .round { border-radius: 999px; }
        .rounded { border-radius: 14px; }
        .square { border-radius: 5px; }
        .section { break-inside: auto; page-break-inside: auto; }
        .section h2 { break-after: avoid; page-break-after: avoid; }
        .experience-item { margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
        .references-block { break-inside: avoid; page-break-inside: avoid; }
        .references-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
        .reference-card { border: 1px solid #e2e8f0; border-radius: 5px; padding: 8px; font-size: 11px; }
        .muted { color: #64748b; }
        .qr-block { display: grid; justify-items: center; gap: 3px; text-align: center; color: inherit; }
        .qr-svg svg { display: block; width: 100%; height: 100%; }
        .qr-block p { margin: 0; font-size: 8pt; line-height: 1.15; }
        .sidebar-paper { display: grid; grid-template-columns: 38% 62%; min-height: 970px; padding: 0; }
        .sidebar { background: ${theme.dark}; color: #ffffff; padding: 20px 24px 28px; }
        .sidebar-header { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 20px; }
        .photo-container { width: 100%; display: flex; justify-content: center; margin-bottom: 20px; }
        .profile-photo { width: 170px; height: 170px; object-fit: cover; display: block; background: rgba(255,255,255,0.14); border: 3px solid rgba(255,255,255,0.22); }
        .profile-photo.round { border-radius: 50%; }
        .profile-photo.rounded { border-radius: 16px; }
        .profile-photo.square { border-radius: 12px; }
        .profile-photo.placeholder { display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 900; }
        .name-block { text-align: center; }
        .sidebar-name { margin: 0; color: #ffffff; font-size: 24px; line-height: 1.15; }
        .sidebar-title { margin: 8px 0 0; color: rgba(255,255,255,0.88); font-size: 14px; font-weight: 700; }
        .sidebar-contact { margin-top: 28px; color: rgba(255,255,255,0.86); font-size: 11px; line-height: 1.8; text-align: left; }
        .main-content { padding: 24px; min-width: 0; }
        .credit-footer { margin: 24px 0 0; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 7pt; text-align: center; }
      </style>
    </head>
    <body>
      ${layout === "sidebar" ? `
      <div class="sidebar-paper">
        <aside class="sidebar">
          <div class="sidebar-header">
            <div class="photo-container">
              ${cv.profilePhoto ? `<img class="profile-photo ${exportPhotoShapeClass(cv.photoShape)}" src="${cv.profilePhoto}" alt="Profile photo" />` : `<div class="profile-photo placeholder ${exportPhotoShapeClass(cv.photoShape)}">${escapeHtml(initialsForPdf(cv.fullName))}</div>`}
            </div>
            <div class="name-block">
              <h1 class="sidebar-name">${escapeHtml(cv.fullName)}</h1>
              <p class="sidebar-title">${escapeHtml(cv.jobTitle)}</p>
            </div>
          </div>
          <div class="sidebar-contact">
            ${cvContactLines(cv).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
          </div>
          ${qrSidebar}
        </aside>
        <main class="main-content">
          ${cvPersonalDetails(cv).length ? `<div class="section"><h2>Personal Details</h2><p>${escapeHtml(cvPersonalDetails(cv).join("\n"))}</p></div>` : ""}
          ${visibleSectionOrder(cv).map((id) => cvSectionHtml(cv, id)).join("")}
        </main>
      </div>` : `
      <div class="header">
        ${cv.profilePhoto ? `<img class="photo ${exportPhotoShapeClass(cv.photoShape)}" src="${cv.profilePhoto}" alt="Profile photo" />` : ""}
        <div class="header-main">
          <h1>${escapeHtml(cv.fullName)}</h1>
          <p class="title">${escapeHtml(cv.jobTitle)}</p>
          <p class="contact">${inlineContactHtml(cvContactLines(cv))}</p>
        </div>
        ${qrHeader}
      </div>
      ${cvPersonalDetails(cv).length ? `<div class="section"><h2>Personal Details</h2><p>${escapeHtml(cvPersonalDetails(cv).join("\n"))}</p></div>` : ""}
      ${visibleSectionOrder(cv).map((id) => cvSectionHtml(cv, id)).join("")}
      ${qrFooter}
      `}
      ${cv.showCredit !== false ? `<p class="credit-footer">CV created free at buildmycvnow.com</p>` : ""}
    </body>
  </html>
`;
};

const initialsForPdf = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const downloadCvFile = async (cv, type, theme, layout = "classic") => {
  const html = await buildCvHtml(cv, theme, layout);
  const baseName = fileBaseName(cv.fullName, "CV");
  if (type === "word") {
    await downloadCvDocx(cv, `${baseName}.docx`);
    return;
  }
  await downloadPdfFromHtml(html, `${baseName}.pdf`);
};

export const buildCoverLetterHtml = (letter, cv, theme = { color: "#0f66d0", dark: "#0f172a" }) => {
  const cleanLetter = sanitizeCoverLetter(letter);
  return `
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 34px; font-family: Arial, sans-serif; color: #111827; line-height: 1.65; background: #ffffff; }
        h1 { color: #0f172a; margin: 0 0 4px; font-size: 28px; }
        p { margin: 0 0 14px; }
        .header { border-bottom: 3px solid ${theme.color}; padding-bottom: 16px; margin-bottom: 22px; }
        .muted { color: #4b5563; font-size: 12px; }
        .section { margin-top: 18px; }
        .signature { color: ${theme.dark}; font-weight: 800; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(cv.fullName)}</h1>
        <p class="muted">${escapeHtml(cv.jobTitle)} | ${escapeHtml(cv.email)} | ${escapeHtml(cv.phone)} | ${escapeHtml(cv.country)}</p>
        ${cleanLetter.linkedIn || cleanLetter.nationality || cleanLetter.visaStatus ? `<p class="muted">${escapeHtml([cleanLetter.linkedIn, cleanLetter.nationality && `Nationality: ${cleanLetter.nationality}`, cleanLetter.visaStatus && `Visa Status: ${cleanLetter.visaStatus}`].filter(Boolean).join(" | "))}</p>` : ""}
      </div>
      <p>${escapeHtml(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))}</p>
      <div class="section">
        <p>${escapeHtml(cleanLetter.companyName)}</p>
        <p>${escapeHtml(cleanLetter.companyAddress)}</p>
      </div>
      <p class="section">Dear ${escapeHtml(cleanLetter.hiringManager || "Hiring Manager")},</p>
      <p>${escapeHtml(cleanLetter.opening).replaceAll("\n", "<br />")}</p>
      <p>${escapeHtml(cleanLetter.body).replaceAll("\n", "<br />")}</p>
      ${cleanLetter.qualifications ? `<p>${escapeHtml(cleanLetter.qualifications).replaceAll("\n", "<br />")}</p>` : ""}
      ${cleanLetter.value ? `<p>${escapeHtml(cleanLetter.value).replaceAll("\n", "<br />")}</p>` : ""}
      <p>${escapeHtml(cleanLetter.closing).replaceAll("\n", "<br />")}</p>
      <p class="section">Sincerely,</p>
      <p class="signature">${escapeHtml(cv.fullName)}</p>
    </body>
  </html>
`;
};

export const downloadCoverLetterFile = async (letter, cv, type, theme) => {
  const html = buildCoverLetterHtml(letter, cv, theme);
  const baseName = fileBaseName(cv.fullName, "Cover_Letter");
  if (type === "word") {
    await downloadCoverLetterDocx(letter, cv, `${baseName}.docx`);
    return;
  }
  await downloadPdfFromHtml(html, `${baseName}.pdf`);
};
