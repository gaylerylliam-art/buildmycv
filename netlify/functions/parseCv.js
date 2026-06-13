const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const parseJsonContent = (content = "") => {
  const cleaned = String(content || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI response was not valid JSON.");
  }
};

const normalizeExperience = (entry = {}) => ({
  jobTitle: String(entry.jobTitle || entry.position || "").trim(),
  employer: String(entry.employer || entry.company || entry.companyName || "").trim(),
  companyLocation: String(entry.companyLocation || entry.location || "").trim(),
  fromDate: String(entry.fromDate || entry.startDate || "").trim(),
  toDate: /present|current|till date|to date/i.test(String(entry.toDate || entry.endDate || ""))
    ? ""
    : String(entry.toDate || entry.endDate || "").trim(),
  isCurrent: Boolean(entry.isCurrent) || /present|current|till date|to date/i.test(String(entry.toDate || entry.endDate || "")),
  responsibilities: Array.isArray(entry.responsibilities)
    ? entry.responsibilities.filter(Boolean).join("\n")
    : String(entry.responsibilities || entry.duties || entry.achievements || "").trim(),
});

const normalizeCv = (data = {}, fileName = "") => {
  const experiences = Array.isArray(data.workExperiences)
    ? data.workExperiences.map(normalizeExperience).filter((entry) => entry.jobTitle || entry.employer || entry.responsibilities)
    : [];

  return {
    isCv: data.isCv !== false,
    fullName: String(data.fullName || "").trim(),
    jobTitle: String(data.jobTitle || "").trim(),
    email: String(data.email || "").trim(),
    phone: String(data.phone || "").trim(),
    country: String(data.country || data.location || "").trim(),
    nationality: String(data.nationality || "").trim(),
    visaStatus: String(data.visaStatus || "").trim(),
    linkedIn: String(data.linkedIn || data.linkedin || "").trim(),
    portfolioUrl: String(data.portfolioUrl || data.website || "").trim(),
    drivingLicense: String(data.drivingLicense || "").trim(),
    summary: String(data.summary || data.professionalSummary || "").trim(),
    skills: Array.isArray(data.skills) ? data.skills.filter(Boolean).join(", ") : String(data.skills || "").trim(),
    experience: experiences.map((entry) => [entry.jobTitle, entry.employer, entry.fromDate || entry.toDate ? `${entry.fromDate} - ${entry.isCurrent ? "Present" : entry.toDate}` : "", entry.responsibilities].filter(Boolean).join("\n")).join("\n\n"),
    workExperiences: experiences,
    education: Array.isArray(data.education) ? data.education.filter(Boolean).join("\n") : String(data.education || "").trim(),
    projects: Array.isArray(data.projects) ? data.projects.filter(Boolean).join("\n") : String(data.projects || "").trim(),
    certifications: Array.isArray(data.certifications) ? data.certifications.filter(Boolean).join("\n") : String(data.certifications || "").trim(),
    languages: Array.isArray(data.languages) ? data.languages.filter(Boolean).join(", ") : String(data.languages || "").trim(),
    references: String(data.references || "Available upon request").trim(),
    originalLanguage: String(data.originalLanguage || data.detectedLanguage || "").trim(),
    outputLanguage: String(data.outputLanguage || "").trim(),
    languageDirection: String(data.languageDirection || "").trim(),
    sourceFileName: fileName,
  };
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Use POST." });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, message: "Invalid JSON." });
  }

  const text = String(payload.text || "").replace(/\u0000/g, "").trim();
  const imageDataUrl = String(payload.imageDataUrl || "").trim();
  const fileName = String(payload.fileName || "uploaded-cv").trim();
  if (!imageDataUrl && text.length < 80) return json(400, { ok: false, message: "The uploaded file does not contain enough readable CV text." });

  if (!process.env.OPENAI_API_KEY) {
    return json(503, { ok: false, mode: "fallback", message: "AI CV extraction is not configured." });
  }

  const prompt = `Extract this uploaded CV/resume into structured JSON for a CV builder.

Rules:
- Return JSON only. No markdown.
- If this document is not a real CV/resume, set "isCv": false and leave fields blank.
- Do not copy the whole CV into summary or cover-letter fields.
- Extract each work experience separately.
- For every job, fill: jobTitle, employer, companyLocation, fromDate, toDate, isCurrent, responsibilities.
- Responsibilities must belong only to that employer/job. Use one duty per line.
- Extract projects if the CV has project work, capstone projects, portfolios, systems, websites, campaigns, or process improvements.
- Detect the original CV language and set originalLanguage.
- Keep wording factual. Do not invent companies, dates, countries, or education.
- Remove duplicate contact details from summary.

Return this exact shape:
{
  "isCv": true,
  "fullName": "",
  "jobTitle": "",
  "email": "",
  "phone": "",
  "country": "",
  "nationality": "",
  "visaStatus": "",
  "linkedIn": "",
  "portfolioUrl": "",
  "drivingLicense": "",
  "summary": "",
  "skills": [],
  "workExperiences": [
    {
      "jobTitle": "",
      "employer": "",
      "companyLocation": "",
      "fromDate": "",
      "toDate": "",
      "isCurrent": false,
      "responsibilities": []
    }
  ],
  "education": [],
  "projects": [],
  "certifications": [],
  "languages": [],
  "references": "",
  "originalLanguage": ""
}

File name: ${fileName}
${imageDataUrl ? "The CV is attached as an image. Use OCR/vision to read it accurately." : `CV text:\n${text.slice(0, 18000)}`}`;

  const userContent = imageDataUrl
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ]
    : prompt;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a precise CV/resume parser. Return valid JSON only." },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    return json(response.status, { ok: false, message: "AI CV extraction failed. Please try again or fill the form manually." });
  }

  try {
    const data = await response.json();
    const parsed = parseJsonContent(data.choices?.[0]?.message?.content || "{}");
    const cv = normalizeCv(parsed, fileName);
    if (!cv.isCv) return json(422, { ok: false, message: "This document does not look like a CV/resume. Please upload your actual CV file." });
    return json(200, { ok: true, mode: "ai", cv });
  } catch {
    return json(502, { ok: false, message: "AI returned an unreadable CV extraction. Please try again." });
  }
};
