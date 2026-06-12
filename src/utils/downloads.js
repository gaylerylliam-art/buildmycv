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
    .map((line) => `<li>${escapeHtml(line.trim())}</li>`)
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

const cvPersonalDetails = (cv) =>
  [
    cv.nationality ? `Nationality: ${cv.nationality}` : "",
    cv.visaStatus ? `Visa Status: ${cv.visaStatus}` : "",
    cv.drivingLicense ? `Driving License: ${cv.drivingLicense}` : "",
    cv.expectedSalaryEnabled && cv.expectedSalary ? `Expected Salary: ${cv.expectedSalary}` : "",
  ].filter(Boolean);

const defaultSectionOrder = ["summary", "experience", "education", "skills", "certifications", "languages", "references"];

const normalizeSectionOrder = (cv = {}) => {
  const order = Array.isArray(cv.sectionOrder) ? cv.sectionOrder : [];
  return [...order.filter((id) => defaultSectionOrder.includes(id)), ...defaultSectionOrder.filter((id) => !order.includes(id))];
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

const cvSectionHtml = (cv, id) => {
  const sections = {
    summary: `<div class="section"><h2>Professional Summary</h2><p>${escapeHtml(cv.summary)}</p></div>`,
    experience: `<div class="section"><h2>Work Experience</h2>${workExperienceHtml(cv)}</div>`,
    education: `<div class="section"><h2>Education</h2><p>${escapeHtml(cv.education)}</p></div>`,
    skills: `<div class="section"><h2>Skills</h2><p>${escapeHtml(cv.skills)}</p></div>`,
    certifications: `<div class="section"><h2>Certifications</h2><p>${escapeHtml(cv.certifications)}</p></div>`,
    languages: `<div class="section"><h2>Languages</h2><p>${escapeHtml(cv.languages)}</p></div>`,
    references: `<div class="section"><h2>References</h2><p>${escapeHtml(cv.references)}</p></div>`,
  };
  return sections[id] || "";
};

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
      references: [sectionHeading("References"), paragraph(cv.references)],
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

export const buildCvHtml = (cv, theme = { color: "#0f66d0", dark: "#0f172a" }, layout = "classic") => `
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 28px; font-family: Arial, sans-serif; color: #111827; line-height: 1.5; background: #ffffff; }
        h1 { color: #0f172a; margin: 0 0 4px; font-size: 30px; line-height: 1.15; }
        h2 { color: ${theme.dark}; border-bottom: 1px solid ${theme.color}; padding-bottom: 5px; margin: 18px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0; }
        p { margin: 0 0 8px; }
        ul { margin: 0; padding-left: 18px; }
        li { margin-bottom: 4px; }
        .header { display: flex; gap: 16px; align-items: center; border-bottom: 3px solid ${theme.color}; padding-bottom: 16px; margin-bottom: 14px; }
        .contact { color: #4b5563; font-size: 12px; }
        .title { color: ${theme.color}; font-weight: 700; }
        .photo { width: 96px; height: 96px; object-fit: cover; flex: 0 0 auto; }
        .round { border-radius: 999px; }
        .rounded { border-radius: 14px; }
        .square { border-radius: 5px; }
        .section { break-inside: avoid; page-break-inside: avoid; }
        .experience-item { margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
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
        .main-content { padding: 28px; }
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
        </aside>
        <main class="main-content">
          ${cvPersonalDetails(cv).length ? `<div class="section"><h2>Personal Details</h2><p>${escapeHtml(cvPersonalDetails(cv).join("\n"))}</p></div>` : ""}
          ${visibleSectionOrder(cv).map((id) => cvSectionHtml(cv, id)).join("")}
        </main>
      </div>` : `
      <div class="header">
        ${cv.profilePhoto ? `<img class="photo ${exportPhotoShapeClass(cv.photoShape)}" src="${cv.profilePhoto}" alt="Profile photo" />` : ""}
        <div>
          <h1>${escapeHtml(cv.fullName)}</h1>
          <p class="title">${escapeHtml(cv.jobTitle)}</p>
          <p class="contact">${escapeHtml(cvContactLines(cv).join(" | "))}</p>
        </div>
      </div>
      ${cvPersonalDetails(cv).length ? `<div class="section"><h2>Personal Details</h2><p>${escapeHtml(cvPersonalDetails(cv).join("\n"))}</p></div>` : ""}
      ${visibleSectionOrder(cv).map((id) => cvSectionHtml(cv, id)).join("")}
      `}
    </body>
  </html>
`;

const initialsForPdf = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const downloadCvFile = async (cv, type, theme, layout = "classic") => {
  const html = buildCvHtml(cv, theme, layout);
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
