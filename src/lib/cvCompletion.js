const splitList = (value = "") =>
  String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const wordCount = (value = "") => String(value || "").trim().split(/\s+/).filter(Boolean).length;

const normalizeExperiences = (cv = {}) =>
  Array.isArray(cv.workExperiences) && cv.workExperiences.length
    ? cv.workExperiences
    : cv.experience
      ? [{ responsibilities: cv.experience }]
      : [];

const referenceIsSet = (references) => {
  if (!references) return false;
  if (typeof references === "string") return Boolean(references.trim());
  if (references.mode === "on-request") return true;
  if (references.mode === "listed") {
    return (references.entries || []).some((entry) => entry.consentGiven && entry.name && entry.company);
  }
  return false;
};

export function computeCompletion(cv = {}) {
  const experiences = normalizeExperiences(cv);
  const skills = splitList(cv.skills);
  const checklist = [
    { key: "name", weight: 8, done: Boolean(cv.fullName?.trim()), label: "Add your full name (+8%)", section: "personal" },
    { key: "title", weight: 7, done: Boolean(cv.jobTitle?.trim()), label: "Add your job title (+7%)", section: "personal" },
    { key: "phone", weight: 5, done: /^\+\d/.test(String(cv.phone || "").trim()), label: "Add phone country code (+5%)", section: "personal" },
    { key: "email", weight: 5, done: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cv.email || ""), label: "Add a professional email (+5%)", section: "personal" },
    { key: "location", weight: 3, done: Boolean(cv.country?.trim()), label: "Add your location (+3%)", section: "personal" },
    { key: "photo", weight: 7, done: Boolean(cv.profilePhoto), label: "Upload a profile photo (+7%)", section: "personal" },
    { key: "summary", weight: 12, done: wordCount(cv.summary) >= 40, label: "Add a professional summary (+12%)", section: "summary" },
    { key: "experience", weight: 10, done: experiences.length > 0 && experiences.some((entry) => entry.jobTitle || entry.employer || entry.responsibilities), label: "Add one work experience (+10%)", section: "experience" },
    { key: "experienceDetails", weight: 8, done: experiences.some((entry) => wordCount(entry.responsibilities) >= 25), label: "Add stronger experience details (+8%)", section: "experience" },
    { key: "dates", weight: 4, done: experiences.some((entry) => entry.fromDate && (entry.toDate || entry.isCurrent)), label: "Add employment dates (+4%)", section: "experience" },
    { key: "education", weight: 7, done: Boolean(cv.education?.trim()), label: "Add education details (+7%)", section: "education" },
    { key: "skills5", weight: 9, done: skills.length >= 5, label: "Add at least 5 skills (+9%)", section: "skills" },
    { key: "skills8", weight: 3, done: skills.length >= 8, label: "Add 8 skills for better ATS match (+3%)", section: "skills" },
    { key: "languages", weight: 4, done: splitList(cv.languages).length >= 1, label: "Add languages spoken (+4%)", section: "skills" },
    { key: "certRefs", weight: 4, done: Boolean(cv.certifications?.trim()) || referenceIsSet(cv.references), label: "Add certifications or references (+4%)", section: "education" },
    { key: "template", weight: 4, done: Boolean(cv.categoryId && cv.categoryId !== "hospitality"), label: "Choose a job template (+4%)", section: "personal" },
  ];

  const percent = Math.max(5, Math.min(100, Math.round(checklist.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0))));
  const next = checklist.filter((item) => !item.done).sort((a, b) => b.weight - a.weight)[0];
  return {
    percent,
    nextStep: next?.label || "Your CV is ready to download",
    nextSection: next?.section || "download",
    milestones: checklist.filter((item) => item.done).map((item) => item.key),
  };
}
