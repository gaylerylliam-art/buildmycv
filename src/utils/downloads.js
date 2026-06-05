const joinLines = (value) =>
  value
    .split("\n")
    .map((line) => `<li>${line.trim()}</li>`)
    .join("");

export const buildCvHtml = (cv) => `
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #111827; line-height: 1.5; }
        h1 { color: #0f172a; margin-bottom: 4px; }
        h2 { color: #0f66d0; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
        .contact { color: #4b5563; }
        .photo { width: 96px; height: 96px; object-fit: cover; }
        .round { border-radius: 999px; }
        .square { border-radius: 4px; }
      </style>
    </head>
    <body>
      ${cv.profilePhoto ? `<img class="photo ${cv.photoShape === "round" ? "round" : "square"}" src="${cv.profilePhoto}" alt="Profile photo" />` : ""}
      <h1>${cv.fullName}</h1>
      <p><strong>${cv.jobTitle}</strong></p>
      <p class="contact">${cv.email} | ${cv.phone} | ${cv.country}</p>
      <h2>Professional Summary</h2><p>${cv.summary}</p>
      <h2>Skills</h2><p>${cv.skills}</p>
      <h2>Work Experience</h2><ul>${joinLines(cv.experience)}</ul>
      <h2>Education</h2><p>${cv.education}</p>
      <h2>Certifications</h2><p>${cv.certifications}</p>
      <h2>Languages</h2><p>${cv.languages}</p>
      <h2>References</h2><p>${cv.references}</p>
    </body>
  </html>
`;

export const downloadMockFile = (cv, type) => {
  const html = buildCvHtml(cv);
  const blob =
    type === "word"
      ? new Blob([html], { type: "application/msword" })
      : new Blob(
          [
            `Mock PDF export\n\n${cv.fullName}\n${cv.jobTitle}\n${cv.email} | ${cv.phone} | ${cv.country}\n\n${cv.summary}\n\nSkills: ${cv.skills}`,
            cv.profilePhoto ? `\n\nProfile photo included as ${cv.photoShape} in live preview. Connect real PDF generation to embed image output.` : "",
          ],
          { type: "application/pdf" }
        );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${cv.fullName.replaceAll(" ", "-").toLowerCase()}-cv.${type === "word" ? "doc" : "pdf"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
