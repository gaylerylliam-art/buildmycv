const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const escapeHtml = (value = "") =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const lines = (value = "") => String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);

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
      ...lines(entry.responsibilities).map((line) => `- ${line.replace(/^[-•*]\s*/, "")}`),
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
    <h1 style="margin:0;color:#0f172a">${escapeHtml(cv.fullName)}</h1>
    <p style="font-weight:bold;color:#0f66d0">${escapeHtml(cv.jobTitle)}</p>
    <p>${escapeHtml([cv.email, cv.phone, cv.country].filter(Boolean).join(" | "))}</p>
    <h2>Professional Summary</h2><p>${escapeHtml(cv.summary)}</p>
    <h2>Work Experience</h2>
    ${(Array.isArray(cv.workExperiences) ? cv.workExperiences : []).map((entry) => `
      <p><strong>${escapeHtml(entry.jobTitle)}</strong><br>${escapeHtml([entry.employer, entry.companyLocation, [entry.fromDate, entry.isCurrent ? "Present" : entry.toDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | "))}</p>
      <ul>${lines(entry.responsibilities).map((line) => `<li>${escapeHtml(line.replace(/^[-•*]\s*/, ""))}</li>`).join("")}</ul>
    `).join("")}
    <h2>Education</h2><p>${escapeHtml(cv.education)}</p>
    <h2>Skills</h2><p>${escapeHtml(cv.skills)}</p>
    <h2>Certifications</h2><p>${escapeHtml(cv.certifications)}</p>
    <h2>Languages</h2><p>${escapeHtml(cv.languages)}</p>
    <p style="margin-top:20px;color:#64748b">This CV copy was generated with BuildMyCVNow. You can also download PDF or Word from the website.</p>
  </div>`;

const sendEmail = async ({ toEmail, cv }) => {
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
        reply_to: process.env.CONTACT_TO_EMAIL || "gaylerylliam@gmail.com",
        subject: `Your BuildMyCVNow CV - ${cv.fullName || "CV"}`,
        cv_name: cv.fullName || "Your CV",
        cv_text: cvText(cv),
        cv_html: cvHtml(cv),
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not email CV: ${detail || response.statusText}`);
  }
  return true;
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Use POST." });
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, message: "Invalid JSON." });
  }
  const toEmail = String(payload.email || payload.cv?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) return json(400, { ok: false, message: "A valid email address is required." });
  if (!payload.cv?.fullName) return json(400, { ok: false, message: "CV data is required." });

  const forwarded = await sendEmail({ toEmail, cv: payload.cv });
  return json(200, {
    ok: true,
    forwarded,
    message: forwarded ? `CV sent to ${toEmail}.` : "CV email is ready, but EmailJS CV template variables are not configured in Netlify.",
  });
};
