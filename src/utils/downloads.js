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

const downloadPdfFromHtml = async (html, filename) => {
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
    letter.linkedIn ? `LinkedIn: ${letter.linkedIn}` : "",
    letter.nationality ? `Nationality: ${letter.nationality}` : "",
    letter.visaStatus ? `Visa Status: ${letter.visaStatus}` : "",
  ].filter(Boolean);
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          paragraph(cv.fullName, { bold: true, size: 32, after: 80 }),
          ...contactLines.map((line) => paragraph(line, { size: 18, after: 70 })),
          paragraph(today),
          paragraph(letter.companyName),
          paragraph(letter.companyAddress),
          paragraph(`Dear ${letter.hiringManager || "Hiring Manager"},`),
          paragraph(letter.opening),
          paragraph(letter.body),
          letter.qualifications ? paragraph(letter.qualifications) : paragraph("", { after: 0 }),
          letter.value ? paragraph(letter.value) : paragraph("", { after: 0 }),
          paragraph(letter.closing),
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
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          paragraph(cv.fullName, { bold: true, size: 34, after: 80 }),
          paragraph(cv.jobTitle, { bold: true, size: 24, after: 80 }),
          paragraph(`${cv.email} | ${cv.phone} | ${cv.country}`, { size: 18 }),
          sectionHeading("Professional Summary"),
          paragraph(cv.summary),
          sectionHeading("Skills"),
          paragraph(cv.skills),
          sectionHeading("Work Experience"),
          ...String(cv.experience || "").split("\n").filter(Boolean).map((line) => paragraph(`• ${line}`)),
          sectionHeading("Education"),
          paragraph(cv.education),
          sectionHeading("Certifications"),
          paragraph(cv.certifications),
          sectionHeading("Languages"),
          paragraph(cv.languages),
          sectionHeading("References"),
          paragraph(cv.references),
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
        .square { border-radius: 5px; }
        .section { break-inside: avoid; page-break-inside: avoid; }
        .sidebar-paper { display: grid; grid-template-columns: 38% 62%; min-height: 970px; padding: 0; }
        .sidebar { background: ${theme.dark}; color: #ffffff; padding: 20px 24px 28px; }
        .sidebar-header { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 20px; }
        .photo-container { width: 100%; display: flex; justify-content: center; margin-bottom: 20px; }
        .profile-photo { width: 170px; height: 170px; object-fit: cover; display: block; background: rgba(255,255,255,0.14); border: 3px solid rgba(255,255,255,0.22); }
        .profile-photo.round { border-radius: 50%; }
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
              ${cv.profilePhoto ? `<img class="profile-photo ${cv.photoShape === "round" ? "round" : "square"}" src="${cv.profilePhoto}" alt="Profile photo" />` : `<div class="profile-photo placeholder ${cv.photoShape === "round" ? "round" : "square"}">${escapeHtml(initialsForPdf(cv.fullName))}</div>`}
            </div>
            <div class="name-block">
              <h1 class="sidebar-name">${escapeHtml(cv.fullName)}</h1>
              <p class="sidebar-title">${escapeHtml(cv.jobTitle)}</p>
            </div>
          </div>
          <div class="sidebar-contact">
            <p>${escapeHtml(cv.email)}</p>
            <p>${escapeHtml(cv.phone)}</p>
            <p>${escapeHtml(cv.country)}</p>
          </div>
        </aside>
        <main class="main-content">
          <div class="section"><h2>Professional Summary</h2><p>${escapeHtml(cv.summary)}</p></div>
          <div class="section"><h2>Skills</h2><p>${escapeHtml(cv.skills)}</p></div>
          <div class="section"><h2>Work Experience</h2><ul>${joinLines(cv.experience)}</ul></div>
          <div class="section"><h2>Education</h2><p>${escapeHtml(cv.education)}</p></div>
          <div class="section"><h2>Certifications</h2><p>${escapeHtml(cv.certifications)}</p></div>
          <div class="section"><h2>Languages</h2><p>${escapeHtml(cv.languages)}</p></div>
          <div class="section"><h2>References</h2><p>${escapeHtml(cv.references)}</p></div>
        </main>
      </div>` : `
      <div class="header">
        ${cv.profilePhoto ? `<img class="photo ${cv.photoShape === "round" ? "round" : "square"}" src="${cv.profilePhoto}" alt="Profile photo" />` : ""}
        <div>
          <h1>${escapeHtml(cv.fullName)}</h1>
          <p class="title">${escapeHtml(cv.jobTitle)}</p>
          <p class="contact">${escapeHtml(cv.email)} | ${escapeHtml(cv.phone)} | ${escapeHtml(cv.country)}</p>
        </div>
      </div>
      <div class="section"><h2>Professional Summary</h2><p>${escapeHtml(cv.summary)}</p></div>
      <div class="section"><h2>Skills</h2><p>${escapeHtml(cv.skills)}</p></div>
      <div class="section"><h2>Work Experience</h2><ul>${joinLines(cv.experience)}</ul></div>
      <div class="section"><h2>Education</h2><p>${escapeHtml(cv.education)}</p></div>
      <div class="section"><h2>Certifications</h2><p>${escapeHtml(cv.certifications)}</p></div>
      <div class="section"><h2>Languages</h2><p>${escapeHtml(cv.languages)}</p></div>
      <div class="section"><h2>References</h2><p>${escapeHtml(cv.references)}</p></div>
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

export const buildCoverLetterHtml = (letter, cv, theme = { color: "#0f66d0", dark: "#0f172a" }) => `
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
        ${letter.linkedIn || letter.nationality || letter.visaStatus ? `<p class="muted">${escapeHtml([letter.linkedIn, letter.nationality && `Nationality: ${letter.nationality}`, letter.visaStatus && `Visa Status: ${letter.visaStatus}`].filter(Boolean).join(" | "))}</p>` : ""}
      </div>
      <p>${escapeHtml(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))}</p>
      <div class="section">
        <p>${escapeHtml(letter.companyName)}</p>
        <p>${escapeHtml(letter.companyAddress)}</p>
      </div>
      <p class="section">Dear ${escapeHtml(letter.hiringManager || "Hiring Manager")},</p>
      <p>${escapeHtml(letter.opening).replaceAll("\n", "<br />")}</p>
      <p>${escapeHtml(letter.body).replaceAll("\n", "<br />")}</p>
      ${letter.qualifications ? `<p>${escapeHtml(letter.qualifications).replaceAll("\n", "<br />")}</p>` : ""}
      ${letter.value ? `<p>${escapeHtml(letter.value).replaceAll("\n", "<br />")}</p>` : ""}
      <p>${escapeHtml(letter.closing).replaceAll("\n", "<br />")}</p>
      <p class="section">Sincerely,</p>
      <p class="signature">${escapeHtml(cv.fullName)}</p>
    </body>
  </html>
`;

export const downloadCoverLetterFile = async (letter, cv, type, theme) => {
  const html = buildCoverLetterHtml(letter, cv, theme);
  const baseName = fileBaseName(cv.fullName, "Cover_Letter");
  if (type === "word") {
    await downloadCoverLetterDocx(letter, cv, `${baseName}.docx`);
    return;
  }
  await downloadPdfFromHtml(html, `${baseName}.pdf`);
};
