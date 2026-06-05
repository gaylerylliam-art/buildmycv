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

export const buildCvHtml = (cv, theme = { color: "#0f66d0", dark: "#0f172a" }) => `
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
      </style>
    </head>
    <body>
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
    </body>
  </html>
`;

export const downloadCvFile = async (cv, type, theme) => {
  const html = buildCvHtml(cv, theme);
  const baseName = fileBaseName(cv.fullName, "CV");
  if (type === "word") {
    saveBlob(new Blob([html], { type: "application/msword" }), `${baseName}.doc`);
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
      </div>
      <div class="section">
        <p>${escapeHtml(letter.companyName)}</p>
        <p>${escapeHtml(letter.companyAddress)}</p>
      </div>
      <p class="section">Dear ${escapeHtml(letter.hiringManager || "Hiring Manager")},</p>
      <p>${escapeHtml(letter.opening).replaceAll("\n", "<br />")}</p>
      <p>${escapeHtml(letter.body).replaceAll("\n", "<br />")}</p>
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
    saveBlob(new Blob([html], { type: "application/msword" }), `${baseName}.doc`);
    return;
  }
  await downloadPdfFromHtml(html, `${baseName}.pdf`);
};
