const MAX_TEXT_CHARS = 24_000;
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

const parseBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
};

const cleanText = (value = "") =>
  String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_CHARS);

const cleanString = (value = "") => String(value || "").trim();

const clientKey = (event) =>
  event.headers["x-nf-client-connection-ip"]
  || event.headers["client-ip"]
  || event.headers["x-forwarded-for"]?.split(",")[0]?.trim()
  || "anonymous";

const isRateLimited = (event) => {
  const now = Date.now();
  const key = clientKey(event);
  const bucket = hits.get(key) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
};

const cleanWorkExperiences = (entries) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry = {}) => ({
      jobTitle: cleanString(entry.jobTitle),
      employer: cleanString(entry.employer),
      companyLocation: cleanString(entry.companyLocation),
      fromDate: cleanString(entry.fromDate),
      toDate: cleanString(entry.toDate),
      isCurrent: Boolean(entry.isCurrent),
      responsibilities: Array.isArray(entry.responsibilities)
        ? entry.responsibilities.map(cleanString).filter(Boolean).join("\n")
        : cleanString(entry.responsibilities),
    }))
    .filter((entry) => entry.jobTitle || entry.employer || entry.responsibilities);

const cleanEducationEntries = (entries) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry = {}) => ({
      qualification: cleanString(entry.qualification),
      school: cleanString(entry.school),
      location: cleanString(entry.location),
      fromDate: cleanString(entry.fromDate),
      toDate: cleanString(entry.toDate),
      details: Array.isArray(entry.details)
        ? entry.details.map(cleanString).filter(Boolean).join("\n")
        : cleanString(entry.details),
    }))
    .filter((entry) => entry.qualification || entry.school || entry.details);

const normalizeCv = (cv = {}) => ({
  fullName: cleanString(cv.fullName),
  jobTitle: cleanString(cv.jobTitle),
  email: cleanString(cv.email),
  phone: cleanString(cv.phone),
  country: cleanString(cv.country),
  nationality: cleanString(cv.nationality),
  visaStatus: cleanString(cv.visaStatus),
  drivingLicense: cleanString(cv.drivingLicense),
  linkedIn: cleanString(cv.linkedIn),
  portfolioUrl: cleanString(cv.portfolioUrl),
  summary: cleanString(cv.summary),
  skills: Array.isArray(cv.skills) ? cv.skills.map(cleanString).filter(Boolean).join("\n") : cleanString(cv.skills),
  experience: cleanString(cv.experience),
  workExperiences: cleanWorkExperiences(cv.workExperiences),
  educationEntries: cleanEducationEntries(cv.educationEntries),
  education: Array.isArray(cv.education) ? cv.education.map(cleanString).filter(Boolean).join("\n") : cleanString(cv.education),
  certifications: Array.isArray(cv.certifications) ? cv.certifications.map(cleanString).filter(Boolean).join("\n") : cleanString(cv.certifications),
  languages: Array.isArray(cv.languages) ? cv.languages.map(cleanString).filter(Boolean).join("\n") : cleanString(cv.languages),
  references: cleanString(cv.references) || "Available upon request",
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Use POST." });
  }
  if (isRateLimited(event)) {
    return json(429, { error: "Too many CV analysis requests. Please wait a minute and try again." });
  }

  const body = parseBody(event);
  const cvText = cleanText(body?.text);
  if (!cvText) {
    return json(400, { error: "CV text is required." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(503, { error: "OPENAI_API_KEY is not configured." });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a careful CV parser for a CV builder. Extract the applicant data into valid JSON only. Do not invent details. Do not place work history in the summary. Do not place education, contact details, hobbies, references, or desired positions inside work experience. If PDF text order is mixed, infer sections from headings and labels. Return concise professional text suitable for a CV form.",
        },
        {
          role: "user",
          content: `Parse this uploaded CV text into this exact JSON shape:
{
  "cv": {
    "fullName": "",
    "jobTitle": "",
    "email": "",
    "phone": "",
    "country": "",
    "nationality": "",
    "visaStatus": "",
    "drivingLicense": "",
    "linkedIn": "",
    "portfolioUrl": "",
    "summary": "",
    "skills": ["skill or tool"],
    "workExperiences": [
      {
        "jobTitle": "",
        "employer": "",
        "companyLocation": "",
        "fromDate": "",
        "toDate": "",
        "isCurrent": false,
        "responsibilities": ["responsibility only, no company names or dates"]
      }
    ],
    "educationEntries": [
      {
        "qualification": "",
        "school": "",
        "location": "",
        "fromDate": "",
        "toDate": "",
        "details": ""
      }
    ],
    "education": ["legacy text lines only if structured educationEntries cannot be created"],
    "certifications": [],
    "languages": [],
    "references": "Available upon request"
  }
}

Rules:
- Keep the professional summary to 2-4 lines about the candidate profile only.
- Work experience entries must have employer, job title, dates, and duties separated.
- If a job title or employer is split across lines, join the lines.
- Exclude contact labels, hobbies, personal details, and social media lines from work duties.
- Keep dates as written when possible.
- Use empty strings or empty arrays when a field is missing.

File name: ${cleanString(body?.fileName)}

CV text:
${cvText}`,
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    return json(response.status, { error: "OpenAI CV analysis failed." });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content);
    return json(200, { mode: "ai", cv: normalizeCv(parsed.cv || parsed) });
  } catch {
    return json(502, { error: "AI returned invalid CV JSON." });
  }
};
