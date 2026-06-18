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

const isExportPlaceholder = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return true;
  return [
    /^add\b.*\bhere\.?$/i,
    /^please review imported cv/i,
    /^employer name$/i,
    /^job title$/i,
    /^available upon request$/i,
  ].some((pattern) => pattern.test(text));
};

const cleanExportText = (value = "") => {
  const text = String(value || "").trim();
  return isExportPlaceholder(text) ? "" : text;
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

const exportIconSvg = (name) => {
  const attrs = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const icons = {
    mail: `<svg ${attrs}><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 6 8-6"></path></svg>`,
    phone: `<svg ${attrs}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6.27 6.27l1.27-1.28a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"></path></svg>`,
    pin: `<svg ${attrs}><path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z"></path><circle cx="12" cy="11" r="2.5"></circle></svg>`,
    briefcase: `<svg ${attrs}><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path></svg>`,
    graduation: `<svg ${attrs}><path d="m2 9 10-5 10 5-10 5-10-5z"></path><path d="M6 11v4.5c0 .8 2.7 2.5 6 2.5s6-1.7 6-2.5V11"></path><path d="M22 9v6"></path></svg>`,
    award: `<svg ${attrs}><circle cx="12" cy="8" r="5"></circle><path d="m8.2 13.9-1.4 6.1L12 17l5.2 3-1.4-6.1"></path></svg>`,
    sparkle: `<svg ${attrs}><path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z"></path><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"></path></svg>`,
    user: `<svg ${attrs}><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    globe: `<svg ${attrs}><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 0 20"></path><path d="M12 2a15.3 15.3 0 0 0 0 20"></path></svg>`,
    folder: `<svg ${attrs}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path></svg>`,
    file: `<svg ${attrs}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M9 15h6"></path><path d="M9 11h2"></path></svg>`,
  };
  return icons[name] || icons.file;
};

const exportSectionIcon = (id) => ({
  summary: "file",
  experience: "briefcase",
  education: "graduation",
  educationProjects: "folder",
  skills: "sparkle",
  certifications: "award",
  languages: "globe",
  references: "user",
  personalDetails: "user",
}[id] || "file");

const exportHeadingHtml = (title, iconName) =>
  `<h2><span class="section-icon">${exportIconSvg(iconName)}</span><span>${escapeHtml(title)}</span></h2>`;

const cvContactItems = (cv) =>
  [
    cv.email ? { icon: "mail", value: cv.email } : null,
    cv.phone ? { icon: "phone", value: cv.phone } : null,
    cv.country ? { icon: "pin", value: cv.country } : null,
    cv.linkedIn ? { icon: "globe", value: `LinkedIn: ${cv.linkedIn}` } : null,
    cv.portfolioUrl ? { icon: "globe", value: `Portfolio: ${cv.portfolioUrl}` } : null,
  ].filter(Boolean);

const inlineContactHtml = (items = []) =>
  items.map((item) => `<span class="contact-item"><span class="contact-icon">${exportIconSvg(item.icon)}</span><span>${escapeHtml(item.value)}</span></span>`).join("");

const cvPersonalDetails = (cv) =>
  [
    cleanExportText(cv.nationality) ? `Nationality: ${cleanExportText(cv.nationality)}` : "",
    cleanExportText(cv.visaStatus) ? `Visa Status: ${cleanExportText(cv.visaStatus)}` : "",
    cleanExportText(cv.drivingLicense) ? `Driving License: ${cleanExportText(cv.drivingLicense)}` : "",
    cv.expectedSalaryEnabled && cleanExportText(cv.expectedSalary) ? `Expected Salary: ${cleanExportText(cv.expectedSalary)}` : "",
  ].filter(Boolean);

const defaultSectionOrder = ["summary", "experience", "education", "skills", "educationProjects", "certifications", "languages", "references"];
const defaultQrCode = { enabled: false, url: "", label: "Scan for LinkedIn", position: "header" };
const isArabicLanguage = (language = "") => /arabic|عربي|العربية/i.test(String(language || ""));

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

const getCvPageBorderConfig = (cv = {}) => {
  const preset = ["1cm", "1in", "custom"].includes(cv.pageBorderPreset) ? cv.pageBorderPreset : "1cm";
  if (preset === "1cm") return { preset, unit: "cm", value: 1, inches: 1 / 2.54, millimeters: 10 };
  if (preset === "1in") return { preset, unit: "in", value: 1, inches: 1, millimeters: 25.4 };
  const unit = cv.pageBorderUnit === "in" ? "in" : "cm";
  const parsed = Number.parseFloat(cv.pageBorderValue);
  const safeValue = Number.isFinite(parsed) ? Math.min(3, Math.max(0, parsed)) : 1;
  const inches = unit === "in" ? safeValue : safeValue / 2.54;
  return { preset, unit, value: safeValue, inches, millimeters: inches * 25.4 };
};

const hexToDocxColor = (value = "#0f66d0") => String(value || "#0f66d0").replace("#", "").slice(0, 6).toUpperCase();

const base64ToUint8Array = (base64 = "") => {
  const binary = typeof atob === "function"
    ? atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const imageTypeFromMime = (mime = "") => {
  if (/jpe?g/i.test(mime)) return "jpg";
  if (/gif/i.test(mime)) return "gif";
  if (/bmp/i.test(mime)) return "bmp";
  return "png";
};

const profilePhotoDataForDocx = async (source = "") => {
  if (!source) return null;
  try {
    if (source.startsWith("data:")) {
      const match = source.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
      if (!match) return null;
      const mime = match[1] || "image/png";
      const encoded = match[3] || "";
      const data = match[2]
        ? base64ToUint8Array(encoded)
        : new TextEncoder().encode(decodeURIComponent(encoded));
      return { data, type: imageTypeFromMime(mime) };
    }

    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return { data: new Uint8Array(await blob.arrayBuffer()), type: imageTypeFromMime(blob.type) };
  } catch (error) {
    console.warn("Could not prepare profile photo for DOCX export.", error);
    return null;
  }
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
  if (id === "experience") return normalizeCvWorkExperiences(cv).some((entry) => [entry.jobTitle, entry.employer, entry.responsibilities].some((value) => cleanExportText(value)));
  if (id === "references") return referencesHasContent(cv.references);
  if (id === "educationProjects") return Boolean(cleanExportText(cv.projects));
  return Boolean(cleanExportText(cv[id]));
};

const visibleSectionOrder = (cv = {}) => {
  const hidden = Array.isArray(cv.hiddenSections) ? cv.hiddenSections : [];
  return normalizeSectionOrder(cv).filter((id) => !hidden.includes(id) && sectionHasContent(cv, id));
};

const workExperienceHtml = (cv) =>
  normalizeCvWorkExperiences(cv)
    .map((entry) => {
      const jobTitle = cleanExportText(entry.jobTitle);
      const employer = cleanExportText(entry.employer);
      const location = cleanExportText(entry.companyLocation);
      const responsibilities = cleanExportText(entry.responsibilities);
      const dates = [entry.fromDate, entry.isCurrent ? "Present" : entry.toDate].filter(Boolean).join(" - ");
      if (![jobTitle, employer, location, dates, responsibilities].some(Boolean)) return "";
      return `
        <div class="experience-item">
          ${jobTitle ? `<p><strong>${escapeHtml(jobTitle)}</strong></p>` : ""}
          ${[employer, location, dates].filter(Boolean).length ? `<p>${escapeHtml([employer, location, dates].filter(Boolean).join(" | "))}</p>` : ""}
          ${responsibilities ? `<ul>${joinLines(responsibilities)}</ul>` : ""}
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
    summary: `<div class="section">${exportHeadingHtml("Professional Summary", exportSectionIcon("summary"))}<p>${escapeHtml(cleanExportText(cv.summary))}</p></div>`,
    experience: `<div class="section">${exportHeadingHtml("Work Experience", exportSectionIcon("experience"))}${workExperienceHtml(cv)}</div>`,
    education: `<div class="section">${exportHeadingHtml("Education", exportSectionIcon("education"))}<p>${escapeHtml(cleanExportText(cv.education))}</p></div>`,
    educationProjects: `<div class="section">${exportHeadingHtml("Projects", exportSectionIcon("educationProjects"))}<p>${escapeHtml(cleanExportText(cv.projects))}</p></div>`,
    skills: `<div class="section">${exportHeadingHtml("Skills", exportSectionIcon("skills"))}<p>${escapeHtml(cleanExportText(cv.skills))}</p></div>`,
    certifications: `<div class="section">${exportHeadingHtml("Certifications", exportSectionIcon("certifications"))}<p>${escapeHtml(cleanExportText(cv.certifications))}</p></div>`,
    languages: `<div class="section">${exportHeadingHtml("Languages", exportSectionIcon("languages"))}<p>${escapeHtml(cleanExportText(cv.languages))}</p></div>`,
    references: `<div class="section references-block">${exportHeadingHtml("References", exportSectionIcon("references"))}${referencesHtml(cv.references)}</div>`,
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

const downloadCvDocx = async (cv, filename, theme = { color: "#0f66d0", dark: "#0f172a" }, layout = "classic") => {
  const { AlignmentType, Document, ImageRun, Packer, Paragraph, TextRun } = await import("docx");
  const accent = hexToDocxColor(theme.color);
  const dark = hexToDocxColor(theme.dark);
  const pageBorder = getCvPageBorderConfig(cv);
  const docMargin = Math.round(pageBorder.inches * 1440);
  const photo = await profilePhotoDataForDocx(cv.profilePhoto);
  const paragraph = (text = "", options = {}) =>
    new Paragraph({
      spacing: { before: options.before ?? 0, after: options.after ?? 150 },
      alignment: options.alignment,
      bullet: options.bullet ? { level: 0 } : undefined,
      keepNext: options.keepNext,
      children: [new TextRun({
        text: String(text || ""),
        bold: options.bold,
        size: options.size || 22,
        color: options.color,
        italics: options.italics,
      })],
    });
  const sectionHeading = (text) =>
    new Paragraph({
      spacing: { before: 180, after: 90 },
      border: { bottom: { color: accent, space: 2, size: 6, style: "single" } },
      keepNext: true,
      children: [new TextRun({ text, bold: true, size: 22, color: dark, allCaps: true })],
    });
  const photoParagraph = photo
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            data: photo.data,
            type: photo.type,
            transformation: { width: 96, height: 96 },
            altText: {
              title: "Profile photo",
              description: `${cv.fullName || "Applicant"} profile photo`,
              name: "Profile photo",
            },
          }),
        ],
      })
    : null;
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
      summary: [sectionHeading("Professional Summary"), paragraph(cleanExportText(cv.summary))],
      experience: [
        sectionHeading("Work Experience"),
        ...workExperiences.flatMap((entry) => {
          const meta = [
            cleanExportText(entry.employer),
            cleanExportText(entry.companyLocation),
            [entry.fromDate, entry.isCurrent ? "Present" : entry.toDate].filter(Boolean).join(" - "),
          ].filter(Boolean).join(" | ");
          return [
            cleanExportText(entry.jobTitle) ? paragraph(cleanExportText(entry.jobTitle), { bold: true, after: 50, keepNext: true }) : null,
            meta ? paragraph(meta, { size: 20, after: 60, color: "475569", keepNext: true }) : null,
            ...cleanExportText(entry.responsibilities).split("\n").map((line) => line.trim().replace(/^[-•●▪◦*]\s*/, "")).filter(Boolean).map((line) => paragraph(line, { bullet: true, after: 45 })),
          ].filter(Boolean);
        }),
      ],
      education: [sectionHeading("Education"), paragraph(cleanExportText(cv.education))],
      educationProjects: [sectionHeading("Projects"), paragraph(cleanExportText(cv.projects))],
      skills: [sectionHeading("Skills"), paragraph(cleanExportText(cv.skills))],
      certifications: [sectionHeading("Certifications"), paragraph(cleanExportText(cv.certifications))],
      languages: [sectionHeading("Languages"), paragraph(cleanExportText(cv.languages))],
      references: [sectionHeading("References"), ...referenceParagraphs()],
    };
    return sections[id] || [];
  };
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: docMargin, right: docMargin, bottom: docMargin, left: docMargin },
          },
        },
        children: [
          ...(photoParagraph ? [photoParagraph] : []),
          paragraph(cleanExportText(cv.fullName) || "Applicant Name", { bold: true, size: 36, after: 50, alignment: AlignmentType.CENTER, color: dark }),
          paragraph(cleanExportText(cv.jobTitle), { bold: true, size: 24, after: 80, alignment: AlignmentType.CENTER, color: accent }),
          ...cvContactLines(cv).map((line) => paragraph(line, { size: 18, after: 45, alignment: AlignmentType.CENTER, color: "475569" })),
          paragraph("", { after: layout === "compact" ? 50 : 120 }),
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
  const isRtl = cv.languageDirection === "rtl" || isArabicLanguage(cv.outputLanguage);
  const pageBorder = getCvPageBorderConfig(cv);
  const pageBorderPx = Math.round(pageBorder.inches * 96);
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
        body { width: 210mm; min-height: 297mm; margin: 0 auto; padding: ${pageBorder.millimeters}mm; font-family: Arial, sans-serif; font-size: 11px; color: #111827; line-height: 1.38; background: #ffffff; overflow-wrap: anywhere; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body.rtl { direction: rtl; text-align: right; }
        body.rtl ul { padding-left: 0; padding-right: 18px; }
        h1 { color: #0f172a; margin: 0 0 3px; font-size: 26px; line-height: 1.12; }
        h2 { color: ${theme.dark}; border-bottom: 1px solid ${theme.color}; padding-bottom: 4px; margin: 14px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0; display: flex; align-items: center; gap: 6px; }
        p { margin: 0 0 8px; white-space: pre-line; }
        ul { margin: 0; padding-left: 18px; }
        li { margin-bottom: 3px; break-inside: auto; page-break-inside: auto; }
        .section-icon, .contact-icon { display: inline-flex; align-items: center; justify-content: center; }
        .section-icon svg, .contact-icon svg { width: 12px; height: 12px; }
        .header { display: flex; gap: 12px; align-items: center; border-bottom: 3px solid ${theme.color}; padding-bottom: 12px; margin-bottom: 10px; min-width: 0; }
        .header-main { flex: 1 1 auto; min-width: 0; }
        .contact { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; color: #4b5563; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
        .contact-item { display: inline-flex; align-items: center; gap: 4px; }
        .title { color: ${theme.color}; font-weight: 700; }
        .photo { width: 78px; height: 78px; object-fit: cover; flex: 0 0 auto; }
        .round { border-radius: 999px; }
        .rounded { border-radius: 14px; }
        .square { border-radius: 5px; }
        .section { break-inside: auto; page-break-inside: auto; }
        .section h2 { break-after: avoid; page-break-after: avoid; }
        .experience-item { margin-bottom: 9px; break-inside: avoid; page-break-inside: avoid; }
        .references-block { break-inside: avoid; page-break-inside: avoid; }
        .references-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
        .reference-card { border: 1px solid #e2e8f0; border-radius: 5px; padding: 8px; font-size: 11px; }
        .muted { color: #64748b; }
        .qr-block { display: grid; justify-items: center; gap: 3px; text-align: center; color: inherit; }
        .qr-svg svg { display: block; width: 100%; height: 100%; }
        .qr-block p { margin: 0; font-size: 8pt; line-height: 1.15; }
        .sidebar-paper { display: grid; grid-template-columns: 38% 62%; min-height: ${Math.max(760, 1123 - pageBorderPx * 2)}px; padding: 0; }
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
        .sidebar-contact p { display: flex; align-items: center; gap: 5px; margin-bottom: 6px; }
        .main-content { padding: 20px; min-width: 0; }
        .credit-footer { margin: 24px 0 0; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 7pt; text-align: center; }
      </style>
    </head>
    <body class="${isRtl ? "rtl" : ""}" dir="${isRtl ? "rtl" : "ltr"}">
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
            ${cvContactItems(cv).map((item) => `<p><span class="contact-icon">${exportIconSvg(item.icon)}</span><span>${escapeHtml(item.value)}</span></p>`).join("")}
          </div>
          ${qrSidebar}
        </aside>
        <main class="main-content">
          ${cvPersonalDetails(cv).length ? `<div class="section">${exportHeadingHtml("Personal Details", exportSectionIcon("personalDetails"))}<p>${escapeHtml(cvPersonalDetails(cv).join("\n"))}</p></div>` : ""}
          ${visibleSectionOrder(cv).map((id) => cvSectionHtml(cv, id)).join("")}
        </main>
      </div>` : `
      <div class="header">
        ${cv.profilePhoto ? `<img class="photo ${exportPhotoShapeClass(cv.photoShape)}" src="${cv.profilePhoto}" alt="Profile photo" />` : ""}
        <div class="header-main">
          <h1>${escapeHtml(cv.fullName)}</h1>
          <p class="title">${escapeHtml(cv.jobTitle)}</p>
          <p class="contact">${inlineContactHtml(cvContactItems(cv))}</p>
        </div>
        ${qrHeader}
      </div>
      ${cvPersonalDetails(cv).length ? `<div class="section">${exportHeadingHtml("Personal Details", exportSectionIcon("personalDetails"))}<p>${escapeHtml(cvPersonalDetails(cv).join("\n"))}</p></div>` : ""}
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
  const baseName = fileBaseName(cv.fullName, "CV");
  if (type === "word") {
    await downloadCvDocx(cv, `${baseName}.docx`, theme, layout);
    return;
  }
  const html = await buildCvHtml(cv, theme, layout);
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
