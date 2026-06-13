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

const isArabicLanguage = (language = "") => /arabic|عربي|العربية/i.test(String(language || ""));

const normalizeExperience = (entry = {}) => ({
  id: entry.id,
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

const normalizeCv = (data = {}, fallback = {}, outputLanguage = "English") => {
  const experiences = Array.isArray(data.workExperiences)
    ? data.workExperiences.map(normalizeExperience).filter((entry) => entry.jobTitle || entry.employer || entry.responsibilities)
    : Array.isArray(fallback.workExperiences)
      ? fallback.workExperiences.map(normalizeExperience)
      : [];

  return {
    ...fallback,
    fullName: String(data.fullName || fallback.fullName || "").trim(),
    jobTitle: String(data.jobTitle || fallback.jobTitle || "").trim(),
    email: String(data.email || fallback.email || "").trim(),
    phone: String(data.phone || fallback.phone || "").trim(),
    country: String(data.country || fallback.country || "").trim(),
    nationality: String(data.nationality || fallback.nationality || "").trim(),
    visaStatus: String(data.visaStatus || fallback.visaStatus || "").trim(),
    linkedIn: String(data.linkedIn || fallback.linkedIn || "").trim(),
    portfolioUrl: String(data.portfolioUrl || fallback.portfolioUrl || "").trim(),
    drivingLicense: String(data.drivingLicense || fallback.drivingLicense || "").trim(),
    summary: String(data.summary || fallback.summary || "").trim(),
    skills: Array.isArray(data.skills) ? data.skills.filter(Boolean).join(", ") : String(data.skills || fallback.skills || "").trim(),
    workExperiences: experiences,
    experience: experiences.map((entry) => [entry.jobTitle, entry.employer, entry.companyLocation, entry.fromDate || entry.toDate ? `${entry.fromDate} - ${entry.isCurrent ? "Present" : entry.toDate}` : "", entry.responsibilities].filter(Boolean).join("\n")).join("\n\n"),
    education: Array.isArray(data.education) ? data.education.filter(Boolean).join("\n") : String(data.education || fallback.education || "").trim(),
    projects: Array.isArray(data.projects) ? data.projects.filter(Boolean).join("\n") : String(data.projects || fallback.projects || "").trim(),
    certifications: Array.isArray(data.certifications) ? data.certifications.filter(Boolean).join("\n") : String(data.certifications || fallback.certifications || "").trim(),
    languages: Array.isArray(data.languages) ? data.languages.filter(Boolean).join(", ") : String(data.languages || fallback.languages || "").trim(),
    references: String(data.references || fallback.references || "Available upon request").trim(),
    originalLanguage: String(data.originalLanguage || fallback.originalLanguage || "Auto-detected").trim(),
    outputLanguage,
    languageDirection: isArabicLanguage(outputLanguage) ? "rtl" : "ltr",
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

  const cv = payload.cv || {};
  const outputLanguage = String(payload.outputLanguage || "English").trim() || "English";
  const improveWording = payload.improveWording !== false;

  if (!process.env.OPENAI_API_KEY) {
    return json(503, { ok: false, mode: "fallback", message: "AI CV translation is not configured." });
  }

  const prompt = `Translate and professionally rewrite this structured CV for a resume builder.

Rules:
- Return JSON only. No markdown.
- Preserve facts exactly: names, emails, phone numbers, links, employers, dates, locations, education, certificates.
- Detect the original language and set originalLanguage.
- Output all editable CV wording in ${outputLanguage}.
- ${improveWording ? "Improve wording to professional resume standards; correct grammar and spelling; use concise achievement-focused wording." : "Translate clearly while keeping wording close to the original."}
- Do not invent skills, jobs, degrees, certificates, achievements, countries, or dates.
- Keep each work experience separate and keep duties attached to the correct employer.
- Keep fullName, email, phone, linkedIn, and portfolioUrl unchanged.
- For Arabic output, use natural Arabic resume language and set languageDirection to "rtl"; otherwise set "ltr".

Return this exact shape:
{
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
  "originalLanguage": "",
  "languageDirection": ""
}

CV JSON:
${JSON.stringify(cv).slice(0, 24000)}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert multilingual resume translator and CV editor. Return valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    return json(response.status, { ok: false, message: "AI CV translation failed. Please try again or edit the imported CV manually." });
  }

  try {
    const data = await response.json();
    const parsed = parseJsonContent(data.choices?.[0]?.message?.content || "{}");
    return json(200, { ok: true, cv: normalizeCv(parsed, cv, outputLanguage) });
  } catch {
    return json(502, { ok: false, message: "AI returned an unreadable CV translation. Please try again." });
  }
};
