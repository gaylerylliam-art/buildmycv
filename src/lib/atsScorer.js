const gccPhonePattern = /(?:\+971|\+966|\+973|\+974|\+965|\+968)\s?\d[\d\s-]{6,}/;
const firstPersonPattern = /\b(i|me|my|myself)\b/i;
const standardJobTerms = [
  "assistant",
  "associate",
  "coordinator",
  "engineer",
  "technician",
  "manager",
  "supervisor",
  "analyst",
  "developer",
  "accountant",
  "driver",
  "helper",
  "operator",
  "executive",
  "officer",
  "specialist",
  "teacher",
  "nanny",
  "electrician",
  "plumber",
  "welder",
  "carpenter",
];

const tokenize = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s+]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

const wordCount = (value = "") => tokenize(value).length;

const splitList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeReferences = (references) => {
  if (!references || typeof references === "string") return { mode: references ? "on-request" : "none", entries: [] };
  return { mode: references.mode || "none", entries: Array.isArray(references.entries) ? references.entries : [] };
};

const normalizeExperience = (cvData) => {
  if (Array.isArray(cvData.workExperiences) && cvData.workExperiences.length) return cvData.workExperiences;
  if (Array.isArray(cvData.experience)) return cvData.experience;
  if (cvData.experience) return [{ responsibilities: cvData.experience, jobTitle: cvData.jobTitle }];
  return [];
};

const gradeForScore = (score) => {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
};

export function scoreCV(cvData = {}, jobDescription = "") {
  const skills = splitList(cvData.skills);
  const experiences = normalizeExperience(cvData);
  const summary = cvData.summary || "";
  const fullText = [
    cvData.fullName || cvData.name,
    cvData.jobTitle,
    summary,
    cvData.education,
    cvData.certifications,
    cvData.languages,
    cvData.references,
    skills.join(" "),
    experiences.map((entry) => [entry.jobTitle, entry.employer, entry.responsibilities || entry.description].filter(Boolean).join(" ")).join(" "),
  ].join(" ");

  let sections = 0;
  let format = 0;
  let keywords = 0;
  let readability = 0;
  const passed = [];
  const warnings = [];
  const tips = [];

  if ((cvData.fullName || cvData.name || "").trim()) {
    sections += 5;
    passed.push("Name is present.");
  } else warnings.push("Add your full name.");

  if ((cvData.jobTitle || "").trim()) {
    sections += 5;
    passed.push("Job title is present.");
  } else warnings.push("Add a clear target job title.");

  if (wordCount(summary) >= 50) {
    sections += 8;
    passed.push("Professional summary has enough detail.");
  } else {
    tips.push("Write a professional summary of at least 50 words with your target role and strongest experience.");
  }

  const hasDetailedExperience = experiences.some((entry) => wordCount(entry.responsibilities || entry.description || "") >= 30);
  if (hasDetailedExperience) {
    sections += 7;
    passed.push("Work experience includes useful descriptions.");
  } else warnings.push("Add at least one work experience entry with 30+ words of duties or achievements.");

  if (skills.length >= 5) {
    sections += 5;
    passed.push("Skills section has at least 5 keywords.");
  } else tips.push("Your skills section should have at least 8-10 keywords for ATS to parse.");

  if (cvData.usesTable === false || cvData.usesTable === undefined) {
    format += 5;
    passed.push("No ATS-blocking tables detected.");
  } else warnings.push("Avoid tables and text boxes - ATS systems cannot read them.");

  if (!cvData.hasBodyImages) {
    format += 5;
    passed.push("No body images detected.");
  } else warnings.push("Keep images out of the CV body. A header profile photo is fine.");

  if (experiences.length && experiences.every((entry) => entry.fromDate && (entry.toDate || entry.isCurrent))) {
    format += 5;
    passed.push("Experience dates are included.");
  } else tips.push("Each work experience entry should include start and end dates.");

  if (gccPhonePattern.test(cvData.phone || "")) {
    format += 5;
    passed.push("Phone number uses a GCC-friendly format.");
  } else tips.push("Use an international GCC phone format like +971, +966, +973, +974, +965, or +968.");

  if (jobDescription.trim()) {
    const source = new Set(tokenize(`${skills.join(" ")} ${summary}`));
    const jobWords = [...new Set(tokenize(jobDescription))].filter((word) => word.length > 3);
    const matches = jobWords.filter((word) => source.has(word)).length;
    const overlap = jobWords.length ? matches / jobWords.length : 0;
    if (overlap >= 0.7) keywords = 30;
    else if (overlap >= 0.5) keywords = 20;
    else if (overlap >= 0.3) keywords = 10;
    if (keywords) passed.push("Keyword match has useful overlap with the job posting.");
    else warnings.push("Keyword match is low against the pasted job posting.");
  } else if (skills.length >= 8) {
    keywords = 15;
    passed.push("Strong baseline keyword count.");
  } else {
    tips.push("Paste a job posting to check keyword match.");
  }

  const totalWords = wordCount(fullText);
  if (totalWords >= 400 && totalWords <= 800) readability += 10;
  else if ((totalWords >= 200 && totalWords < 400) || (totalWords > 800 && totalWords <= 1000)) readability += 5;
  else tips.push("Aim for a total CV length of 400-800 words for most UAE/GCC applications.");

  if (!firstPersonPattern.test(summary)) {
    readability += 5;
    passed.push("Summary avoids first-person pronouns.");
  } else tips.push("Replace first-person pronouns in your summary with action verbs.");

  const jobTitles = experiences.map((entry) => entry.jobTitle || "").join(" ");
  if (standardJobTerms.some((term) => new RegExp(`\\b${term}\\b`, "i").test(`${cvData.jobTitle || ""} ${jobTitles}`))) {
    readability += 5;
    passed.push("Job titles use standard industry terms.");
  } else tips.push("Use the exact job title from the posting in your headline.");

  if (!cvData.visaStatus && !cvData.nationality) tips.push("Add your UAE visa status or nationality - GCC employers expect this.");
  if (!/arabic/i.test(cvData.languages || "")) tips.push("List Arabic language proficiency if applying to UAE government or semi-government.");
  if (cvData.qrCode?.enabled && !/linkedin\.com/i.test(cvData.linkedIn || "")) {
    warnings.push("QR codes are ignored by ATS systems. Keep your LinkedIn URL written as text too.");
  }
  const references = normalizeReferences(cvData.references);
  if (references.mode === "listed") {
    tips.push("Listing references uses valuable space. Use 'Available upon request' unless the job asks for references.");
    if (references.entries.some((entry) => entry.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email))) {
      warnings.push("Check reference email format before downloading.");
    }
  }
  tips.push("Add more measurable achievements: numbers, percentages, AED values.");

  const score = Math.max(5, Math.min(100, sections + format + keywords + readability));
  return {
    score,
    grade: gradeForScore(score),
    breakdown: { sections, format, keywords, readability },
    passed: passed.slice(0, 6),
    warnings: warnings.slice(0, 5),
    tips: [...new Set(tips)].slice(0, 5),
  };
}
