import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { categories, layouts, themes } from "./data/categories";
import HomeLanding from "./components/HomeLanding";
import BrandLogo from "./components/BrandLogo.jsx";
import BlogLanding from "./components/BlogLanding.jsx";
import ExistingCVImporter from "./components/ExistingCVImporter.jsx";
import { useBuilderMotion } from "./hooks/usePageMotion.js";
import PhotoUploadCrop from "./components/PhotoUploadCrop";
import { getPassportPhotoStyles, normalizePhotoShape } from "./lib/profilePhoto.js";
import ATSPanel from "./components/ATSPanel";
import { industryOptions, getTips } from "./content/cvTips";
import { seoJobs } from "./content/programmaticSeo";
import { computeCompletion } from "./lib/cvCompletion";
import { logEvent } from "./lib/analytics";
import { getSmartTip } from "./lib/smartTips";
import { normalizeQrUrl } from "./lib/validateQrUrl";
import { useQrSvg } from "./hooks/useQrSvg";
import { useTheme } from "./hooks/useTheme";
import {
  coverLetterFonts,
  coverLetterLayouts,
  coverLetterRoleGroups,
  coverLetterTemplates,
  experienceLevels,
  generateCoverLetterTemplate,
  regionalFormats,
  sampleCoverLetters,
} from "./data/coverLetterTemplates";
import { blogArticles } from "./data/blogArticles";
import { getBlogPhotography } from "./content/blogPhotography.js";
import { faqs } from "./data/siteContent";
import {
  HOME_HOW_IT_WORKS_BADGES,
  HOME_HOW_IT_WORKS_SUBTITLE,
  HOME_HOW_IT_WORKS_TITLE,
  HOME_HOW_IT_WORKS_STEPS,
  HOME_META_DESCRIPTION,
  HOME_META_TITLE,
  HOME_VIDEO,
} from "./content/homepage";
import { downloadCoverLetterFile, downloadCvFile } from "./utils/downloads";
import { initAnalytics, trackEvent } from "./utils/analytics";
import { getRecaptchaToken, isRecaptchaConfigured } from "./utils/recaptcha";
import {
  deleteUserCv,
  duplicateUserCv,
  getCvEventSessionId,
  isSupabaseConfigured,
  listUserCvs,
  loadLatestDraftForUser,
  markCvDownloaded,
  SAVED_CV_LIMIT,
  SAVED_CV_RETENTION_DAYS,
  saveCvForUser,
  saveDraftForUser,
  submitContactMessage,
  supabase,
  trackCvEvent,
  uploadProfilePhoto,
} from "./supabaseClient";

const defaultCategory = categories[0];
const defaultSectionOrder = ["summary", "experience", "education", "skills", "educationProjects", "awards", "volunteerExperience", "professionalLinks", "certifications", "languages", "references"];
const defaultQrCode = { enabled: false, url: "", label: "Scan for LinkedIn", position: "header" };
const pageBorderPresets = [
  { id: "1cm", label: "1 cm", unit: "cm", value: 1 },
  { id: "1in", label: "1 inch", unit: "in", value: 1 },
  { id: "custom", label: "Custom" },
];
const createReferenceEntry = () => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  name: "",
  jobTitle: "",
  company: "",
  relationship: "Manager",
  phoneCode: "+971",
  phone: "",
  email: "",
  consentGiven: false,
});
const defaultReferences = { mode: "on-request", entries: [] };
const translationLanguageOptions = ["English", "French", "German", "Arabic", "Dutch", "Other language"];
const isArabicLanguage = (language = "") => /arabic|عربي|العربية/i.test(String(language || ""));
const sectionLabels = {
  summary: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  educationProjects: "Projects",
  awards: "Awards",
  volunteerExperience: "Volunteer Experience",
  professionalLinks: "Professional Links",
  skills: "Skills",
  certifications: "Certifications",
  languages: "Languages",
  references: "References",
};

const createExperienceId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const createBlankExperienceEntry = () => ({
  id: createExperienceId(),
  jobTitle: "",
  employer: "",
  companyLocation: "",
  fromDate: "",
  toDate: "",
  isCurrent: false,
  responsibilities: "",
});

const createExperienceEntry = (category = defaultCategory) => ({
  ...createBlankExperienceEntry(),
  jobTitle: category.title,
  employer: "Employer name",
  responsibilities: category.experience,
});

const monthLookup = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const parseExperienceDateValue = (value = "") => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return 0;
  if (/present|current|till\s*date|to\s*date|ongoing|now/.test(text)) return 999999;
  const year = text.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) return 0;
  const numericMonth = text.match(/\b(0?[1-9]|1[0-2])\s*[/-]\s*(?:\d{2}|\d{4})\b/)?.[1];
  const monthWord = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/)?.[0];
  const month = numericMonth ? Number(numericMonth) : monthLookup[monthWord] || 12;
  return Number(year) * 12 + month;
};

const sortWorkExperiences = (entries = []) =>
  [...entries]
    .map((entry, index) => ({
      entry,
      index,
      manualOrder: Number.isFinite(entry.manualOrder) ? entry.manualOrder : null,
      sortValue: entry.isCurrent
        ? 999999
        : Math.max(parseExperienceDateValue(entry.toDate), parseExperienceDateValue(entry.fromDate)),
    }))
    .sort((a, b) => {
      if (a.manualOrder != null || b.manualOrder != null) {
        return (a.manualOrder ?? Number.MAX_SAFE_INTEGER) - (b.manualOrder ?? Number.MAX_SAFE_INTEGER);
      }
      return (b.sortValue - a.sortValue) || (a.index - b.index);
    })
    .map(({ entry }) => entry);

const reindexManualWorkExperienceOrder = (entries = []) => {
  if (!entries.some((entry) => Number.isFinite(entry.manualOrder))) return entries;
  return sortWorkExperiences(entries).map((entry, index) => ({ ...entry, manualOrder: index }));
};

const formatWorkExperiences = (entries = []) =>
  sortWorkExperiences(entries)
    .map((entry) =>
      [
        entry.jobTitle,
        entry.employer,
        entry.companyLocation,
        [entry.fromDate, entry.isCurrent ? "Present" : entry.toDate].filter(Boolean).join(" - "),
        entry.responsibilities,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .filter(Boolean)
    .join("\n\n");

const normalizeSectionOrder = (cv = {}) => {
  const order = Array.isArray(cv.sectionOrder) ? cv.sectionOrder : [];
  return [...order.filter((id) => defaultSectionOrder.includes(id)), ...defaultSectionOrder.filter((id) => !order.includes(id))];
};

const normalizeReferences = (references) => {
  if (!references) return defaultReferences;
  if (typeof references === "string") {
    return /available upon request/i.test(references) || !references.trim()
      ? defaultReferences
      : { mode: "listed", entries: [{ ...createReferenceEntry(), name: references, consentGiven: false }] };
  }
  return {
    mode: references.mode || "on-request",
    entries: Array.isArray(references.entries) ? references.entries.map((entry) => ({ ...createReferenceEntry(), ...entry })) : [],
  };
};

const referencesHasContent = (references) => {
  const normalized = normalizeReferences(references);
  if (normalized.mode === "on-request") return true;
  if (normalized.mode !== "listed") return false;
  return normalized.entries.some((entry) => entry.consentGiven && entry.name && entry.company);
};

const sectionHasContent = (cv = {}, id) => {
  if (id === "experience") return normalizeWorkExperiences(cv).some((entry) => [entry.jobTitle, entry.employer, entry.responsibilities].some((value) => String(value || "").trim()));
  if (id === "references") return referencesHasContent(cv.references);
  if (id === "educationProjects") return Boolean(String(cv.projects || "").trim());
  return Boolean(String(cv[id] || "").trim());
};

const visibleSectionOrder = (cv = {}) => {
  const hidden = Array.isArray(cv.hiddenSections) ? cv.hiddenSections : [];
  return normalizeSectionOrder(cv).filter((id) => !hidden.includes(id) && sectionHasContent(cv, id));
};

const normalizeWorkExperiences = (cv) => {
  if (Array.isArray(cv.workExperiences) && cv.workExperiences.length) {
    return reindexManualWorkExperienceOrder(
      cv.workExperiences.map((entry) => ({ ...createBlankExperienceEntry(), ...entry })),
    );
  }
  if (!cv.experience) return [createBlankExperienceEntry()];
  return [
    {
      ...createBlankExperienceEntry(),
      jobTitle: cv.jobTitle || "",
      employer: "",
      companyLocation: "",
      responsibilities: cv.experience,
    },
  ];
};

const getCvPageBorderConfig = (cv = {}) => {
  const preset = pageBorderPresets.some((option) => option.id === cv.pageBorderPreset) ? cv.pageBorderPreset : "1cm";
  if (preset === "1cm") return { preset, unit: "cm", value: 1, inches: 1 / 2.54, millimeters: 10 };
  if (preset === "1in") return { preset, unit: "in", value: 1, inches: 1, millimeters: 25.4 };
  const unit = cv.pageBorderUnit === "in" ? "in" : "cm";
  const parsed = Number.parseFloat(cv.pageBorderValue);
  const safeValue = Number.isFinite(parsed) ? Math.min(3, Math.max(0, parsed)) : 1;
  const inches = unit === "in" ? safeValue : safeValue / 2.54;
  return {
    preset,
    unit,
    value: safeValue,
    inches,
    millimeters: inches * 25.4,
  };
};

const getCvPageBorderPixels = (cv = {}) => Math.round(getCvPageBorderConfig(cv).inches * 96);

const hasUserEnteredCvData = (cv) => {
  const meaningfulFields = [
    "fullName",
    "jobTitle",
    "email",
    "phone",
    "country",
    "nationality",
    "visaStatus",
    "linkedIn",
    "portfolioUrl",
    "summary",
    "skills",
    "experience",
    "education",
    "projects",
    "awards",
    "volunteerExperience",
    "professionalLinks",
    "unclassifiedContent",
    "certifications",
    "languages",
    "drivingLicense",
    "expectedSalary",
    "references",
    "profilePhoto",
  ];
  return meaningfulFields.some((key) => {
    const value = cv[key];
    if (key === "references") return referencesHasContent(value);
    if (typeof value === "object") return Boolean(value && Object.keys(value).length);
    return String(value || "").trim();
  }) || (Array.isArray(cv.workExperiences) && cv.workExperiences.length > 0);
};

const initialCv = {
  fullName: "Juan Dela Cruz",
  jobTitle: defaultCategory.title,
  email: "juan.delacruz@email.com",
  phone: "+971 50 123 4567",
  country: "United Arab Emirates",
  nationality: "Filipino",
  visaStatus: "Visit visa",
  linkedIn: "",
  portfolioUrl: "",
  summary: defaultCategory.summary,
  skills: defaultCategory.skills,
  experience: defaultCategory.experience,
  workExperiences: [createExperienceEntry(defaultCategory)],
  education: "High School Diploma\nManila High School, 2018",
  projects: "",
  awards: "",
  volunteerExperience: "",
  professionalLinks: "",
  unclassifiedContent: "",
  certifications: "Basic Food Safety Certificate",
  languages: "English, Filipino",
  originalLanguage: "English",
  outputLanguage: "English",
  languageDirection: "ltr",
  drivingLicense: "No UAE driving license",
  expectedSalaryEnabled: false,
  expectedSalary: "",
  industry: "general",
  tipsEnabled: true,
  qrCode: defaultQrCode,
  pageBorderPreset: "1cm",
  pageBorderUnit: "cm",
  pageBorderValue: "1",
  showCredit: true,
  builderStartOption: "scratch",
  targetCountry: "Worldwide",
  targetJobTitle: "",
  experienceLevel: "Entry level",
  cvStylePreference: "Modern",
  photoPreference: "Decide later",
  showCountrySpecificFields: true,
  onboardingCompleted: true,
  jobDescription: "",
  references: defaultReferences,
  sectionOrder: defaultSectionOrder,
  hiddenSections: [],
  profilePhoto: "",
  photoCropSource: "",
  photoFrameFormat: "",
  photoShape: "circle",
};

const createCoverLetterFromCv = (cv, categoryId) => {
  const template = coverLetterTemplates[categoryId] || coverLetterTemplates.hospitality;
  const safeCv = sanitizeCvForCoverLetter(cv);
  return generateCoverLetterTemplate({
    cv: safeCv,
    role: template.position,
    letter: {
      companyName: "Company Name",
      companyAddress: safeCv.country,
      position: safeCv.jobTitle || template.position,
      opening: template.opening,
      body: template.body,
      closing: template.closing,
    },
  });
};

const sanitizeCvTextForCoverLetter = (value = "") =>
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

const sanitizeCvForCoverLetter = (cv = {}) => ({
  ...cv,
  photoCropSource: undefined,
  summary: sanitizeCvTextForCoverLetter(cv.summary),
  skills: sanitizeCvTextForCoverLetter(cv.skills),
  experience: sanitizeCvTextForCoverLetter(cv.experience),
});

const sanitizeCoverLetterParagraphs = (letter = {}) => ({
  ...letter,
  opening: sanitizeCvTextForCoverLetter(letter.opening),
  body: sanitizeCvTextForCoverLetter(letter.body),
  qualifications: sanitizeCvTextForCoverLetter(letter.qualifications),
  value: sanitizeCvTextForCoverLetter(letter.value),
  closing: sanitizeCvTextForCoverLetter(letter.closing),
});

const coverLetterToText = (letter, cv) => {
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const cleanLetter = sanitizeCoverLetterParagraphs(letter);
  return [
    cv.fullName,
    `${cv.email} | ${cv.phone} | ${cv.country}`,
    letter.linkedIn ? `LinkedIn: ${letter.linkedIn}` : "",
    letter.nationality ? `Nationality: ${letter.nationality}` : "",
    letter.visaStatus ? `Visa Status: ${letter.visaStatus}` : "",
    "",
    today,
    "",
    letter.companyName,
    letter.companyAddress,
    "",
    `Dear ${letter.hiringManager || "Hiring Manager"},`,
    "",
    cleanLetter.opening,
    "",
    cleanLetter.body,
    "",
    cleanLetter.qualifications,
    "",
    cleanLetter.value,
    "",
    cleanLetter.closing,
    "",
    "Sincerely,",
    cv.fullName,
  ]
    .filter((line) => line !== "")
    .join("\n");
};

const DRAFT_STORAGE_KEY = "cvforall:draft:v1";
const AUTH_REDIRECT_URL = import.meta.env.VITE_AUTH_REDIRECT_URL || "https://buildmycvnow.com/#builder";
const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === "true";
const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID || "";
const ADSENSE_ENABLED = /^ca-pub-\d+$/.test(ADSENSE_CLIENT_ID);
const BUILDER_ADS_ENABLED = import.meta.env.VITE_ENABLE_BUILDER_ADS === "true";

const completenessFields = [
  ["Contact details", (cv) => cv.fullName && cv.email && cv.phone && cv.country],
  ["Nationality and visa status", (cv) => cv.nationality && cv.visaStatus],
  ["Professional summary", (cv) => cv.summary && cv.summary.length > 40],
  ["Skills", (cv) => cv.skills && cv.skills.split(",").length >= 3],
  ["Work experience", (cv) => normalizeWorkExperiences(cv).some((entry) => entry.employer && entry.fromDate && (entry.toDate || entry.isCurrent) && entry.responsibilities?.length > 20)],
  ["Education", (cv) => cv.education && cv.education.length > 10],
  ["Certifications", (cv) => cv.certifications && cv.certifications.length > 5],
  ["Languages", (cv) => cv.languages && cv.languages.length > 2],
];

const getCompleteness = (cv) => {
  const completed = completenessFields.filter(([, test]) => Boolean(test(cv)));
  const nextMissing = completenessFields.find(([, test]) => !test(cv));
  return {
    score: Math.round((completed.length / completenessFields.length) * 100),
    completed: completed.length,
    total: completenessFields.length,
    tip: nextMissing ? `Next: add ${nextMissing[0].toLowerCase()}.` : "Ready to download.",
  };
};

const createDraftPayload = ({ cv, coverLetter, categoryId, themeId, layoutId, coverThemeId, coverFontId, coverLayoutId, currentCvId }) => ({
  cv,
  coverLetter,
  categoryId,
  themeId,
  layoutId,
  coverThemeId,
  coverFontId,
  coverLayoutId,
  currentCvId: currentCvId || null,
  updatedAt: new Date().toISOString(),
});

function Icon({ name, className = "h-5 w-5" }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const paths = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15h6" /><path d="M9 11h2" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6.27 6.27l1.27-1.28a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z" /></>,
    pin: <><path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" /><circle cx="12" cy="11" r="2.5" /></>,
    graduation: <><path d="m2 9 10-5 10 5-10 5-10-5z" /><path d="M6 11v4.5c0 .8 2.7 2.5 6 2.5s6-1.7 6-2.5V11" /><path d="M22 9v6" /></>,
    award: <><circle cx="12" cy="8" r="5" /><path d="m8.2 13.9-1.4 6.1L12 17l5.2 3-1.4-6.1" /></>,
    folder: <><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" /></>,
    user: <><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></>,
    arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
    check: <path d="m20 6-11 11-5-5" />,
    alert: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 0 20" /><path d="M12 2a15.3 15.3 0 0 0 0 20" /></>,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>,
    camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    play: <polygon points="8 5 19 12 8 19 8 5" fill="currentColor" stroke="none" />,
    sparkle: <><path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.7l6.8-4.4" /><path d="M8.6 13.3l6.8 4.4" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h2v2h-2z" /><path d="M19 14h2v2h-2z" /><path d="M14 19h2v2h-2z" /><path d="M19 19h2v2h-2z" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
    moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 7 7 0 1 0 20.5 14.5z" />,
    monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /><path d="M12 16v4" /></>,
    lightbulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14a6 6 0 1 1 7 0c-.8.6-1.5 1.6-1.5 2.6h-4c0-1-.7-2-1.5-2.6z" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function Seo({ title, description, image = "https://buildmycvnow.com/assets/og-image.jpg", imageWidth = 1200, imageHeight = 630, type = "website" }) {
  useEffect(() => {
    const fullTitle = title.includes("BuildMyCVNow") ? title : `${title} | BuildMyCVNow`;
    const canonical = `${window.location.origin}${window.location.pathname}`;
    document.title = fullTitle;
    let meta = document.querySelector("meta[name='description']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
    const setMeta = (selector, attr, value) => {
      let tag = document.querySelector(selector);
      if (!tag) {
        tag = document.createElement("meta");
        if (selector.includes("property=")) tag.setAttribute("property", selector.match(/property='([^']+)'/)?.[1] || "");
        else tag.setAttribute("name", selector.match(/name='([^']+)'/)?.[1] || "");
        document.head.appendChild(tag);
      }
      tag.setAttribute(attr, value);
    };
    setMeta("meta[property='og:title']", "content", fullTitle);
    setMeta("meta[property='og:description']", "content", description);
    setMeta("meta[property='og:type']", "content", type);
    setMeta("meta[property='og:url']", "content", canonical);
    setMeta("meta[property='og:image']", "content", image);
    setMeta("meta[property='og:image:width']", "content", String(imageWidth));
    setMeta("meta[property='og:image:height']", "content", String(imageHeight));
    setMeta("meta[property='og:image:type']", "content", "image/jpeg");
    setMeta("meta[property='og:site_name']", "content", "BuildMyCVNow");
    setMeta("meta[name='twitter:card']", "content", "summary_large_image");
    setMeta("meta[name='twitter:title']", "content", fullTitle);
    setMeta("meta[name='twitter:description']", "content", description);
    setMeta("meta[name='twitter:image']", "content", image);
  }, [title, description, image, imageWidth, imageHeight, type]);
  return null;
}

function AdSenseScript() {
  useEffect(() => {
    if (!ADSENSE_ENABLED || document.querySelector("script[data-cvforall-adsense]")) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.cvforallAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
    document.head.appendChild(script);
  }, []);
  return null;
}

function AdBanner({ label = "Google AdSense ad space", compact = false, slot = "0000000000" }) {
  useEffect(() => {
    if (!ADSENSE_ENABLED) return;
    try {
      if (window.adsbygoogle) window.adsbygoogle.push({});
    } catch {
      // Ad blockers or unapproved AdSense accounts can block this script.
    }
  }, []);
  return (
    <div className={`mx-auto w-full max-w-6xl rounded border border-dashed border-slate-300 bg-white p-2 text-center text-slate-500 ${compact ? "min-h-20 text-sm" : "min-h-24"}`}>
      <ins
        className="adsbygoogle block"
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <span className="pointer-events-none inline-flex py-4 text-xs font-bold uppercase tracking-wide">{label}</span>
    </div>
  );
}

function CookieNotice() {
  const [visible, setVisible] = useState(() => localStorage.getItem("cvforall:cookie-notice") !== "accepted");
  if (!visible) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[calc(100vw-1.5rem)] rounded border border-slate-200 bg-white p-4 shadow-2xl md:max-w-4xl">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <p className="max-w-full break-words text-sm font-semibold leading-6 text-slate-700">
          BuildMyCVNow uses essential browser storage for drafts and may use Google Analytics, reCAPTCHA, and AdSense cookies when those services are enabled. Read the Privacy Policy for details.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/privacy" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">Privacy</Link>
          <button
            onClick={() => {
              localStorage.setItem("cvforall:cookie-notice", "accepted");
              setVisible(false);
            }}
            className="rounded bg-green-600 px-4 py-2 text-sm font-black text-white hover:bg-green-700"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ onStart }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`landing-nav ${scrolled ? "scrolled" : ""}`}>
      <Link to="/" className="nav-logo" aria-label="BuildMyCVNow home">
        <BrandLogo />
        </Link>
      <div className="nav-right">
        <nav className="nav-links" aria-label="Landing page navigation">
          <Link to="/#templates" className="nav-link">Templates</Link>
          <Link to="/#how-it-works" className="nav-link">How it works</Link>
          <Link to="/blog" className="nav-link">Blog</Link>
        </nav>
        <button onClick={onStart} className="nav-cta">
          Build my CV - it's free
        </button>
      </div>
      <button onClick={onStart} className="nav-mobile-cta" aria-label="Build my CV">
        CV
      </button>
    </header>
  );
}

function HomeHowItWorksSection({ onStart }) {
  const steps = HOME_HOW_IT_WORKS_STEPS;

  return (
    <section className="home-hiw-section" id="how-it-works">
      <div className="home-hiw-pro-shell">
        <div className="home-hiw-pro-head">
          <span className="home-hiw-pro-eyebrow">HOW IT WORKS</span>
          <h2 className="home-hiw-pro-title">{HOME_HOW_IT_WORKS_TITLE}</h2>
          <p className="home-hiw-pro-subtitle">{HOME_HOW_IT_WORKS_SUBTITLE}</p>
        </div>

        <div className="home-hiw-pro-grid">
          <div className="home-hiw-pro-intro">
            <div className="home-hiw-pro-intro-card">
              <p className="home-hiw-pro-kicker">Start fast</p>
              <h3>Everything follows the same flow as the builder.</h3>
              <p>
                Pick a template, import or type your details, improve weak wording with AI, review your live CV score,
                and download a recruiter-ready PDF in minutes.
              </p>

              <div className="home-hiw-pro-badges" role="list" aria-label="BuildMyCVNow trust points">
                {HOME_HOW_IT_WORKS_BADGES.map((badge) => (
                  <span key={badge} role="listitem">
                    <Icon name="check" className="h-4 w-4" /> {badge}
                  </span>
                ))}
              </div>

              <button type="button" className="home-hiw-pro-cta" onClick={onStart}>
                Start my free CV <Icon name="arrow" className="h-4 w-4" />
              </button>
            </div>

            <article className="home-hiw-pro-video-card" aria-label="BuildMyCVNow demo video">
              <div className="home-hiw-pro-video-copy">
                <span className="home-hiw-pro-video-eyebrow">Demo</span>
                <h3>Watch the 2-minute walkthrough</h3>
                <p>See how to choose a template, add your details, improve your CV with AI, and download your PDF.</p>
              </div>

              <div className="home-hiw-pro-video-frame">
                <video controls playsInline preload="metadata" poster={HOME_VIDEO.poster} aria-label={HOME_VIDEO.name}>
                  <source src={HOME_VIDEO.url} type="video/mp4" />
                  Your browser cannot play this video. Please open it in a new tab.
                </video>
              </div>

              <div className="home-hiw-pro-video-actions">
                <a href={HOME_VIDEO.url} target="_blank" rel="noreferrer" className="home-hiw-pro-video-link">
                  <Icon name="play" className="h-4 w-4" /> Open walkthrough
                </a>
                <span>2 min demo</span>
              </div>
            </article>
          </div>

          <div className="home-hiw-pro-timeline" aria-label="BuildMyCVNow CV builder steps">
            {steps.map((step, index) => (
              <article key={step.title} className="home-hiw-pro-step">
                <div className="home-hiw-pro-step-marker" aria-hidden="true">
                  <span>{index + 1}</span>
                </div>
                <div className="home-hiw-pro-step-card">
                  <div className="home-hiw-pro-step-top">
                    <span className="home-hiw-pro-step-label">Step {index + 1}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingPage({ onStart }) {
  return <><Seo title={HOME_META_TITLE} description={HOME_META_DESCRIPTION} /><HomeLanding onStart={onStart} /></>;
}

function ContactSection() {
  const [status, setStatus] = useState("Messages are forwarded to info@buildmycvnow.com.");
  const [sending, setSending] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSending(true);
    setStatus("Sending your message...");
    try {
      const result = await submitContactMessage({
        name: formData.get("name"),
        email: formData.get("email"),
        message: formData.get("message"),
      });
      trackEvent("contact_form_sent");
      form.reset();
      setStatus(result.forwarded
        ? "Message sent successfully to info@buildmycvnow.com. We will reply as soon as possible."
        : "Message received, but EmailJS forwarding is not configured yet in Netlify.");
    } catch (error) {
      trackEvent("contact_form_failed");
      setStatus(error.message || "Could not send message. Please try again later.");
    } finally {
      setSending(false);
    }
  };
  return (
    <section id="contact" className="border-y border-slate-200 bg-slate-50 px-5 py-14">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <h2 className="text-3xl font-black text-slate-950">Contact Us</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Questions, feedback, and partnership messages are welcome. This form forwards every message to info@buildmycvnow.com and can also keep a secure Supabase copy for follow-up.
          </p>
          <div className="mt-6 rounded bg-white p-5 text-sm leading-6 text-slate-600 ring-1 ring-slate-200">
            <p><strong className="text-slate-950">Contact email:</strong> <a className="text-green-700 underline" href="mailto:info@buildmycvnow.com">info@buildmycvnow.com</a></p>
            <p><strong className="text-slate-950">Response time:</strong> 1-2 business days</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 rounded bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <label>
            <span className="form-label">Your name</span>
            <input className="form-field" name="name" placeholder="Enter your name" required />
          </label>
          <label>
            <span className="form-label">Email address</span>
            <input className="form-field" name="email" type="email" placeholder="Enter your email" required />
          </label>
          <label>
            <span className="form-label">Message</span>
            <textarea className="form-field" name="message" rows={5} placeholder="How can we help?" required />
          </label>
          <input className="hidden" name="website" tabIndex="-1" autoComplete="off" />
          <button disabled={sending} className="rounded bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            {sending ? "Sending..." : "Send message"}
          </button>
          <p className="rounded bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-600">{status}</p>
        </form>
      </div>
    </section>
  );
}

function PolicySections() {
  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-14 lg:grid-cols-2">
      <PolicyCard id="privacy" title="Privacy Policy">
        <p>BuildMyCVNow has two modes. In download-only mode, users can create a free CV without an account and verify by email OTP before downloading. In account mode, users can sign in and save CV versions online for a limited time.</p>
        <p>Download-only CV content stays in the browser and is not intentionally saved to Supabase. The email address entered for OTP may be processed by EmailJS only to send or verify the download code.</p>
        <p>Registered users can save up to 10 CVs online. Saved CVs are stored with Supabase under the user account for up to 15 days, then are designed to expire so users are encouraged to download their own records.</p>
        <p>Google Analytics, reCAPTCHA, and AdSense may use cookies or similar technologies when enabled. Ads are intended to support the free service without interfering with CV creation.</p>
      </PolicyCard>
      <PolicyCard id="terms" title="Terms & Conditions">
        <p>BuildMyCVNow provides free CV-building tools, templates, OTP-protected downloads, saved-CV account features, and career tips for general guidance.</p>
        <p>Users own the CV information they enter and must keep it honest, accurate, and lawful. Users are responsible for downloading their own CV copies, especially in download-only mode and before the 15-day account storage period ends.</p>
        <p>The service does not guarantee job interviews, job offers, visa approval, agency acceptance, or employer selection. Templates, AI suggestions, and tips must be reviewed and adapted to the user&apos;s real experience.</p>
      </PolicyCard>
    </section>
  );
}

function PolicyCard({ id, title, children }) {
  return (
    <article id={id} className="rounded border border-slate-200 bg-white p-6">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">{children}</div>
    </article>
  );
}

function PageShell({ children, onStart }) {
  return (
    <>
      <Header onStart={onStart} />
      <main className="bg-white">{children}</main>
      <SiteFooter onStart={onStart} />
    </>
  );
}

function StaticHero({ title, description }) {
  return (
    <section className="border-b border-slate-200 bg-slate-50 px-5 py-14">
      <div className="mx-auto max-w-7xl">
        <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{description}</p>
      </div>
    </section>
  );
}

function AboutPage({ onStart }) {
  return (
    <PageShell onStart={onStart}>
      <Seo
        title="About"
        description="Learn about BuildMyCVNow, a free CV builder for job seekers worldwide."
      />
      <StaticHero
        title="About BuildMyCVNow"
        description="BuildMyCVNow helps job seekers worldwide create clear, professional CVs for free, whether they are applying locally, overseas, remotely, or across international job markets."
      />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <h2 className="text-3xl font-black text-slate-950">Our mission</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Our mission is to make professional CV creation simple and accessible for people who need better work opportunities but may not have design tools, writing support, or technical experience.
          </p>
          <button onClick={onStart} className="mt-7 rounded bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700">Create my free CV</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Fresh graduates", "Simple CV wording for first jobs, internships, training, and entry-level applications."],
            ["Workers and helpers", "Practical templates for hospitality, domestic services, skilled trades, education, and general helper roles."],
            ["Overseas applicants", "Clear structure for people applying across countries, relocation roles, and international recruitment markets."],
            ["Global job seekers", "Beginner-friendly guidance for local jobs, remote work, and worldwide applications."],
          ].map(([title, text]) => (
            <article key={title} className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-black text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function ContactPage({ onStart }) {
  return (
    <PageShell onStart={onStart}>
      <Seo
        title="Contact"
        description="Contact BuildMyCVNow with questions, feedback, and support requests through a Supabase-powered contact form."
      />
      <StaticHero title="Contact BuildMyCVNow" description="Send us your questions, feedback, or partnership message. We keep the form simple and mobile friendly." />
      <ContactSection />
    </PageShell>
  );
}

function PrivacyPage({ onStart }) {
  return (
    <PageShell onStart={onStart}>
      <Seo
        title="Privacy Policy"
        description="BuildMyCVNow privacy policy covering CV content, Supabase storage, Google AdSense cookies, and user rights."
      />
      <StaticHero title="Privacy Policy" description="This policy explains what BuildMyCVNow may collect and how user CV data should be handled." />
      <section className="mx-auto max-w-4xl px-5 py-14">
        <PolicyCard title="Privacy Policy">
          <p><strong>Last updated:</strong> June 13, 2026.</p>
          <p>BuildMyCVNow may collect the information needed to create, verify, save, and download CVs, including name, email address, phone number, country, nationality, visa status, job history, education, skills, uploaded CV text, profile photos, saved drafts, saved CV versions, and download verification details.</p>
          <p><strong>Download-only mode:</strong> Users can create and download a CV without creating an account. The CV data stays in browser state or localStorage and is not intentionally saved to Supabase. Before download, the user may verify by email OTP. The email address entered for OTP may be processed by EmailJS only to send or verify the code. Users should download their file before closing the browser because no online copy is kept in this mode.</p>
          <p><strong>Registered account mode:</strong> Users can sign up or sign in with email/password, passwordless email OTP, or another enabled Supabase Auth provider. Registered users can save and manage up to 10 CVs online. Saved CVs, drafts, and related profile photo data may be stored with Supabase Auth, Supabase Database, and Supabase Storage under the authenticated account.</p>
          <p><strong>Retention:</strong> Online saved CVs are stored for up to 15 days. After that period, saved CV records are designed to expire and may be automatically deleted. Users are responsible for downloading and keeping their own copies before the storage period ends. Browser-local drafts may also be lost if the user clears browser storage, changes device, or uses private browsing.</p>
          <p><strong>Service providers:</strong> BuildMyCVNow may use Supabase for authentication, database, and storage; EmailJS for email messages and email OTP; OpenAI or similar AI services for optional writing assistance and CV parsing; Google Analytics for traffic measurement; Google reCAPTCHA for spam protection; and Google AdSense for advertising. These providers may process limited data needed to deliver their service.</p>
          <p><strong>Advertising and cookies:</strong> Ad areas support the free service. When Google AdSense, Google Analytics, or reCAPTCHA are enabled, Google and its partners may use cookies or similar technologies to measure traffic, protect forms, serve ads, and personalize ads where allowed by law and user settings.</p>
          <p><strong>User rights:</strong> Users can request access, correction, export, or deletion of stored personal data by using the Contact page. Users should avoid uploading or entering unnecessary sensitive information, passport numbers, national ID numbers, medical details, or private family information unless they intentionally choose to include it in their CV.</p>
          <p><strong>Security:</strong> BuildMyCVNow uses account-based access controls and Supabase Row Level Security for saved CV records. No online service can guarantee perfect security, so users should keep their login details private and download their own records for safekeeping.</p>
        </PolicyCard>
      </section>
    </PageShell>
  );
}

function TermsPage({ onStart }) {
  return (
    <PageShell onStart={onStart}>
      <Seo
        title="Terms of Use"
        description="BuildMyCVNow terms covering user responsibilities, CV ownership, and employment guarantee disclaimers."
      />
      <StaticHero title="Terms of Use" description="Please use BuildMyCVNow honestly and review your CV carefully before sending it to employers." />
      <section className="mx-auto max-w-4xl px-5 py-14">
        <PolicyCard title="Terms of Use">
          <p><strong>Last updated:</strong> June 13, 2026.</p>
          <p><strong>Free download-only use:</strong> Users may create and download a CV for free without creating an account. Before downloading, users must complete email OTP verification when requested. Download-only mode does not save CVs online, so users must download their file before closing the browser.</p>
          <p><strong>Registered account use:</strong> Users may create a free account to save and manage CVs online. Each account may save up to 10 CVs. Saved CVs are kept for up to 15 days and may be automatically deleted after that period. Users are responsible for downloading their own files before expiry.</p>
          <p><strong>User responsibility:</strong> Users are responsible for the accuracy, honesty, and completeness of the information they enter into BuildMyCVNow. Do not include false work history, certificates, education, licenses, salaries, visa status, references, or employer details.</p>
          <p><strong>CV ownership:</strong> Users own the CV content they create. BuildMyCVNow provides templates, formatting tools, download tools, AI assistance, and general guidance, but the user's personal information and work history remain their responsibility.</p>
          <p><strong>AI and imported CVs:</strong> AI-assisted parsing, grammar checks, rephrasing, and suggested wording may contain mistakes. Users must review, approve, edit, or reject suggestions before using them in a CV or cover letter.</p>
          <p><strong>No employment guarantee:</strong> BuildMyCVNow does not guarantee interviews, job offers, visa approval, agency acceptance, employer selection, salary offers, or background-check results. The app is a CV creation and career guidance tool only.</p>
          <p><strong>Acceptable use:</strong> Users must not misuse forms, abuse OTP requests, upload harmful files, attempt to access another user's records, interfere with the service, scrape data, or use the service for spam, fraud, scams, impersonation, or misleading job applications.</p>
          <p><strong>Service availability:</strong> BuildMyCVNow may change templates, limits, storage periods, provider integrations, or features to keep the service free, secure, and reliable. Third-party services such as Supabase, EmailJS, Google, and AI providers may also affect availability.</p>
        </PolicyCard>
      </section>
    </PageShell>
  );
}

function BlogIndexPage() {
  return <><Seo title="CV Writing and Career Tips Blog" description="Practical CV writing, ATS, and job search guides for your next career move." /><BlogLanding /></>;
}

function BlogArticlePage({ onStart }) {
  const { slug } = useParams();
  const article = blogArticles.find((item) => item.slug === slug);
  if (!article) return <Navigate to="/blog" replace />;
  const photography = getBlogPhotography(article);
  const related = blogArticles.filter((item) => item.slug !== article.slug && item.category === article.category).slice(0, 3);
  const splitIndex = Math.ceil(article.content.length / 2);
  return (
    <PageShell onStart={onStart}>
      <Seo title={article.title} description={article.excerpt} image={photography.image ? `https://buildmycvnow.com${photography.image}` : undefined} imageWidth={photography.imageWidth} imageHeight={photography.imageHeight} type="article" />
      <article className="mx-auto max-w-4xl px-5 py-14">
        <Link to="/blog" className="text-sm font-black text-green-700">Back to blog</Link>
        <p className="mt-8 flex flex-wrap gap-2 text-xs font-black uppercase text-slate-500">
          <span>{article.category}</span>
          <span>-</span>
          <span>{article.readTime}</span>
          <span>-</span>
          <span>{new Date(article.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-slate-950 sm:text-5xl">{article.title}</h1>
        {photography.image && <figure className="my-6">
          <img className="block h-auto w-full rounded-lg" src={photography.image} alt={photography.imageAlt} width={photography.imageWidth} height={photography.imageHeight} fetchPriority="high" />
          <figcaption className="mt-2 text-xs text-slate-600">Photo: <a href={photography.imageSource} target="_blank" rel="noopener noreferrer" className="underline">{photography.imageCredit}</a></figcaption>
        </figure>}
        <p className="mt-5 text-lg leading-8 text-slate-600">{article.excerpt}</p>
        <div className="mt-10 space-y-6 text-base leading-8 text-slate-700">
          {article.content.slice(0, splitIndex).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <AdBanner compact label="Google AdSense blog article ad" slot="5555555555" />
          {article.content.slice(splitIndex).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        {related.length > 0 && (
          <section className="mt-12 border-t border-slate-200 pt-8">
            <h2 className="text-2xl font-black text-slate-950">Related career tips</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((item) => (
                <Link key={item.slug} to={`/blog/${item.slug}`} className="rounded border border-slate-200 p-4 text-sm font-bold leading-6 text-slate-700 hover:border-green-500 hover:bg-green-50">
                  {item.title}
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </PageShell>
  );
}

function SiteFooter({ onStart }) {
  return (
    <footer className="landing-footer">
      <Link to="/" className="footer-logo" aria-label="BuildMyCVNow home"><BrandLogo /></Link>
      <nav className="footer-links" aria-label="Footer navigation">
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
          <Link to="/blog">Blog</Link>
        </nav>
      <div className="footer-action">
        <button onClick={onStart}>Start free CV</button>
        <p>Copyright 2025 BuildMyCVNow. All rights reserved.</p>
        <span>Free CV Builder for Job Seekers Worldwide</span>
        </div>
    </footer>
  );
}

function IPhonePortraitDisplay({ onStart }) {
  return (
    <section id="mobile-preview" className="border-y border-slate-200 bg-white px-5 py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="landing-video-card">
          <div className="landing-video-topbar">
            <BrandLogo />
            <span className="rounded bg-green-50 px-3 py-2 text-xs font-black text-green-700">
              Watch below
            </span>
          </div>
          <div className="landing-video-frame">
            <video controls playsInline preload="metadata" poster={HOME_VIDEO.poster} aria-label={HOME_VIDEO.name}>
              <source src={HOME_VIDEO.url} type="video/mp4" />
              Your browser cannot play this video. Please open the video in a new tab.
            </video>
          </div>
          <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
            Watch the short guide here without leaving BuildMyCVNow.
          </p>
        </div>
        <div>
          <h2 className="max-w-2xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Watch how to create and download your CV for free.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            This quick video shows job seekers how to choose a template, fill in their details, check the live preview, and download a professional CV.
          </p>
          <div className="mt-7 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
            <span className="flex items-center gap-2"><Icon name="check" className="h-5 w-5 text-green-600" /> Large form fields</span>
            <span className="flex items-center gap-2"><Icon name="eye" className="h-5 w-5 text-blue-600" /> Mobile CV preview</span>
            <span className="flex items-center gap-2"><Icon name="lock" className="h-5 w-5 text-green-600" /> OTP download flow</span>
            <span className="flex items-center gap-2"><Icon name="download" className="h-5 w-5 text-blue-600" /> PDF or Word</span>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={onStart} className="rounded bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700">
              Try the CV builder
            </button>
            <a href="#how-it-works" className="inline-flex items-center justify-center rounded border border-blue-600 px-6 py-4 font-bold text-blue-700 hover:bg-blue-50">
              Watch demo on this page
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function CVLine({ title, text }) {
  return (
    <div>
      <h3 className="text-xs font-black uppercase text-slate-950">{title}</h3>
      <p className="mt-1 leading-6">{text}</p>
    </div>
  );
}


function CategorySelector({ selected, onSelect }) {
  return (
    <div className="template-card-grid">
      {categories.map((category, index) => {
        const selectedCard = selected === category.id;
        const styleLabel = index % 3 === 0 ? "Modern" : index % 3 === 1 ? "Classic" : "Simple";
        const photoLabel = "Photo optional";
        return (
          <button
            type="button"
            value={category.id}
            key={category.id}
            aria-pressed={selectedCard}
            onClick={() => onSelect(category.id)}
            className={`template-card-button ${selectedCard ? "selected" : ""}`}
          >
            <div className="template-card-top">
              <span className="template-card-name">{category.name}</span>
              <span className="template-card-badge template-card-badge-neutral">ATS-friendly</span>
            </div>
            <span className="template-card-sub">{category.title}</span>
            <div className="template-card-meta">
              <span className="template-card-badge template-card-badge-green">{styleLabel}</span>
              <span className="template-card-badge template-card-badge-blue">{photoLabel}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ProfilePhotoUploader({ cv, onChange }) {
  return (
    <details className="workspace-photo-tools">
    <summary><Icon name="camera" className="h-4 w-4" /><span>Profile photo</span><small>Optional / 35 x 45 mm</small><Icon name="chevron" className="h-4 w-4" /></summary>
    <PhotoUploadCrop
      value={cv.profilePhoto}
      cropSource={cv.photoCropSource || ""}
      shape={cv.photoShape === "round" ? "circle" : cv.photoShape}
      onShapeChanged={(shape) => onChange("photoShape", shape)}
      onPhotoSaved={({ dataUrl, cropSource, shape, format }) => {
        onChange("photoShape", shape);
        onChange("photoCropSource", cropSource);
        onChange("photoFrameFormat", format);
        onChange("profilePhoto", dataUrl);
      }}
      onPhotoRemoved={() => {onChange("profilePhoto", "");onChange("photoCropSource", "");onChange("photoFrameFormat", "");}}
    />
    </details>
  );
}

function WorkExperienceEditor({ cv, onChange }) {
  const entries = normalizeWorkExperiences(cv);
  const [openId, setOpenId] = useState(entries[0]?.id || "");
  const [aiStatus, setAiStatus] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState({});
  useEffect(() => {
    if (!entries.some((entry) => entry.id === openId)) {
      setOpenId(entries[0]?.id || "");
    }
  }, [entries, openId]);
  const commitEntries = (nextEntries) => {
    const normalizedEntries = reindexManualWorkExperienceOrder(nextEntries);
    onChange("workExperiences", normalizedEntries);
    onChange("experience", formatWorkExperiences(normalizedEntries));
  };
  const updateEntry = (id, key, value) => {
    commitEntries(entries.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry)));
    if (key === "responsibilities") {
      setAiSuggestions((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };
  const addEntry = () => {
    const nextEntry = {
      ...createBlankExperienceEntry(),
      jobTitle: cv.jobTitle || "",
      manualOrder: entries.some((entry) => Number.isFinite(entry.manualOrder)) ? entries.length : undefined,
    };
    commitEntries([...entries, nextEntry]);
    setOpenId(nextEntry.id);
  };
  const removeEntry = (id) => {
    commitEntries(entries.length === 1 ? [{ ...createBlankExperienceEntry(), jobTitle: cv.jobTitle || "" }] : entries.filter((entry) => entry.id !== id));
  };
  const moveEntry = (id, direction) => {
    const ordered = sortWorkExperiences(entries).map((entry, index) => ({ ...entry, manualOrder: index }));
    const currentIndex = ordered.findIndex((entry) => entry.id === id);
    const targetIndex = currentIndex + direction;
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const nextEntries = [...ordered];
    [nextEntries[currentIndex], nextEntries[targetIndex]] = [nextEntries[targetIndex], nextEntries[currentIndex]];
    commitEntries(nextEntries.map((entry, index) => ({ ...entry, manualOrder: index })));
    setOpenId(id);
  };
  const improveEntry = (id) => {
    const target = entries.find((entry) => entry.id === id);
    if (!target?.responsibilities?.trim()) {
      setAiStatus("Add responsibilities or achievements first, then AI can check and improve them.");
      return;
    }
    const improved = target.responsibilities
      .split("\n")
      .map((line) => line.trim().replace(/^[-*]\s*/, ""))
      .filter(Boolean)
      .slice(0, 5)
      .map((line) => {
        const cleaned = line
          .replace(/\s+/g, " ")
          .replace(/\bi\b/g, "I")
          .replace(/\bw\/\b/gi, "with")
          .replace(/\buae\b/gi, "UAE")
          .replace(/\bgcc\b/gi, "GCC")
          .replace(/\bcv\b/gi, "CV")
          .trim()
          .replace(/[.ã€‚]+$/, "");
        const first = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
        const professionalLine = /^(managed|coordinated|prepared|supported|handled|improved|maintained|assisted|recorded|inspected|served|installed|repaired|organized|monitored|processed|delivered|supervised|trained|created|checked|resolved)/i.test(cleaned)
          ? cleaned
          : `Improved daily operations by ${first}`;
        return professionalLine.charAt(0).toUpperCase() + professionalLine.slice(1);
      })
      .join("\n");
    updateEntry(id, "responsibilities", improved);
    setAiStatus("AI checked grammar and improved the wording. Please review and edit anything that does not match your real experience.");
  };
  const spellingCorrections = [
    [/\bfroward\b/gi, "forwarded"],
    [/\bfrowrd\b/gi, "forwarded"],
    [/\bfrowrded\b/gi, "forwarded"],
    [/\bforwrd\b/gi, "forwarded"],
    [/\bforword\b/gi, "forwarded"],
    [/\bforworded\b/gi, "forwarded"],
    [/\bfrward\b/gi, "forwarded"],
    [/\bconced\b/gi, "concerned"],
    [/\bconcernrd\b/gi, "concerned"],
    [/\bconcernd\b/gi, "concerned"],
    [/\bconcernedrd\b/gi, "concerned"],
    [/\bconcern\b(?=\s+(person|department|team|manager|staff))/gi, "concerned"],
    [/\bconcered\b/gi, "concerned"],
    [/\bcomunication\b/gi, "communication"],
    [/\bcommunciation\b/gi, "communication"],
    [/\brecive\b/gi, "receive"],
    [/\brecived\b/gi, "received"],
    [/\brecieve\b/gi, "receive"],
    [/\brecieved\b/gi, "received"],
    [/\bmanagment\b/gi, "management"],
    [/\bmaintainance\b/gi, "maintenance"],
    [/\bacheivement\b/gi, "achievement"],
    [/\bachievments\b/gi, "achievements"],
    [/\bresponsibilites\b/gi, "responsibilities"],
    [/\bcostumer\b/gi, "customer"],
    [/\bcostumers\b/gi, "customers"],
    [/\bcpstumer\b/gi, "customer"],
    [/\bcpstumers\b/gi, "customers"],
    [/\bcstumer\b/gi, "customer"],
    [/\bcstumers\b/gi, "customers"],
    [/\bguets\b/gi, "guests"],
    [/\bservce\b/gi, "service"],
    [/\bsuperviser\b/gi, "supervisor"],
    [/\bcalmy\b/gi, "calmly"],
  ];
  const applyAiSpellingAndGrammar = (line) => {
    let corrected = line;
    spellingCorrections.forEach(([pattern, replacement]) => {
      corrected = corrected.replace(pattern, replacement);
    });
    return corrected
      .replace(/\bAccepted calls\b/gi, "Answered calls")
      .replace(/\baccept calls\b/gi, "answer calls")
      .replace(/\baccepted call\b/gi, "answered call")
      .replace(/\bReceive calls\b/gi, "Answered calls")
      .replace(/\breceive calls\b/gi, "answer calls")
      .replace(/\breceived calls\b/gi, "answered calls")
      .replace(/\bAnswered calls and forwarded? (?:to )?(?:the )?concerned person\b/gi, "Answered calls and forwarded them to the concerned person")
      .replace(/\bAnswer calls and forward(?:ed)? (?:to )?(?:the )?concerned person\b/gi, "Answer calls and forward them to the concerned person")
      .replace(/\bforwarded to concerned person\b/gi, "forwarded them to the concerned person")
      .replace(/\bforwarded to the concerned person\b/gi, "forwarded them to the concerned person")
      .replace(/\bforwarded? (?:to )?(?:the )?concerned person\b/gi, "forwarded them to the concerned person")
      .replace(/\bGreet customer in polite manner\b/gi, "Greeted customers in a polite manner")
      .replace(/\bgreet customer in polite manner\b/gi, "greeted customers in a polite manner")
      .replace(/\bGreet customers in polite manner\b/gi, "Greeted customers in a polite manner")
      .replace(/\bgreet customers in polite manner\b/gi, "greeted customers in a polite manner")
      .replace(/\band report to\b/gi, "and reported to")
      .replace(/\breport to management\b/gi, "reported to management")
      .replace(/\breport to manager\b/gi, "reported to manager")
      .replace(/\bprovide\b(?=\s)/gi, "provided")
      .replace(/\bprepare\b(?=\s)/gi, "prepared")
      .replace(/\bhandle\b(?=\s)/gi, "handled");
  };
  const createReviewSuggestion = (text) =>
    text
      .split("\n")
      .map((line) => line.trim().replace(/^[-*]\s*/, ""))
      .filter(Boolean)
      .slice(0, 5)
      .map((line) => {
        const cleaned = applyAiSpellingAndGrammar(line)
          .replace(/\s+/g, " ")
          .replace(/\bi\b/g, "I")
          .replace(/\bw\/\b/gi, "with")
          .replace(/\buae\b/gi, "UAE")
          .replace(/\bgcc\b/gi, "GCC")
          .replace(/\bcv\b/gi, "CV")
          .trim()
          .replace(/[.]+$/, "");
        const first = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
        const professionalLine = /^(managed|coordinated|prepared|supported|handled|improved|maintained|assisted|recorded|inspected|served|installed|repaired|organized|monitored|processed|delivered|supervised|trained|created|checked|resolved)/i.test(cleaned)
          ? cleaned
          : `Improved daily operations by ${first}`;
        return professionalLine.charAt(0).toUpperCase() + professionalLine.slice(1);
      })
      .join("\n");
  const reviewEntryWithAi = (id) => {
    const target = entries.find((entry) => entry.id === id);
    if (!target?.responsibilities?.trim()) {
      setAiStatus("Add responsibilities or achievements first, then AI can check and improve them.");
      return;
    }
    setAiSuggestions((current) => ({
      ...current,
      [id]: {
        original: target.responsibilities,
        suggested: createReviewSuggestion(target.responsibilities),
      },
    }));
    setAiStatus("AI created a suggested rewrite. Approve to use it or reject to keep your original text.");
  };
  const approveSuggestion = (id) => {
    const suggestion = aiSuggestions[id];
    if (!suggestion) return;
    commitEntries(entries.map((entry) => (entry.id === id ? { ...entry, responsibilities: suggestion.suggested } : entry)));
    setAiSuggestions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setAiStatus("AI suggestion approved and added to your CV. You can still edit it anytime.");
  };
  const rejectSuggestion = (id) => {
    setAiSuggestions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setAiStatus("AI suggestion rejected. Your original responsibilities were kept.");
  };
  return (
    <section className="space-y-3">
      <p className="text-xs font-bold leading-5 text-slate-500">Add one card for each employer. The preview updates instantly.</p>
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <article key={entry.id} className={`entry-card ${openId === entry.id ? "open" : ""}`}>
            <button type="button" className="entry-card-header" onClick={() => setOpenId(openId === entry.id ? "" : entry.id)}>
              <Icon name="briefcase" className="h-4 w-4 text-blue-700" />
              <span className="entry-card-title">{entry.employer || `New role ${index + 1}`}</span>
              {entry.isCurrent && <span className="entry-current-badge">Current</span>}
              <Icon name="chevron" className={`h-4 w-4 text-slate-400 transition ${openId === entry.id ? "rotate-180" : ""}`} />
            </button>
            {openId === entry.id && (
            <div className="entry-card-body">
            <div className="field-pair">
              <label>
                <span className="form-label">Job title / position</span>
                <input className="form-field" value={entry.jobTitle || ""} onChange={(event) => updateEntry(entry.id, "jobTitle", event.target.value)} placeholder="Example: Warehouse Assistant" />
              </label>
              <label>
                <span className="form-label">Employer name</span>
                <input className="form-field" value={entry.employer || ""} onChange={(event) => updateEntry(entry.id, "employer", event.target.value)} placeholder="Example: Amazon" />
              </label>
            </div>
            <div className="field-pair">
              <label>
                <span className="form-label">Date employed from</span>
                <input className="form-field" value={entry.fromDate || ""} onChange={(event) => updateEntry(entry.id, "fromDate", event.target.value)} placeholder="Example: August 2023" />
              </label>
              <label>
                <span className="form-label">Date employed to</span>
                <input className="form-field" value={entry.toDate || ""} disabled={entry.isCurrent} onChange={(event) => updateEntry(entry.id, "toDate", event.target.value)} placeholder="Example: March 2023" />
              </label>
            </div>
            <label className="block">
              <span className="form-label">Company location</span>
              <input className="form-field" value={entry.companyLocation || ""} onChange={(event) => updateEntry(entry.id, "companyLocation", event.target.value)} placeholder="Example: Dubai, United Arab Emirates" />
            </label>
            <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600">
              <input type="checkbox" checked={Boolean(entry.isCurrent)} onChange={(event) => updateEntry(entry.id, "isCurrent", event.target.checked)} />
              I currently work here
            </label>
            <label className="block">
              <span className="form-label">Responsibilities / achievements</span>
              <textarea className="form-field resize-y" rows={5} value={entry.responsibilities || ""} onChange={(event) => updateEntry(entry.id, "responsibilities", event.target.value)} placeholder="Example: Managed inventory records, prepared daily dispatch documents, and coordinated deliveries across UAE sites." />
            </label>
            <div className="ai-assist-row">
              <button type="button" onClick={() => reviewEntryWithAi(entry.id)} className="btn-ai btn-ai-work"><Icon name="sparkle" className="h-3 w-3" /> Check with AI</button>
              <span className="ai-hint">Check spelling, grammar, and make this sound more professional</span>
            </div>
            {aiSuggestions[entry.id] && (
              <div className="ai-suggestion-card">
                <div className="ai-suggestion-header">
                  <span><Icon name="sparkle" className="h-4 w-4" /> AI suggested rewrite</span>
                  <span>Approve or reject before it changes your CV</span>
                </div>
                <div className="ai-suggestion-grid">
                  <div>
                    <p className="ai-suggestion-label">Original text</p>
                    <pre>{aiSuggestions[entry.id].original}</pre>
                  </div>
                  <div>
                    <p className="ai-suggestion-label">Suggested text</p>
                    <pre>{aiSuggestions[entry.id].suggested}</pre>
                  </div>
                </div>
                <div className="ai-suggestion-actions">
                  <button type="button" onClick={() => approveSuggestion(entry.id)} className="ai-approve-button">Approve and use this</button>
                  <button type="button" onClick={() => rejectSuggestion(entry.id)} className="ai-reject-button">Reject</button>
                </div>
              </div>
            )}
            <div className="entry-card-actions">
              <button type="button" onClick={() => moveEntry(entry.id, -1)} className="entry-order-button" disabled={index === 0}>
                <Icon name="chevron" className="h-3 w-3 rotate-180" /> Move up
              </button>
              <button type="button" onClick={() => moveEntry(entry.id, 1)} className="entry-order-button" disabled={index === entries.length - 1}>
                <Icon name="chevron" className="h-3 w-3" /> Move down
              </button>
              <button type="button" onClick={() => removeEntry(entry.id)} className="self-start rounded border border-red-200 px-3 py-2 text-xs font-black text-red-700">
                Remove role
              </button>
            </div>
            </div>
            )}
          </article>
        ))}
      </div>
      {aiStatus && <p className="text-xs font-bold text-blue-700">{aiStatus}</p>}
      <button type="button" onClick={addEntry} className="btn-add-more">
        <Icon name="plus" className="h-4 w-4" /> Add another role
      </button>
    </section>
  );
}

function CollapsibleFormSection({ id, title, icon = "file", defaultOpen = false, badge, children, focused = false, hidden = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = focused || open;
  return (
    <section id={`builder-section-${id}`} hidden={hidden} className={`form-section-card ${expanded ? "open" : ""} ${focused ? "workspace-focused-section" : ""}`}>
      <button type="button" className="form-section-head" onClick={() => setOpen(!open)} aria-expanded={expanded}>
        <Icon name={icon} className="h-4 w-4 text-blue-700" />
        <span className="form-section-title">{title}</span>
        {badge && <span className="entry-current-badge">{badge}</span>}
        <Icon name="chevron" className={`h-4 w-4 text-slate-400 transition ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <div className="form-section-body">{children}</div>}
    </section>
  );
}

function FormField({ label, value, onChange, type = "text", rows = 3, placeholder = "" }) {
  return (
    <label className="block">
      <span className="form-label">{label}</span>
      {type === "textarea" ? (
        <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} rows={rows} className="form-field resize-y" placeholder={placeholder} />
      ) : (
        <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="form-field" placeholder={placeholder} />
      )}
    </label>
  );
}

function ThemeToggle({ mode, setMode, cycleMode }) {
  const options = [
    ["light", "sun", "Light"],
    ["dark", "moon", "Dark"],
    ["system", "monitor", "System"],
  ];
  return (
    <>
      <div className="theme-toggle" aria-label="Builder theme">
        {options.map(([id, icon, label]) => (
          <button key={id} type="button" title={label} aria-label={label} onClick={() => setMode(id)} className={mode === id ? "active" : ""}>
            <Icon name={icon} className="h-4 w-4" />
          </button>
        ))}
      </div>
      <button type="button" onClick={cycleMode} className="theme-cycle-button" aria-label="Cycle theme">
        <Icon name={mode === "dark" ? "moon" : mode === "light" ? "sun" : "monitor"} className="h-4 w-4" />
      </button>
    </>
  );
}

function InlineTip({ industry, field, enabled }) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(`bmcv_tip_dismissed_${field}`) === "1");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const fieldTips = getTips(industry, field);
  useEffect(() => {
    setIndex((current) => (fieldTips.length ? (current + 1) % fieldTips.length : 0));
  }, [field, industry, fieldTips.length]);
  if (!fieldTips.length) return null;
  const dismiss = () => {
    sessionStorage.setItem(`bmcv_tip_dismissed_${field}`, "1");
    setDismissed(true);
  };
  return (
    <div className="inline-tip-wrap">
      <button type="button" className="inline-tip-button" onClick={() => setOpen((value) => !value)} aria-label="Show writing tips">
        <Icon name="lightbulb" className="h-4 w-4" />
      </button>
      {enabled && !dismissed && (
        <div className="inline-tip-strip">
          <span>{fieldTips[index] || fieldTips[0]}</span>
          <button type="button" onClick={dismiss}>Hide</button>
        </div>
      )}
      {open && (
        <div className="inline-tip-popover">
          {fieldTips.map((tip) => <p key={tip}>{tip}</p>)}
        </div>
      )}
    </div>
  );
}

function SmartTip({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="smart-tip">
      <span>{message}</span>
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}

function TipSection({ industry, field, tipsEnabled, children }) {
  return (
    <div className="tip-section">
      <InlineTip industry={industry} field={field} enabled={tipsEnabled} />
      {children}
    </div>
  );
}

function QrBlock({ qrCode, color = "#1E293B", size = 64 }) {
  const normalized = normalizeQrUrl(qrCode?.url || "");
  const enabled = qrCode?.enabled && normalized.ok;
  const svg = useQrSvg(enabled ? normalized.url : "", color);
  if (!enabled || !svg) return null;
  return (
    <div className="cv-qr-block" style={{ width: size }}>
      <div className="cv-qr-svg" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
      <p>{qrCode.label || "Scan for LinkedIn"}</p>
    </div>
  );
}

function QrCodeSection({ cv, onChange }) {
  const qrCode = { ...defaultQrCode, ...(cv.qrCode || {}) };
  const normalized = normalizeQrUrl(qrCode.url || cv.linkedIn || cv.portfolioUrl || "");
  const svg = useQrSvg(qrCode.enabled && normalized.ok ? normalized.url : "", "#1E293B");
  const update = (patch) => onChange("qrCode", { ...qrCode, ...patch });
  return (
    <CollapsibleFormSection id="qr" title="LinkedIn QR code" icon="qr" badge={qrCode.enabled && normalized.ok ? "Ready" : ""}>
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={Boolean(qrCode.enabled)} onChange={(event) => update({ enabled: event.target.checked })} className="mt-1 h-4 w-4" />
        <span>
          <span className="block text-sm font-black">Add QR code to my CV</span>
          <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">Tip: ATS systems ignore QR codes. Keep your LinkedIn URL as text too.</span>
        </span>
      </label>
      <div className="qr-form-grid">
        <label>
          <span className="form-label">LinkedIn, GitHub, or portfolio URL</span>
          <input value={qrCode.url} onChange={(event) => update({ url: event.target.value })} className="form-field" placeholder="linkedin.com/in/yourname" />
          <span className={normalized.ok ? "qr-valid" : "qr-invalid"}>{normalized.message}</span>
        </label>
        <div className="qr-mini-preview">
          {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <span>QR preview</span>}
        </div>
      </div>
      <div className="field-pair">
        <FormField label="QR caption" value={qrCode.label} onChange={(value) => update({ label: value.slice(0, 30) })} placeholder="Scan for LinkedIn" />
        <label>
          <span className="form-label">QR position</span>
          <select value={qrCode.position} onChange={(event) => update({ position: event.target.value })} className="form-field">
            <option value="header">Header right</option>
            <option value="sidebar">Sidebar bottom</option>
            <option value="footer">Footer center</option>
          </select>
        </label>
      </div>
    </CollapsibleFormSection>
  );
}

function ReferencesSection({ cv, onChange }) {
  const references = normalizeReferences(cv.references);
  const update = (next) => onChange("references", next);
  const addReference = () => {
    if (references.entries.length >= 4) return;
    update({ ...references, mode: "listed", entries: [...references.entries, createReferenceEntry()] });
  };
  const updateEntry = (id, patch) => {
    update({ ...references, entries: references.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) });
  };
  const removeEntry = (id) => {
    if (!window.confirm("Remove this reference?")) return;
    update({ ...references, entries: references.entries.filter((entry) => entry.id !== id) });
  };
  return (
    <CollapsibleFormSection id="references" title="References" icon="file" badge={referencesHasContent(references) ? "Done" : ""}>
      <div className="reference-mode-grid">
        {[
          ["none", "Do not include", "Hide references from this CV"],
          ["on-request", "Available upon request", "Recommended for UAE/GCC"],
          ["listed", "List my references", "Show approved referee details"],
        ].map(([id, title, text]) => (
          <button key={id} type="button" onClick={() => update({ ...references, mode: id })} className={references.mode === id ? "reference-mode active" : "reference-mode"}>
            <strong>{title}</strong>
            <span>{text}</span>
          </button>
        ))}
      </div>
      {references.mode === "listed" && (
        <div className="reference-entry-list">
          {references.entries.map((entry) => (
            <article key={entry.id} className="reference-entry-card">
              <div className="field-pair">
                <FormField label="Reference name" value={entry.name} onChange={(value) => updateEntry(entry.id, { name: value })} />
                <FormField label="Job title" value={entry.jobTitle} onChange={(value) => updateEntry(entry.id, { jobTitle: value })} />
              </div>
              <div className="field-pair">
                <FormField label="Company" value={entry.company} onChange={(value) => updateEntry(entry.id, { company: value })} />
                <label>
                  <span className="form-label">Relationship</span>
                  <select value={entry.relationship} onChange={(event) => updateEntry(entry.id, { relationship: event.target.value })} className="form-field">
                    {["Manager", "Supervisor", "Colleague", "Client", "HR", "Professor", "Other"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <div className="field-pair">
                <label>
                  <span className="form-label">Phone</span>
                  <div className="phone-row">
                    <select value={entry.phoneCode || "+971"} onChange={(event) => updateEntry(entry.id, { phoneCode: event.target.value })} className="form-field">
                      {["+971", "+966", "+965", "+973", "+974", "+968", "+63", "+91", "+92"].map((code) => <option key={code}>{code}</option>)}
                    </select>
                    <input value={entry.phone || ""} onChange={(event) => updateEntry(entry.id, { phone: event.target.value })} className="form-field" />
                  </div>
                </label>
                <FormField label="Email" type="email" value={entry.email} onChange={(value) => updateEntry(entry.id, { email: value })} />
              </div>
              <label className="reference-consent">
                <input type="checkbox" checked={Boolean(entry.consentGiven)} onChange={(event) => updateEntry(entry.id, { consentGiven: event.target.checked })} />
                <span>I have this person's permission to share contact details.</span>
              </label>
              {!entry.consentGiven && <p className="reference-hidden-badge">Hidden until consent confirmed</p>}
              <button type="button" onClick={() => removeEntry(entry.id)} className="reference-remove">Delete reference</button>
            </article>
          ))}
          <button type="button" onClick={addReference} disabled={references.entries.length >= 4} className="add-reference-button">
            {references.entries.length >= 4 ? "Maximum 4 references" : "Add reference"}
          </button>
        </div>
      )}
    </CollapsibleFormSection>
  );
}

function CVBuilderForm({ cv, onChange, activeSection }) {
  const [smartTips, setSmartTips] = useState({});
  const tipsEnabled = cv.tipsEnabled !== false;
  const handleBlurTip = (field, value) => {
    if (!tipsEnabled) return;
    const message = getSmartTip(field, value);
    if (message) setSmartTips((current) => ({ ...current, [field]: message }));
  };
  const clearSmartTip = (field) => setSmartTips((current) => ({ ...current, [field]: "" }));
  const improveText = (key) => {
    const value = String(cv[key] || "").trim();
    if (!value) return;
    const improved = key === "summary"
      ? `${value.replace(/\.$/, "")}. Experienced in UAE/GCC job requirements, clear communication, and reliable daily performance.`
      : value
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 10)
          .join(", ");
    onChange(key, improved);
  };
  return (
    <div className="space-y-3">
      <CollapsibleFormSection id="personal" title="Personal info" icon="file" defaultOpen badge={cv.fullName ? "Done" : ""} focused={activeSection === "personal"} hidden={Boolean(activeSection && activeSection !== "personal")}>
        <div className="field-pair">
          <FormField label="Full name" value={cv.fullName} onChange={(value) => onChange("fullName", value)} placeholder="Example: Juan Dela Cruz" />
          <FormField label="Job title" value={cv.jobTitle} onChange={(value) => onChange("jobTitle", value)} placeholder="Example: Logistics Assistant" />
        </div>
        <div className="field-pair">
          <label className="block">
            <span className="form-label">Contact email</span>
            <input type="email" value={cv.email || ""} onChange={(event) => onChange("email", event.target.value)} onBlur={(event) => handleBlurTip("email", event.target.value)} className="form-field" placeholder="name@email.com" />
            <SmartTip message={smartTips.email} onDismiss={() => clearSmartTip("email")} />
          </label>
          <label className="block">
            <span className="form-label">Contact number</span>
            <input type="tel" value={cv.phone || ""} onChange={(event) => onChange("phone", event.target.value)} onBlur={(event) => handleBlurTip("phone", event.target.value)} className="form-field" placeholder="+971 50 123 4567" />
            <SmartTip message={smartTips.phone} onDismiss={() => clearSmartTip("phone")} />
          </label>
        </div>
        <div className="field-pair">
          <FormField label="Country" value={cv.country} onChange={(value) => onChange("country", value)} placeholder="United Arab Emirates" />
          {cv.showCountrySpecificFields ? (
            <FormField label="Nationality" value={cv.nationality} onChange={(value) => onChange("nationality", value)} placeholder="Filipino" />
          ) : (
            <FormField label="LinkedIn headline (optional)" value={cv.linkedInHeadline || ""} onChange={(value) => onChange("linkedInHeadline", value)} placeholder="Example: Front Office Receptionist | Guest Relations" />
          )}
        </div>
        <label className="tips-toggle">
          <input type="checkbox" checked={Boolean(cv.showCountrySpecificFields)} onChange={(event) => onChange("showCountrySpecificFields", event.target.checked)} />
          <span>Show country-specific fields</span>
        </label>
        {cv.showCountrySpecificFields && (
          <div className="field-pair">
            <FormField label="Visa status" value={cv.visaStatus} onChange={(value) => onChange("visaStatus", value)} placeholder="Visit visa / Own visa / Employment visa" />
            <FormField label="Driving license" value={cv.drivingLicense} onChange={(value) => onChange("drivingLicense", value)} placeholder="UAE driving license / No UAE license" />
          </div>
        )}
        <div className="field-pair">
          <FormField label="LinkedIn URL" type="url" value={cv.linkedIn} onChange={(value) => onChange("linkedIn", value)} placeholder="https://linkedin.com/in/yourname" />
          <FormField label="Portfolio URL" type="url" value={cv.portfolioUrl} onChange={(value) => onChange("portfolioUrl", value)} placeholder="Portfolio, GitHub, or work sample link" />
        </div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(cv.expectedSalaryEnabled)}
            onChange={(event) => onChange("expectedSalaryEnabled", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-green-600"
          />
          <span>
            <span className="block text-sm font-black text-slate-950">Include expected salary</span>
            <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">Optional. Show only if the employer asks for salary expectation.</span>
          </span>
        </label>
        {cv.expectedSalaryEnabled && (
          <label className="mt-4 block">
            <span className="form-label">Expected salary</span>
            <input value={cv.expectedSalary || ""} onChange={(event) => onChange("expectedSalary", event.target.value)} className="form-field" placeholder="Example: AED 2,500 per month, negotiable" />
          </label>
        )}
        <TipSection industry={cv.industry} field="contact" tipsEnabled={tipsEnabled}>
          <div className="field-pair">
            <label>
              <span className="form-label">Which industry are you applying in?</span>
              <select value={cv.industry || "general"} onChange={(event) => onChange("industry", event.target.value)} className="form-field">
                {industryOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="tips-toggle">
              <input type="checkbox" checked={tipsEnabled} onChange={(event) => onChange("tipsEnabled", event.target.checked)} />
              <span>Show writing tips</span>
            </label>
          </div>
          <div className="field-pair">
            <FormField label="Target country" value={cv.targetCountry} onChange={(value) => onChange("targetCountry", value)} placeholder="Worldwide, UAE, Canada, Germany..." />
            <FormField label="Target job" value={cv.targetJobTitle} onChange={(value) => onChange("targetJobTitle", value)} placeholder="Hotel Receptionist, Accountant, Mechanical Engineer..." />
          </div>
        </TipSection>
      </CollapsibleFormSection>

      <CollapsibleFormSection id="experience" title="Work experience" icon="briefcase" defaultOpen badge={normalizeWorkExperiences(cv).some((entry) => entry.employer) ? "Done" : ""} focused={activeSection === "experience"} hidden={Boolean(activeSection && activeSection !== "experience")}>
        <InlineTip industry={cv.industry} field="experience" enabled={tipsEnabled} />
        <WorkExperienceEditor cv={cv} onChange={onChange} />
      </CollapsibleFormSection>

      <CollapsibleFormSection id="education" title="Education and certifications" icon="file" badge={cv.education ? "Done" : ""} focused={activeSection === "education"} hidden={Boolean(activeSection && activeSection !== "education")}>
        <FormField label="Education" type="textarea" rows={4} value={cv.education} onChange={(value) => onChange("education", value)} placeholder="Example: High School Diploma, Manila High School, 2018" />
        <FormField label="Projects (optional)" type="textarea" rows={4} value={cv.projects} onChange={(value) => onChange("projects", value)} placeholder="Example: Website redesign, inventory tracking project, school capstone, or work improvement project" />
        <FormField label="Awards" type="textarea" rows={3} value={cv.awards || ""} onChange={(value) => onChange("awards", value)} />
        <FormField label="Volunteer experience" type="textarea" rows={4} value={cv.volunteerExperience || ""} onChange={(value) => onChange("volunteerExperience", value)} />
        <FormField label="Other professional links" type="textarea" rows={3} value={cv.professionalLinks || ""} onChange={(value) => onChange("professionalLinks", value)} />
        <FormField label="Unclassified imported content (not printed automatically)" type="textarea" rows={4} value={cv.unclassifiedContent || ""} onChange={(value) => onChange("unclassifiedContent", value)} />
        <FormField label="Certifications & licenses" type="textarea" rows={3} value={cv.certifications} onChange={(value) => onChange("certifications", value)} placeholder="Example: Basic Food Safety Certificate, TESDA NC II, UAE driving license" />
      </CollapsibleFormSection>

      <div hidden={Boolean(activeSection && activeSection !== "extras")}><ReferencesSection cv={cv} onChange={onChange} /></div>

      <CollapsibleFormSection id="skills" title="Skills and languages" icon="check" badge={cv.skills ? "Done" : ""} focused={activeSection === "skills"} hidden={Boolean(activeSection && activeSection !== "skills")}>
        <InlineTip industry={cv.industry} field="skills" enabled={tipsEnabled} />
        <label className="block">
          <span className="form-label">Skills</span>
          <textarea value={cv.skills || ""} onChange={(event) => onChange("skills", event.target.value)} onBlur={(event) => handleBlurTip("skills", event.target.value)} rows={4} className="form-field resize-y" placeholder="Example: Inventory control, customer service, Excel, dispatch coordination" />
          <SmartTip message={smartTips.skills} onDismiss={() => clearSmartTip("skills")} />
        </label>
        <div className="ai-assist-row">
          <button type="button" onClick={() => improveText("skills")} className="btn-ai"><Icon name="sparkle" className="h-3 w-3" /> Improve with AI</button>
          <span className="ai-hint">Clean and strengthen your skills list</span>
        </div>
        <FormField label="Languages spoken" type="textarea" rows={3} value={cv.languages} onChange={(value) => onChange("languages", value)} placeholder="Example: English - Good, Filipino - Native, Arabic - Basic" />
      </CollapsibleFormSection>

      <div hidden={Boolean(activeSection && activeSection !== "extras")}><QrCodeSection cv={cv} onChange={onChange} /></div>

      <CollapsibleFormSection id="summary" title="Professional summary" icon="file" badge={cv.summary?.length > 40 ? "Done" : ""} focused={activeSection === "summary"} hidden={Boolean(activeSection && activeSection !== "summary")}>
        <InlineTip industry={cv.industry} field="summary" enabled={tipsEnabled} />
        <label className="block">
          <span className="form-label">Professional summary / objective</span>
          <textarea value={cv.summary || ""} onChange={(event) => onChange("summary", event.target.value)} onBlur={(event) => handleBlurTip("summary", event.target.value)} rows={5} className="form-field resize-y" placeholder="Example: Reliable logistics assistant with UAE warehouse experience, strong inventory skills, and careful documentation habits." />
          <SmartTip message={smartTips.summary} onDismiss={() => clearSmartTip("summary")} />
        </label>
        <div className="ai-assist-row">
          <button type="button" onClick={() => improveText("summary")} className="btn-ai"><Icon name="sparkle" className="h-3 w-3" /> Improve with AI</button>
          <span className="ai-hint">Make your summary clearer for UAE/GCC employers</span>
        </div>
      </CollapsibleFormSection>
    </div>
  );
}

async function readJsonResponseSafely(response, fallbackMessage = "Request failed.") {
  const rawText = await response.text().catch(() => "");
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawText || "{}");
    } catch {
      throw new Error("The server returned invalid JSON. Please try again.");
    }
  }
  if (!rawText.trim()) {
    throw new Error(fallbackMessage);
  }
  const normalized = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (/<!doctype html|<html/i.test(rawText)) {
    throw new Error("The server returned an unexpected page instead of a valid response. Please try again in a moment.");
  }
  throw new Error(normalized || fallbackMessage);
}

function CVCompletenessPanel({ cv }) {
  const completeness = getCompleteness(cv);
  return (
    <section className="rounded border border-green-200 bg-green-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="panel-title text-green-950">CV completeness</h3>
        <span className="text-sm font-black text-green-800">{completeness.score}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${completeness.score}%` }} />
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-green-900">
        {completeness.completed} of {completeness.total} sections complete. {completeness.tip}
      </p>
    </section>
  );
}

function ThemeSelector({ selected, onSelect }) {
  return (
    <section>
      <h3 className="panel-title">Theme color</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {themes.map((theme) => (
          <button
            key={theme.id}
            title={theme.name}
            aria-label={theme.name}
            onClick={() => onSelect(theme.id)}
            className={`h-9 w-9 rounded-full border-2 ${selected === theme.id ? "border-slate-950" : "border-white"} shadow ring-1 ring-slate-200`}
            style={{ background: theme.color }}
          />
        ))}
      </div>
    </section>
  );
}

function LayoutSelector({ selected, onSelect }) {
  return (
    <section>
      <h3 className="panel-title">Layout</h3>
      <div className="mt-3 grid gap-2">
        {layouts.map((layout) => (
          <button key={layout.id} onClick={() => onSelect(layout.id)} className={`flex items-center gap-3 rounded border p-3 text-left text-sm font-bold ${selected === layout.id ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700"}`}>
            <span className="grid h-10 w-10 grid-cols-2 gap-1 rounded border border-slate-300 bg-white p-1">
              <span className={`${layout.id === "sidebar" ? "row-span-2" : ""} rounded-sm`} style={{ background: selected === layout.id ? "#0f66d0" : "#cbd5e1" }} />
              <span className="rounded-sm bg-slate-200" />
              <span className="rounded-sm bg-slate-200" />
            </span>
            {layout.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function PageBorderSelector({ cv, onChange }) {
  const current = getCvPageBorderConfig(cv);
  const selectPreset = (presetId) => {
    if (presetId === "1cm") {
      onChange("pageBorderPreset", "1cm");
      onChange("pageBorderUnit", "cm");
      onChange("pageBorderValue", "1");
      return;
    }
    if (presetId === "1in") {
      onChange("pageBorderPreset", "1in");
      onChange("pageBorderUnit", "in");
      onChange("pageBorderValue", "1");
      return;
    }
    onChange("pageBorderPreset", "custom");
  };

  return (
    <section>
      <h3 className="panel-title">Page borders</h3>
      <p className="mt-2 text-xs font-bold leading-5 text-slate-500">Apply the page margin to preview and CV download.</p>
      <div className="page-border-options mt-3">
        {pageBorderPresets.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => selectPreset(option.id)}
            className={`page-border-option ${current.preset === option.id ? "selected" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {current.preset === "custom" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Unit</span>
            <select
              className="form-field"
              value={current.unit}
              onChange={(event) => {
                onChange("pageBorderPreset", "custom");
                onChange("pageBorderUnit", event.target.value);
              }}
            >
              <option value="cm">Centimeters</option>
              <option value="in">Inches</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Size</span>
            <input
              className="form-field"
              type="number"
              min="0"
              max="3"
              step={current.unit === "cm" ? "0.1" : "0.05"}
              value={cv.pageBorderValue ?? ""}
              onChange={(event) => {
                onChange("pageBorderPreset", "custom");
                onChange("pageBorderValue", event.target.value);
              }}
            />
          </label>
        </div>
      )}
      <p className="mt-2 text-xs font-bold text-slate-500">
        Current border: {current.unit === "cm" ? `${current.value} cm` : `${current.value} inch${current.value === 1 ? "" : "es"}`}
      </p>
    </section>
  );
}

function LiveCVPreview({ cv, theme, layout }) {
  const isRtl = cv.languageDirection === "rtl" || isArabicLanguage(cv.outputLanguage);
  const pageBorderPadding = getCvPageBorderPixels(cv);
  const lines = (value) => String(value || "").split("\n").filter(Boolean);
  const chunks = (items, size) => {
    const result = [];
    for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
    return result.length ? result : [[]];
  };
  const contactItems = [
    cv.email ? { id: "email", icon: "mail", label: "Email", value: cv.email } : null,
    cv.phone ? { id: "phone", icon: "phone", label: "Contact Number", value: cv.phone } : null,
    cv.country ? { id: "country", icon: "pin", label: "Location", value: cv.country } : null,
    cv.linkedIn ? { id: "linkedin", icon: "globe", label: "LinkedIn", value: cv.linkedIn } : null,
    cv.portfolioUrl ? { id: "portfolio", icon: "globe", label: "Portfolio", value: cv.portfolioUrl } : null,
  ].filter(Boolean);
  const contactLines = contactItems.map((item) => item.value);
  const personalDetails = [
    cv.nationality && `Nationality: ${cv.nationality}`,
    cv.visaStatus && `Visa Status: ${cv.visaStatus}`,
    cv.drivingLicense && `Driving License: ${cv.drivingLicense}`,
    cv.expectedSalaryEnabled && cv.expectedSalary && `Expected Salary: ${cv.expectedSalary}`,
  ].filter(Boolean);
  const sectionIcons = {
    "Personal Details": "user",
    "Professional Summary": "file",
    "Work Experience": "briefcase",
    "Work Experience continued": "briefcase",
    Education: "graduation",
    Projects: "folder",
    Skills: "sparkle",
    Certifications: "award",
    Languages: "globe",
    References: "user",
  };
  const photoStyles = getPassportPhotoStyles(cv);
  const photo = () =>
    cv.profilePhoto ? (
      <span className="cv-passport-frame" data-photo-shape={normalizePhotoShape(cv.photoShape)} style={photoStyles.frame}><img src={cv.profilePhoto} alt={`${cv.fullName} profile`} className="cv-passport-image" style={photoStyles.image} /></span>
    ) : null;
  const renderSectionHeading = (title) => (
    <div className="cv-section-heading">
      <span className="cv-section-icon" style={{ color: theme.color, borderColor: `${theme.color}33`, backgroundColor: `${theme.color}14` }}>
        <Icon name={sectionIcons[title] || "file"} className="h-3.5 w-3.5" />
      </span>
      <h3 className="cv-section-title" style={{ color: theme.dark, borderColor: theme.color }}>{title}</h3>
    </div>
  );
  const renderContactItem = (item, tone = "muted") => (
    <div key={item.id} className={`cv-contact-item ${tone === "light" ? "light" : ""}`}>
      <span className="cv-contact-icon">
        <Icon name={item.icon} className="h-3.5 w-3.5" />
      </span>
      <span>{item.value}</span>
    </div>
  );
  const section = (title, content, list = false) => (
    <section className="break-inside-avoid">
      {renderSectionHeading(title)}
      {list ? <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-5 text-slate-700">{lines(content).map((line) => <li key={line}>{line}</li>)}</ul> : <p className="mt-2 whitespace-pre-line text-[12px] leading-5 text-slate-700">{content}</p>}
    </section>
  );
  const referencesBlock = () => {
    const references = normalizeReferences(cv.references);
    if (references.mode === "on-request") return section("References", "References available upon request");
    if (references.mode !== "listed") return null;
    const visibleEntries = references.entries.filter((entry) => entry.consentGiven && entry.name && entry.company);
    if (!visibleEntries.length) return null;
    return (
      <section className="references-preview-block">
        {renderSectionHeading("References")}
        <div className="references-preview-grid">
          {visibleEntries.map((entry) => (
            <article key={entry.id} className="reference-preview-card">
              <p className="font-black text-slate-900">{entry.name}</p>
              <p>{[entry.jobTitle, entry.company].filter(Boolean).join(", ")}</p>
              {entry.relationship && <p className="text-slate-500">{entry.relationship}</p>}
              {entry.phone && <p>{[entry.phoneCode, entry.phone].filter(Boolean).join(" ")}</p>}
              {entry.email && <p>{entry.email}</p>}
            </article>
          ))}
        </div>
      </section>
    );
  };
  const workEntries = normalizeWorkExperiences(cv);
  const renderWorkEntry = (block) => (
    <section className="break-inside-avoid">
      {block.showTitle && renderSectionHeading(block.title)}
      <article className="mt-3 text-[12px] leading-5 text-slate-700">
        <div className="flex flex-col justify-between gap-1 sm:flex-row">
          <div>
            <p className="font-black text-slate-900">{block.entry.jobTitle || "Job title"}</p>
            <p className="font-bold text-slate-700">{block.entry.employer || "Employer name"}</p>
            {block.entry.companyLocation && <p className="font-semibold text-slate-500">{block.entry.companyLocation}</p>}
          </div>
          <p className="font-bold text-slate-500">{[block.entry.fromDate, block.entry.isCurrent ? "Present" : block.entry.toDate].filter(Boolean).join(" - ")}</p>
        </div>
        {block.responsibilities && (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {lines(block.responsibilities).map((line) => <li key={line}>{line}</li>)}
          </ul>
        )}
      </article>
    </section>
  );
  const blockWeight = (content, base = 1.4) => base + Math.ceil(lines(content).join(" ").length / 220);
  const workBlocks = workEntries.flatMap((entry, entryIndex) => {
    const responsibilityChunks = chunks(lines(entry.responsibilities), layout === "compact" ? 7 : 6);
    return responsibilityChunks.map((chunk, chunkIndex) => ({
      id: `work-${entry.id}-${chunkIndex}`,
      type: "work",
      entry,
      responsibilities: chunk.join("\n"),
      showTitle: entryIndex === 0 && chunkIndex === 0,
      title: entryIndex === 0 && chunkIndex === 0 ? "Work Experience" : "Work Experience continued",
      weight: 2.1 + Math.max(1, chunk.length * 0.75),
    }));
  });
  const sectionBlocks = {
    summary: () => ({ id: "summary", type: "section", title: "Professional Summary", content: cv.summary, weight: blockWeight(cv.summary, 1.5) }),
    experience: () => workBlocks,
    education: () => ({ id: "education", type: "section", title: "Education", content: cv.education, weight: blockWeight(cv.education, 1.3) }),
    educationProjects: () => ({ id: "educationProjects", type: "section", title: "Projects", content: cv.projects, weight: blockWeight(cv.projects, 1.25) }),
    skills: () => ({ id: "skills", type: "section", title: "Skills", content: cv.skills, weight: blockWeight(cv.skills, 1.2) }),
    awards: () => ({ id: "awards", type: "section", title: "Awards", content: cv.awards, weight: blockWeight(cv.awards, 1.2) }),
    volunteerExperience: () => ({ id: "volunteerExperience", type: "section", title: "Volunteer Experience", content: cv.volunteerExperience, weight: blockWeight(cv.volunteerExperience, 1.2) }),
    professionalLinks: () => ({ id: "professionalLinks", type: "section", title: "Professional Links", content: cv.professionalLinks, weight: blockWeight(cv.professionalLinks, .8) }),
    certifications: () => ({ id: "certifications", type: "section", title: "Certifications", content: cv.certifications, weight: blockWeight(cv.certifications, 1.2) }),
    languages: () => ({ id: "languages", type: "section", title: "Languages", content: cv.languages, weight: blockWeight(cv.languages, 0.9) }),
    references: () => ({ id: "references", type: "custom", render: referencesBlock, weight: 1.4 }),
  };
  const previewBlocks = [
    ...(personalDetails.length > 0 ? [{ id: "personal-details", type: "section", title: "Personal Details", content: personalDetails.join("\n"), weight: blockWeight(personalDetails.join("\n"), 1.1) }] : []),
    ...visibleSectionOrder(cv).flatMap((id) => {
      const value = sectionBlocks[id]?.();
      return Array.isArray(value) ? value : value ? [value] : [];
    }),
  ];
  const pageLimit = layout === "compact" ? 11.5 : layout === "sidebar" ? 12.25 : 10.75;
  const pages = previewBlocks.reduce((acc, block) => {
    const current = acc[acc.length - 1];
    const currentWeight = current.reduce((sum, item) => sum + item.weight, 0);
    const limit = acc.length === 1 && cv.profilePhoto && layout !== "sidebar" ? pageLimit - 1.75 : pageLimit;
    if (current.length && currentWeight + block.weight > limit) acc.push([block]);
    else current.push(block);
    return acc;
  }, [[]]).filter(Boolean);
  const renderBlock = (block) => {
    if (block.type === "work") return renderWorkEntry(block);
    if (block.type === "custom") return block.render();
    return section(block.title, block.content);
  };
  const renderPageContent = (pageBlocks) => (
    <div className={layout === "compact" ? "space-y-3" : "space-y-5"}>
      {pageBlocks.map((block) => <React.Fragment key={block.id}>{renderBlock(block)}</React.Fragment>)}
    </div>
  );
  const renderSidebar = (pageIndex) => (
    <aside className="cv-sidebar text-white" style={{ background: theme.dark }}>
      <div className="sidebar-header">
        <div className="photo-container">
          {cv.profilePhoto ? (
            photo()
          ) : (
            <div className={`profile-photo placeholder ${cv.photoShape === "circle" || cv.photoShape === "round" ? "round" : cv.photoShape === "rounded" ? "rounded" : "square"}`}>{initials(cv.fullName)}</div>
          )}
        </div>
        <div className="name-block">
          <h2 className="text-xl font-black leading-tight">{cv.fullName}</h2>
          <p className="mt-1 text-sm font-bold text-white/85">{cv.jobTitle}</p>
        </div>
      </div>
      <div className="sidebar-contact mt-7 space-y-3 text-[11px] leading-5 text-white/85">
        {contactItems.map((item) => renderContactItem(item, "light"))}
      </div>
      {cv.qrCode?.position === "sidebar" && pageIndex === 0 && (
        <div className="mt-7 flex justify-center">
          <QrBlock qrCode={cv.qrCode} color="#ffffff" size={80} />
        </div>
      )}
    </aside>
  );
  const renderHeader = () => (
    <header className={`relative flex items-center gap-4 ${layout === "header" ? "rounded p-5 pr-24 text-white" : "border-b border-slate-200 pb-5 pr-24"}`} style={layout === "header" ? { background: theme.dark } : {}}>
      {photo()}
      <div>
        <h2 className="text-2xl font-black leading-tight">{cv.fullName}</h2>
        <p className={`mt-1 text-sm font-bold ${layout === "header" ? "text-white/90" : "text-blue-700"}`} style={layout === "header" ? {} : { color: theme.color }}>{cv.jobTitle}</p>
        <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] ${layout === "header" ? "text-white/85" : "text-slate-500"}`}>
          {contactItems.map((item) => renderContactItem(item, layout === "header" ? "light" : "muted"))}
        </div>
      </div>
      {cv.qrCode?.position === "header" && <div className="absolute right-4 top-4"><QrBlock qrCode={cv.qrCode} color={layout === "header" ? "#ffffff" : "#1E293B"} /></div>}
    </header>
  );
  const renderContinuationHeader = () => (
    <header className="cv-continuation-header" style={{ borderColor: theme.color }}>
      <div>
        <h2>{cv.fullName || "Candidate Name"}</h2>
        <p>{cv.jobTitle || "Job title"}</p>
      </div>
      <div className="cv-continuation-contact">
        {contactItems.filter((item) => ["email", "phone", "country"].includes(item.id)).map((item) => renderContactItem(item, "muted"))}
      </div>
    </header>
  );
  return (
    <div className={`cv-page-stack ${isRtl ? "cv-rtl" : ""}`} dir={isRtl ? "rtl" : "ltr"} aria-label={`${pages.length} page CV preview`}>
      {pages.map((pageBlocks, pageIndex) => pageIndex > 0 ? (
        <article key={pageIndex} className={`cv-paper cv-paper-page ${isRtl ? "cv-rtl" : ""}`} style={{ padding: `${pageBorderPadding}px` }}>
          {renderContinuationHeader()}
          <div className="mt-6">{renderPageContent(pageBlocks)}</div>
          {cv.qrCode?.position === "footer" && pageIndex === pages.length - 1 && <div className="mt-6 flex justify-center"><QrBlock qrCode={cv.qrCode} color="#1E293B" /></div>}
          <p className="cv-page-number">Page {pageIndex + 1} of {pages.length}</p>
        </article>
      ) : layout === "sidebar" ? (
        <article key={pageIndex} className={`cv-paper cv-paper-page grid grid-cols-[0.38fr_0.62fr] overflow-hidden ${isRtl ? "cv-rtl" : ""}`} style={{ padding: `${pageBorderPadding}px` }}>
          {renderSidebar(pageIndex)}
          <div className="p-7">
            {renderPageContent(pageBlocks)}
            <p className="cv-page-number">Page {pageIndex + 1} of {pages.length}</p>
          </div>
        </article>
      ) : (
        <article key={pageIndex} className={`cv-paper cv-paper-page ${isRtl ? "cv-rtl" : ""}`} style={{ padding: `${pageBorderPadding}px` }}>
          {renderHeader()}
          <div className="mt-6">{renderPageContent(pageBlocks)}</div>
          {cv.qrCode?.position === "footer" && pageIndex === pages.length - 1 && <div className="mt-6 flex justify-center"><QrBlock qrCode={cv.qrCode} color="#1E293B" /></div>}
          <p className="cv-page-number">Page {pageIndex + 1} of {pages.length}</p>
        </article>
      ))}
    </div>
  );
}

function DownloadModal({ cv, onClose, onVerifiedDownload, canEmailCopy = false, emailCopyAddress = "", title = "Verify to download", description = "Enter your contact details. We will send an OTP before unlocking downloads.", label = "Downloads", onOtpRequested, onOtpVerified }) {
  const [details, setDetails] = useState({ name: cv.fullName, email: cv.email, country: cv.country, phone: cv.phone });
  const [otp, setOtp] = useState("");
  const [otpChallenge, setOtpChallenge] = useState(null);
  const [mockOtp, setMockOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const runDownloadAction = async (type) => {
    setActionStatus(type === "email" ? "Sending CV copy to email..." : "Preparing your file...");
    try {
      const result = await onVerifiedDownload(type, details);
      setActionStatus(result?.message || (type === "email" ? "CV email request completed." : "Download started."));
    } catch (error) {
      setActionStatus(error.message || "Action failed. Please try again.");
    }
  };
  const sendOtp = async (event) => {
    event.preventDefault();
    setActionStatus("Sending OTP to your email...");
    setVerified(false);
    setOtp("");
    setMockOtp("");
    setOtpChallenge(null);
    try {
      const response = await fetch("/.netlify/functions/emailOtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email: details.email, name: details.name }),
      });
      const result = await readJsonResponseSafely(response, "Could not send OTP.");
      if (!response.ok || !result.ok) throw new Error(result.message || "Could not send OTP.");
      setOtpChallenge(result.challenge);
      setMockOtp(result.mockOtp || "");
      setActionStatus(result.message || "OTP sent. Enter the code to unlock downloads.");
      onOtpRequested?.(details);
    } catch (error) {
      setActionStatus(error.message || "Could not send OTP. Please try again.");
    }
  };
  const verify = async () => {
    try {
      const response = await fetch("/.netlify/functions/emailOtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: details.email, otp, challenge: otpChallenge }),
      });
      const result = await readJsonResponseSafely(response, "Could not verify OTP.");
      if (!response.ok || !result.ok) throw new Error(result.message || "Invalid OTP.");
      setVerified(true);
      setActionStatus("OTP verified. Downloads are unlocked.");
      onOtpVerified?.(details);
    } catch (error) {
      setVerified(false);
      setActionStatus(error.message || "Invalid OTP. Please try again.");
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-lg rounded bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500" aria-label="Close download dialog" title="Close"><Icon name="plus" className="h-5 w-5 rotate-45" /></button>
        </div>
        <form onSubmit={sendOtp} className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["name", "Name"],
            ["email", "Contact email"],
            ["country", "Country"],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="form-label">{label}</span>
              <input
                value={details[key]}
                onChange={(event) => setDetails({ ...details, [key]: event.target.value })}
                className="form-field"
                required
              />
            </label>
          ))}
          <button className="rounded bg-blue-600 px-5 py-3 font-bold text-white sm:col-span-2">Send OTP</button>
        </form>
        {otpChallenge && (
          <div className="mt-5 rounded border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-900">Enter the 6-digit OTP sent to your email.</p>
            {mockOtp && <p className="mt-1 text-xs font-bold text-amber-800">Test mode OTP: {mockOtp}</p>}
            <div className="mt-3 flex gap-2">
              <input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" maxLength={6} className="form-field" placeholder="Enter 6-digit OTP" />
              <button onClick={verify} className="rounded bg-green-600 px-5 py-3 font-bold text-white">Verify</button>
            </div>
            {verified && <p className="mt-3 text-sm font-bold text-green-800">OTP verified. {label} are unlocked.</p>}
          </div>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button disabled={!verified} onClick={() => runDownloadAction("pdf")} className="rounded bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Download Free PDF</button>
          <button disabled={!verified} onClick={() => runDownloadAction("word")} className="rounded border border-blue-600 px-5 py-3 font-bold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">Download DOCX</button>
          {canEmailCopy ? (
            <button disabled={!verified} onClick={() => runDownloadAction("email")} className="rounded border border-green-600 bg-green-50 px-5 py-3 font-bold text-green-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-white disabled:text-slate-400 sm:col-span-2">
              Email CV copy to {emailCopyAddress || details.email}
            </button>
          ) : (
            <p className="rounded bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-900 sm:col-span-2">
              Sign in with email if you want BuildMyCVNow to send a CV copy to your inbox.
            </p>
          )}
        </div>
        {actionStatus && <p className="mt-3 rounded bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-700">{actionStatus}</p>}
      </div>
    </div>
  );
}

function AuthModal({ onClose, onUrgentMode, onRegisteredMode }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accountOtp, setAccountOtp] = useState({ name: "", email: "", token: "", sent: false });
  const [message, setMessage] = useState(isSupabaseConfigured ? "" : "Add VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY to .env to enable login.");
  const [loading, setLoading] = useState(false);
  const [lastSignupEmail, setLastSignupEmail] = useState("");
  const resendEmailTarget = (lastSignupEmail || form.email || accountOtp.email || "").trim();
  const canResendConfirmation = Boolean(resendEmailTarget);
  const sendAccountOtpCode = async ({ email, name, keepMode = true }) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: AUTH_REDIRECT_URL,
        data: { full_name: name },
      },
    });
    if (error) throw error;
    setAccountOtp({ name: name || "", email, token: "", sent: true });
    if (keepMode) setMode("accountOtp");
    trackEvent("account_email_otp_sent");
  };
  const startUrgentMode = () => {
    trackEvent("urgent_mode_start", { method: "local" });
    onUrgentMode("local");
    onClose();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    try {
      const captchaToken = await getRecaptchaToken(mode === "signup" ? "signup" : "signin");
      if (isRecaptchaConfigured) {
        const captchaResponse = await fetch("/.netlify/functions/verifyRecaptcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: captchaToken, action: mode === "signup" ? "signup" : "signin" }),
        });
        if (captchaResponse.ok && captchaResponse.headers.get("content-type")?.includes("application/json")) {
          const captchaResult = await captchaResponse.json();
          if (captchaResult.success === false) throw new Error("reCAPTCHA verification failed.");
        }
      }
      const options = {
        emailRedirectTo: AUTH_REDIRECT_URL,
        data: { full_name: form.name },
        captchaToken,
      };
      const { error } =
        mode === "signup"
          ? await supabase.auth.signUp({ email: form.email, password: form.password, options })
          : await supabase.auth.signInWithPassword({ email: form.email, password: form.password, captchaToken });
      if (error) throw error;
      trackEvent(mode === "signup" ? "signup" : "login", { method: "email" });
      if (mode === "signup") {
        setLastSignupEmail(form.email);
        try {
          await sendAccountOtpCode({ email: form.email, name: form.name });
          setMessage("Account created. We sent an email OTP so you can open your account right away. If a confirmation link also arrives later, that works too.");
        } catch (otpError) {
          setMessage("Signup request sent. Please check your inbox and spam folder for the confirmation email. If it does not arrive, use Email OTP or Resend confirmation email below.");
        }
      } else {
        setMessage("Signed in successfully.");
        onRegisteredMode();
      }
      if (mode === "signin") onClose();
    } catch (error) {
      if (String(error.message || "").toLowerCase().includes("email not confirmed")) {
        setLastSignupEmail(form.email);
      }
      setMessage(error.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };
  const resendConfirmation = async () => {
    if (!supabase || !resendEmailTarget) return;
    setLoading(true);
    setMessage("Sending confirmation email again...");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: resendEmailTarget,
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      });
      if (error) {
        const fallback = await fetch("/.netlify/functions/resendSignupConfirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resendEmailTarget }),
        });
        if (!fallback.ok) throw error;
      }
      trackEvent("signup_confirmation_resend");
      setLastSignupEmail(resendEmailTarget);
      setMessage(`Confirmation email sent again to ${resendEmailTarget}. Please check your inbox and spam folder.`);
    } catch (error) {
      setMessage(error.message || "Could not resend confirmation email.");
    } finally {
      setLoading(false);
    }
  };
  const signInWithGoogle = async () => {
    if (!supabase) return;
    onRegisteredMode();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: AUTH_REDIRECT_URL },
    });
    if (error) setMessage(error.message);
  };
  const switchToEmailOtp = () => {
    setAccountOtp((current) => ({
      ...current,
      name: current.name || form.name,
      email: current.email || form.email,
      token: "",
      sent: false,
    }));
    setMode("accountOtp");
    setMessage("Use email OTP if your account is already registered but not confirmed yet.");
  };
  const sendAccountEmailOtp = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("Sending account verification code...");
    try {
      await sendAccountOtpCode({ email: accountOtp.email, name: accountOtp.name, keepMode: false });
      setMessage("Account OTP sent. Check your email inbox and spam folder, then enter the code here.");
    } catch (error) {
      setMessage(error.message || "Could not send account OTP.");
    } finally {
      setLoading(false);
    }
  };
  const verifyAccountEmailOtp = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("Verifying account OTP...");
    try {
      const normalizedToken = String(accountOtp.token || "").trim().replace(/\s+/g, "");
      const { error } = await supabase.auth.verifyOtp({
        email: accountOtp.email,
        token: normalizedToken,
        type: "email",
      });
      if (error) throw error;
      onRegisteredMode();
      trackEvent("account_email_otp_verified");
      onClose();
    } catch (error) {
      setMessage(error.message || "Invalid account OTP.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">{mode === "signin" ? "Login" : "Create account"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Choose quick download-only mode or sign in to save CVs online.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500" aria-label="Close sign-in dialog" title="Close"><Icon name="plus" className="h-5 w-5 rotate-45" /></button>
        </div>
        <div className="mt-5 grid gap-2">
          <button onClick={startUrgentMode} className="rounded bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700">
            Continue without cloud saving
          </button>
          <p className="rounded bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
            Download-only mode: Your CV will not be saved online. Download your file before closing the browser.
          </p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-black uppercase text-slate-500">Sign in / Create account to save online</p>
          <div className="grid grid-cols-3 gap-2">
          {[
            ["signin", "Login"],
            ["signup", "Sign up"],
            ["accountOtp", "Email OTP"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} className={`rounded px-4 py-3 text-sm font-black ${mode === id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>
              {label}
            </button>
          ))}
          </div>
        </div>
        {mode === "accountOtp" ? (
          <form onSubmit={accountOtp.sent ? verifyAccountEmailOtp : sendAccountEmailOtp} className="mt-5 grid gap-3">
            {!accountOtp.sent && (
              <label>
                <span className="form-label">Full name</span>
                <input className="form-field" value={accountOtp.name} onChange={(event) => setAccountOtp({ ...accountOtp, name: event.target.value })} required />
              </label>
            )}
            <label>
              <span className="form-label">Email address</span>
              <input className="form-field" type="email" value={accountOtp.email} onChange={(event) => setAccountOtp({ ...accountOtp, email: event.target.value })} required disabled={accountOtp.sent} />
            </label>
            {accountOtp.sent && (
              <label>
                <span className="form-label">Email OTP code</span>
                <input
                  className="form-field"
                  inputMode="text"
                  autoComplete="one-time-code"
                  spellCheck="false"
                  value={accountOtp.token}
                  onChange={(event) => setAccountOtp({ ...accountOtp, token: event.target.value })}
                  placeholder="Paste the code from your email"
                  required
                />
                <p className="mt-2 text-xs font-bold text-slate-500">
                  Enter the full verification code from your Supabase email. Spaces are removed automatically.
                </p>
              </label>
            )}
            <button disabled={!isSupabaseConfigured || loading} className="rounded bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {loading ? "Please wait..." : accountOtp.sent ? "Verify OTP and open account" : "Send email OTP"}
            </button>
            <p className="rounded bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
              Free account mode lets you save up to 10 CVs online. Saved CVs expire after 15 days, so download copies for your records.
            </p>
          </form>
        ) : (
        <form onSubmit={submit} className="mt-5 grid gap-3">
          {mode === "signup" && (
            <label>
              <span className="form-label">Full name</span>
              <input className="form-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
          )}
          <label>
            <span className="form-label">Email address</span>
            <input className="form-field" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            <span className="form-label">Password</span>
            <input className="form-field" type="password" minLength={6} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </label>
          {isRecaptchaConfigured && <p className="text-xs font-bold text-slate-500">Protected by Google reCAPTCHA.</p>}
          <button disabled={!isSupabaseConfigured || loading} className="rounded bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? "Please wait..." : mode === "signin" ? "Login" : "Create account"}
          </button>
        </form>
        )}
        {GOOGLE_AUTH_ENABLED ? (
          <button disabled={!isSupabaseConfigured} onClick={signInWithGoogle} className="mt-3 w-full rounded border border-blue-600 px-5 py-3 font-bold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">
            Continue with Google
          </button>
        ) : (
          <p className="mt-3 rounded bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
            Google login is hidden until the Google provider is enabled in Supabase.
          </p>
        )}
        {canResendConfirmation && (
          <button disabled={loading} onClick={resendConfirmation} className="mt-3 w-full rounded border border-green-600 px-5 py-3 font-bold text-green-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">
            Resend confirmation email
          </button>
        )}
        {mode === "signin" && String(message || "").toLowerCase().includes("email not confirmed") && (
          <button
            type="button"
            disabled={loading}
            onClick={switchToEmailOtp}
            className="mt-3 w-full rounded border border-blue-600 px-5 py-3 font-bold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
          >
            Use Email OTP instead
          </button>
        )}
        {message && <p className="mt-4 rounded bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-700">{message}</p>}
      </div>
    </div>
  );
}

function MyCvsPanel({ user, cv, categoryId, themeId, layoutId, onLoad, onSaveDraft, onLoadDraft, draftStatus, onSaved }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(user ? "Load your saved CVs." : `Login to save and manage up to ${SAVED_CV_LIMIT} CVs.`);
  const refresh = async () => {
    if (!user) return;
    try {
      setItems(await listUserCvs(user.id));
      setMessage(`Saved CVs loaded. Each online CV is kept for ${SAVED_CV_RETENTION_DAYS} days.`);
    } catch (error) {
      setMessage(error.message);
    }
  };
  useEffect(() => {
    refresh();
  }, [user?.id]);
  const saveCurrent = async () => {
    if (!user) {
      setMessage("Please login first.");
      return;
    }
    try {
      const saved = await saveCvForUser({ userId: user.id, cv, categoryId, themeId, layoutId });
      onSaved?.(saved);
      trackEvent("save_cv");
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  };
  const duplicate = async (item) => {
    try {
      await duplicateUserCv(item);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  };
  const remove = async (id) => {
    try {
      await deleteUserCv(id);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="panel-title">My CVs dashboard</h3>
          <p className="mt-1 text-[11px] font-bold text-slate-500">{items.length} saved version{items.length === 1 ? "" : "s"} of {SAVED_CV_LIMIT}</p>
        </div>
        <button onClick={saveCurrent} className="rounded bg-green-600 px-3 py-2 text-xs font-black text-white">Save</button>
      </div>
      <div className="mt-3 rounded border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs font-black text-blue-950">Save progress and come back later</p>
        <p className="mt-1 text-xs font-bold leading-5 text-blue-800">{draftStatus || "Cloud draft sync is ready."}</p>
        <p className="mt-1 text-xs font-bold leading-5 text-blue-900">Online CVs are stored for {SAVED_CV_RETENTION_DAYS} days, then removed automatically. Download your files regularly.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onSaveDraft} className="rounded bg-blue-600 px-3 py-2 text-xs font-black text-white">Save draft</button>
          <button onClick={onLoadDraft} className="rounded bg-white px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-200">Restore draft</button>
        </div>
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{message}</p>
      <div className="mt-3 space-y-2">
        {items.length === 0 && (
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
            No saved CV versions yet. Use Save to store this CV online, then duplicate versions for different job applications.
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="rounded border border-slate-200 p-3">
            <p className="text-sm font-black text-slate-900">{item.title}</p>
            <p className="text-xs text-slate-500">
              {item.category_id || "CV version"} - Last updated {new Date(item.updated_at || item.created_at).toLocaleString()}
            </p>
            <p className="mt-1 text-xs font-bold text-amber-700">
              Expires {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : `${SAVED_CV_RETENTION_DAYS} days after saving once database expiry is enabled`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => onLoad(item)} className="rounded bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Edit</button>
              <button onClick={() => duplicate(item)} className="rounded bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">Duplicate</button>
              <button onClick={() => remove(item.id)} className="rounded bg-red-50 px-3 py-2 text-xs font-black text-red-700">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoverLetterTemplateSelector({ selectedRole, onSelect }) {
  return (
    <label className="block">
      <span className="form-label">Cover letter job category</span>
      <select value={selectedRole} onChange={(event) => onSelect(event.target.value)} className="form-field">
        {coverLetterRoleGroups.map((group) => (
          <optgroup label={group.group} key={group.group}>
            {group.roles.map((role) => (
              <option value={role} key={role}>{role}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function CoverLetterApplicantForm({ cv, letter, onCvChange, onLetterChange }) {
  const cvFields = [
    ["fullName", "Full Name", "text"],
    ["email", "Email Address", "email"],
    ["phone", "Phone Number", "tel"],
    ["country", "Location", "text"],
  ];
  const letterFields = [
    ["nationality", "Nationality (optional)", "text"],
    ["visaStatus", "Visa Status (optional)", "text"],
    ["linkedIn", "LinkedIn URL (optional)", "url"],
    ["yearsExperience", "Years of Experience", "text"],
  ];
  return (
    <div className="grid gap-4">
      {cvFields.map(([key, label, type]) => (
        <label key={key} className="block">
          <span className="form-label">{label}</span>
          {type === "textarea" ? (
            <textarea value={cv[key]} onChange={(event) => onCvChange(key, event.target.value)} rows={key === "summary" ? 4 : 3} className="form-field resize-y" />
          ) : (
            <input type={type} value={cv[key]} onChange={(event) => onCvChange(key, event.target.value)} className="form-field" />
          )}
        </label>
      ))}
      {letterFields.map(([key, label, type]) => (
        <label key={key} className="block">
          <span className="form-label">{label}</span>
          <input type={type} value={letter[key] || ""} onChange={(event) => onLetterChange(key, event.target.value)} className="form-field" />
        </label>
      ))}
    </div>
  );
}

const coverLetterAiFields = new Set(["jobDescription", "opening", "body", "qualifications", "value", "closing"]);
const coverLetterParagraphFields = new Set(["opening", "body", "qualifications", "value", "closing"]);

const coverLetterSpellingCorrections = [
  [/\brecive\b/gi, "receive"],
  [/\brecieved\b/gi, "received"],
  [/\breceving\b/gi, "receiving"],
  [/\bfroward\b/gi, "forward"],
  [/\bfrowrd\b/gi, "forward"],
  [/\bfrowrded\b/gi, "forwarded"],
  [/\bforwrd\b/gi, "forward"],
  [/\bconcernrd\b/gi, "concerned"],
  [/\bconced\b/gi, "concerned"],
  [/\bcpstumer\b/gi, "customer"],
  [/\bcostumer\b/gi, "customer"],
  [/\bcustum(er|ers)\b/gi, "customer$1"],
  [/\bcomunication\b/gi, "communication"],
  [/\bmanagment\b/gi, "management"],
  [/\bexperiance\b/gi, "experience"],
  [/\bresponsiblity\b/gi, "responsibility"],
  [/\bresponsiblities\b/gi, "responsibilities"],
  [/\bachivement\b/gi, "achievement"],
  [/\bachivements\b/gi, "achievements"],
  [/\bprofesional\b/gi, "professional"],
  [/\boppertunity\b/gi, "opportunity"],
  [/\boppurtunity\b/gi, "opportunity"],
  [/\bintersted\b/gi, "interested"],
  [/\bappling\b/gi, "applying"],
  [/\bapplyed\b/gi, "applied"],
  [/\bcompnay\b/gi, "company"],
  [/\borganisation\b/gi, "organization"],
  [/\balot\b/gi, "a lot"],
  [/\bteh\b/gi, "the"],
  [/\bi\b/g, "I"],
];

const professionalReplacements = [
  [/\bi want to apply for\b/gi, "I am pleased to apply for"],
  [/\bi am writing for\b/gi, "I am writing to apply for"],
  [/\bi am good at\b/gi, "I have practical experience in"],
  [/\bi can do\b/gi, "I am able to handle"],
  [/\bi know how to\b/gi, "I have experience in"],
  [/\bhard working\b/gi, "hardworking"],
  [/\bfast learner\b/gi, "quick learner"],
  [/\bteam player\b/gi, "collaborative team member"],
  [/\bworked in\b/gi, "gained experience in"],
  [/\bhelped\b/gi, "supported"],
  [/\bdone\b/gi, "completed"],
  [/\bmake sure\b/gi, "ensure"],
  [/\blook after\b/gi, "manage"],
  [/\btalk to\b/gi, "communicate with"],
];

const polishCoverLetterText = (text, fieldKey = "") => {
  let polished = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  coverLetterSpellingCorrections.forEach(([pattern, replacement]) => {
    polished = polished.replace(pattern, replacement);
  });
  professionalReplacements.forEach(([pattern, replacement]) => {
    polished = polished.replace(pattern, replacement);
  });
  polished = polished
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => {
      const cleaned = sentence.replace(/[.]+$/, "");
      return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}.`;
    })
    .join(" ");
  if (!polished) return "";
  if (fieldKey === "opening" && !/\b(apply|application|position|opportunity)\b/i.test(polished)) {
    polished = `${polished} I am interested in this opportunity and confident that my background matches the needs of the role.`;
  }
  if (fieldKey === "closing" && !/\b(thank|interview|consideration|opportunity)\b/i.test(polished)) {
    polished = `${polished} Thank you for your time and consideration. I would welcome the opportunity to discuss my application further.`;
  }
  return polished;
};

function CoverLetterForm({ letter, onChange, onRegenerate }) {
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [aiStatus, setAiStatus] = useState("");
  const fields = [
    ["hiringManager", "Hiring manager name", "text"],
    ["companyName", "Company name", "text"],
    ["companyAddress", "Company address/location", "text"],
    ["position", "Job position applied for", "text"],
    ["jobDescription", "Job Description", "textarea"],
    ["opening", "Opening paragraph", "textarea"],
    ["body", "Skills/experience paragraph", "textarea"],
    ["qualifications", "Skills and qualifications", "textarea"],
    ["value", "Value proposition", "textarea"],
    ["closing", "Closing paragraph", "textarea"],
  ];
  const reviewWithAi = (key, label) => {
    const original = String(coverLetterParagraphFields.has(key) ? sanitizeCvTextForCoverLetter(letter[key]) : letter[key] || "").trim();
    if (!original) {
      setAiStatus(`Add text in ${label.toLowerCase()} first, then AI Assistant can check it.`);
      return;
    }
    const suggested = polishCoverLetterText(original, key);
    setAiSuggestions((current) => ({
      ...current,
      [key]: { original, suggested },
    }));
    setAiStatus("AI Assistant checked spelling, grammar, and professional wording. Please approve or reject the suggestion.");
  };
  const approveSuggestion = (key) => {
    const suggestion = aiSuggestions[key];
    if (!suggestion) return;
    onChange(key, suggestion.suggested);
    setAiSuggestions((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setAiStatus("Suggestion applied. Please review the cover letter preview before downloading.");
  };
  const rejectSuggestion = (key) => {
    setAiSuggestions((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setAiStatus("Suggestion rejected. Your original cover letter text was kept.");
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="form-label">Experience Level</span>
          <select value={letter.experienceLevel || experienceLevels[0]} onChange={(event) => onChange("experienceLevel", event.target.value)} className="form-field">
            {experienceLevels.map((level) => <option key={level}>{level}</option>)}
          </select>
        </label>
        <label>
          <span className="form-label">Regional Format</span>
          <select value={letter.region || "gcc"} onChange={(event) => onChange("region", event.target.value)} className="form-field">
            {regionalFormats.map((region) => <option value={region.id} key={region.id}>{region.name}</option>)}
          </select>
        </label>
      </div>
      <button onClick={onRegenerate} type="button" className="w-full rounded bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">
        Generate ATS-friendly letter
      </button>
      {fields.map(([key, label, type]) => (
        <div key={key} className="block">
          <label>
            <span className="form-label">{label}</span>
            {type === "textarea" ? (
              <textarea value={coverLetterParagraphFields.has(key) ? sanitizeCvTextForCoverLetter(letter[key]) : letter[key] || ""} onChange={(event) => onChange(key, event.target.value)} rows={key === "body" ? 6 : 4} className="form-field resize-y" />
            ) : (
              <input value={letter[key] || ""} onChange={(event) => onChange(key, event.target.value)} className="form-field" />
            )}
          </label>
          {type === "textarea" && coverLetterAiFields.has(key) && (
            <div className="mt-2">
              <div className="ai-assist-row">
                <button type="button" onClick={() => reviewWithAi(key, label)} className="btn-ai btn-ai-work">
                  <Icon name="sparkle" className="h-3 w-3" /> AI Assistant
                </button>
                <span className="ai-hint">Check grammar, spelling, and rephrase this more professionally</span>
              </div>
              {aiSuggestions[key] && (
                <div className="ai-suggestion-card mt-3">
                  <div className="ai-suggestion-header">
                    <span><Icon name="sparkle" className="h-4 w-4" /> AI suggested rewrite</span>
                    <span>Approve or reject before it changes your cover letter</span>
                  </div>
                  <div className="ai-suggestion-grid">
                    <div>
                      <p className="ai-suggestion-label">Original text</p>
                      <pre>{aiSuggestions[key].original}</pre>
                    </div>
                    <div>
                      <p className="ai-suggestion-label">Suggested text</p>
                      <pre>{aiSuggestions[key].suggested}</pre>
                    </div>
                  </div>
                  <div className="ai-suggestion-actions">
                    <button type="button" onClick={() => approveSuggestion(key)} className="ai-approve-button">Approve and use this</button>
                    <button type="button" onClick={() => rejectSuggestion(key)} className="ai-reject-button">Reject</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {aiStatus && <p className="text-sm font-bold text-blue-700">{aiStatus}</p>}
    </div>
  );
}

function FontSelector({ selected, onSelect }) {
  return (
    <section>
      <h3 className="panel-title">Font style</h3>
      <div className="mt-3 grid gap-2">
        {coverLetterFonts.map((font) => (
          <button key={font.id} onClick={() => onSelect(font.id)} className={`rounded border px-4 py-3 text-left text-sm font-bold ${selected === font.id ? "border-green-600 bg-green-50 text-green-800" : "border-slate-200 bg-white text-slate-700"}`}>
            {font.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function CoverLetterLayoutSelector({ selected, onSelect }) {
  return (
    <section>
      <h3 className="panel-title">Letter layout</h3>
      <div className="mt-3 grid gap-2">
        {coverLetterLayouts.map((layout) => (
          <button key={layout.id} onClick={() => onSelect(layout.id)} className={`rounded border px-4 py-3 text-left text-sm font-bold ${selected === layout.id ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700"}`}>
            {layout.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function CoverLetterPreview({ cv, letter, theme, fontId, layoutId }) {
  const font = coverLetterFonts.find((item) => item.id === fontId) || coverLetterFonts[0];
  const compact = layoutId === "compact";
  const cleanLetter = sanitizeCoverLetterParagraphs(letter);
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return (
    <article className={`letter-paper ${font.className} ${compact ? "p-7" : "p-10"}`}>
      <header className={layoutId === "accent" ? "rounded p-5 text-white" : "border-b border-slate-200 pb-5"} style={layoutId === "accent" ? { background: theme.dark } : {}}>
        <h2 className="text-2xl font-black leading-tight">{cv.fullName}</h2>
        <p className={`mt-2 text-sm font-bold ${layoutId === "accent" ? "text-white/90" : "text-slate-600"}`}>{letter.position}</p>
        <p className={`mt-2 text-xs ${layoutId === "accent" ? "text-white/80" : "text-slate-500"}`}>{cv.email} | {cv.phone} | {cv.country}</p>
        {(letter.linkedIn || letter.nationality || letter.visaStatus) && (
          <p className={`mt-2 text-xs ${layoutId === "accent" ? "text-white/80" : "text-slate-500"}`}>
            {[letter.linkedIn, letter.nationality && `Nationality: ${letter.nationality}`, letter.visaStatus && `Visa: ${letter.visaStatus}`].filter(Boolean).join(" | ")}
          </p>
        )}
      </header>
      <div className={`${compact ? "mt-6 space-y-4 text-[13px]" : "mt-8 space-y-5 text-sm"} leading-7 text-slate-700`}>
        <p className="text-slate-600">{today}</p>
        <div className="text-slate-600">
          <p>{letter.companyName}</p>
          <p>{letter.companyAddress}</p>
        </div>
        <p>Dear {letter.hiringManager || "Hiring Manager"},</p>
        <p className="whitespace-pre-line">{cleanLetter.opening}</p>
        <p className="whitespace-pre-line">{cleanLetter.body}</p>
        {cleanLetter.qualifications && <p className="whitespace-pre-line">{cleanLetter.qualifications}</p>}
        {cleanLetter.value && <p className="whitespace-pre-line">{cleanLetter.value}</p>}
        <p className="whitespace-pre-line">{cleanLetter.closing}</p>
        <div>
          <p>Sincerely,</p>
          <p className="mt-2 font-black text-slate-950" style={{ color: theme.dark }}>{cv.fullName}</p>
        </div>
      </div>
    </article>
  );
}

function CoverLetterDownloadModal({ cv, onClose, onVerifiedDownload }) {
  return (
    <DownloadModal
      cv={cv}
      onClose={onClose}
      onVerifiedDownload={onVerifiedDownload}
      title="Verify to download cover letter"
      description="Enter your contact details to unlock your free cover letter download. This uses the same mock OTP flow as the CV."
      label="Cover letter downloads"
    />
  );
}

function SwitchTemplateModal({ templateName, onKeepData, onLoadSample, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Switch Template?</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{templateName ? `Switch to ${templateName}.` : "Choose how to switch templates."}</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl text-slate-500" aria-label="Close template switch dialog">x</button>
        </div>
        <div className="mt-5 rounded border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-950">
          <p>Your current CV information will be kept.</p>
          <p className="mt-2">Only the design and suggested content will change.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onKeepData} className="rounded bg-green-600 px-5 py-3 text-sm font-black text-white hover:bg-green-700">
            Keep My Data
          </button>
          <button type="button" onClick={onLoadSample} className="rounded border border-blue-200 bg-white px-5 py-3 text-sm font-black text-blue-700 hover:bg-blue-50">
            Load Template Sample Data
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableSectionRow({ id, hidden, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition: transition || "transform 200ms ease" };
  return (
    <li ref={setNodeRef} style={style} className={`section-reorder-row ${hidden ? "hidden-section" : ""}`}>
      <button type="button" className="section-drag-handle" aria-label={`Drag ${sectionLabels[id]}`} {...attributes} {...listeners}>::</button>
      <span className="section-reorder-icon">{id.slice(0, 1).toUpperCase()}</span>
      <span className="section-reorder-name">{sectionLabels[id]}</span>
      <button type="button" className="section-eye-toggle" onClick={() => onToggle(id)}>{hidden ? "Show" : "Hide"}</button>
    </li>
  );
}

function SectionReorderPanel({ cv, onChange, onClose }) {
  const order = normalizeSectionOrder(cv);
  const hidden = Array.isArray(cv.hiddenSections) ? cv.hiddenSections : [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const updateCvOrder = (nextOrder, nextHidden = hidden) => {
    localStorage.setItem("bmcv_section_order", JSON.stringify(nextOrder));
    localStorage.setItem("bmcv_hidden_sections", JSON.stringify(nextHidden));
    onChange("sectionOrder", nextOrder);
    onChange("hiddenSections", nextHidden);
  };
  const toggleHidden = (id) => {
    const nextHidden = hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];
    updateCvOrder(order, nextHidden);
  };
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    updateCvOrder(arrayMove(order, oldIndex, newIndex));
  };
  return (
    <div className="section-reorder-backdrop" onClick={onClose}>
      <aside className="section-reorder-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-reorder-grip" />
        <div className="section-reorder-head">
          <div>
            <h2>Reorder CV sections</h2>
            <p>Drag sections or hide items from your CV preview and PDF.</p>
          </div>
          <button type="button" className="section-reorder-close" onClick={onClose}>Close</button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="section-reorder-list">
              {order.map((id) => (
                <SortableSectionRow key={id} id={id} hidden={hidden.includes(id)} onToggle={toggleHidden} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </aside>
    </div>
  );
}

const builderSteps = [
  { id: "personal", label: "Personal details", icon: "user" },
  { id: "experience", label: "Work history", icon: "briefcase" },
  { id: "education", label: "Education", icon: "graduation" },
  { id: "skills", label: "Skills & languages", icon: "sparkle" },
  { id: "summary", label: "Summary", icon: "file" },
  { id: "extras", label: "References & extras", icon: "folder" },
];

const workspaceModes = [
  { id: "content", label: "Content Builder", short: "Content" },
  { id: "design", label: "Choose Design", short: "Design" },
  { id: "ai", label: "AI Optimizer", short: "AI" },
];

function WorkspaceTabs({ mode, onChange }) {
  return <nav className="workspace-tabs" role="tablist" aria-label="Builder workspace">
    {workspaceModes.map((item, index) => <button key={item.id} id={`workspace-tab-${item.id}`} type="button" role="tab" aria-selected={mode === item.id} aria-controls={`workspace-panel-${item.id}`} tabIndex={mode === item.id ? 0 : -1} onClick={() => onChange(item.id)} onKeyDown={(event) => {
      const next = event.key === "ArrowRight" ? (index + 1) % workspaceModes.length : event.key === "ArrowLeft" ? (index + workspaceModes.length - 1) % workspaceModes.length : event.key === "Home" ? 0 : event.key === "End" ? workspaceModes.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); onChange(workspaceModes[next].id);
      document.getElementById(`workspace-tab-${workspaceModes[next].id}`)?.focus();
    }}><span className="workspace-tab-number">{index + 1}</span><span className="workspace-tab-label">{item.label}</span><span className="workspace-tab-short">{item.short}</span></button>)}
  </nav>;
}

const cvBuildGuideSteps = [
  { step: "Step 1", title: "Choose a template" },
  { step: "Step 2", title: "Upload your existing CV", note: "Optional" },
  { step: "Step 3", title: "Fill in your personal information" },
  { step: "Step 4", title: "Add work experience and education" },
  { step: "Step 5", title: "Review your CV strength score" },
  { step: "Step 6", title: "Download your CV as PDF" },
];

function getBuilderStepState(cv) {
  return {
    personal: Boolean(cv.fullName && cv.email && cv.phone && cv.country),
    experience: normalizeWorkExperiences(cv).some((entry) => entry.employer && entry.responsibilities),
    education: Boolean(cv.education),
    skills: Boolean(cv.skills && cv.languages),
    summary: Boolean(cv.summary && cv.summary.length > 40),
  };
}

function BuilderTopBar({ onHome, onDownload, saveStatus, cloudSavingEnabled, userEmail, onAccess, onSignOut, workspaceMode, onWorkspaceMode, onTranslate, activeBuilder, onSwitchBuilder }) {
  const { mode, setMode, cycleMode } = useTheme("dark");
  const isSaving = /saving/i.test(saveStatus);
  return (
    <header className="builder-topbar">
      <button type="button" onClick={onHome} className="builder-logo" aria-label="BuildMyCVNow home"><BrandLogo /></button>
      {workspaceMode ? <WorkspaceTabs mode={workspaceMode} onChange={onWorkspaceMode} /> : <nav className="builder-type-switch" aria-label="Builder type">
        {[["cv", "CV Builder"], ["cover", "Cover Letter Builder"]].map(([id, label]) => <button key={id} type="button" aria-pressed={activeBuilder === id} onClick={() => onSwitchBuilder(id)}>{label}</button>)}
      </nav>}
      <div className="builder-topbar-actions">
        {workspaceMode && <button type="button" className="workspace-translate" onClick={onTranslate} title="Upload or translate your CV"><Icon name="globe" className="h-4 w-4" /><span>Translate CV</span></button>}
        {workspaceMode && <details className="workspace-account-menu"><summary aria-label="Account options" title="Account options"><Icon name="user" className="h-4 w-4" /></summary><div><p>{cloudSavingEnabled ? userEmail : "Save your CV online"}</p><button type="button" onClick={(event) => { event.currentTarget.closest("details").open = false; if (cloudSavingEnabled) onSignOut(); else onAccess(); }}>{cloudSavingEnabled ? "Sign out" : "Sign in to save online"}</button></div></details>}
        {cloudSavingEnabled ? (
          <div className="builder-account-pill signed-in">
            <span className="builder-account-pill-label">Saved online</span>
            <strong>{userEmail}</strong>
            <button type="button" onClick={onSignOut}>Logout</button>
          </div>
        ) : (
          <button type="button" onClick={onAccess} className="builder-account-pill">
            <span className="builder-account-pill-label">Save online</span>
            <strong>It's free</strong>
          </button>
        )}
        <ThemeToggle mode={mode} setMode={setMode} cycleMode={cycleMode} />
        <span className={isSaving ? "builder-save-badge saving" : "builder-save-badge saved"}>
          <Icon name={isSaving ? "sparkle" : "check"} className="h-3 w-3" />
          {isSaving ? "Saving..." : "Saved"}
        </span>
        <button onClick={onDownload} className="builder-download-button">
          <Icon name="download" className="h-4 w-4" /> Download Free PDF
        </button>
      </div>
    </header>
  );
}

function BuilderHeaderGuide({ cloudSavingEnabled, noCloudMode }) {
  const saveReminder = cloudSavingEnabled
    ? "Signed in: use Save in My CVs before refreshing if you want an online copy of this CV version."
    : noCloudMode
      ? "Download-only mode: your CV is not saved online. Download your file before refreshing or closing the browser."
      : "Save online by signing in, or download your CV before refreshing. Unsaved browser data may return to the default ready-to-fill form.";

  return (
    <section className="builder-guide-strip" aria-label="How to build your CV">
      <div className="builder-guide-inner">
        <div className="builder-guide-head">
          <div>
            <h2>How to Build Your CV</h2>
            <p>Choose a template, fill your details, review, then download.</p>
          </div>
          <span>Free CV download with email OTP</span>
        </div>
        <div className="builder-guide-steps">
          {cvBuildGuideSteps.map((item) => (
            <article key={item.step}>
              <p>{item.step}</p>
              <h3>{item.title}</h3>
              {item.note && <small>{item.note}</small>}
            </article>
          ))}
        </div>
        <div className="builder-guide-reminders">
          <p className="builder-guide-tip">
            Tip: You can switch templates at any time without losing your data.
          </p>
          <p className="builder-guide-warning">
            Important: {saveReminder}
          </p>
        </div>
      </div>
    </section>
  );
}

function BuilderStageTabs({ currentStep, completedSteps, onStep }) {
  const tabs = [
    { id: "personal", label: "Personal" },
    { id: "experience", label: "Experience" },
    { id: "education", label: "Education" },
    { id: "skills", label: "Skills" },
    { id: "summary", label: "Extras" },
  ];

  return (
    <nav className="builder-stage-tabs" aria-label="CV builder stages">
      {tabs.map((tab, index) => {
        const active = currentStep === tab.id;
        const done = completedSteps[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onStep(tab.id)}
            aria-current={active ? "step" : undefined}
            className={`builder-stage-tab ${active ? "active" : ""} ${done ? "done" : ""}`}
          >
            <span>{done ? <Icon name="check" className="h-3.5 w-3.5" /> : index + 1}</span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function CompletionBar({ completion, onNextStep, onDownload }) {
  const color = completion.percent >= 80 ? "#16a34a" : completion.percent >= 40 ? "var(--accent)" : "#d97706";
  return (
    <section className="completion-bar" aria-label="CV completion">
      <div className="completion-label">
        <strong>Your CV is {completion.percent}% complete</strong>
        <button type="button" onClick={() => onNextStep(completion.nextSection)}>
          Next: {completion.nextStep}
        </button>
      </div>
      <div className="completion-track">
        <div className="completion-fill" style={{ width: `${completion.percent}%`, background: color }} />
      </div>
      <button type="button" className="builder-bottom-download" onClick={onDownload}><Icon name="download" className="h-4 w-4" /> Download Free PDF</button>
    </section>
  );
}

function ShareTool({ moment = "download" }) {
  const [copied, setCopied] = useState(false);
  const shareText = "I made my CV free with this - no sign-up, ATS-friendly, built for job seekers worldwide:";
  const urls = {
    native: "https://buildmycvnow.com?utm_source=share&utm_medium=native",
    whatsapp: "https://buildmycvnow.com?utm_source=whatsapp&utm_medium=share",
    facebook: "https://buildmycvnow.com?utm_source=facebook&utm_medium=share",
    copylink: "https://buildmycvnow.com?utm_source=copylink&utm_medium=share",
  };
  const shareNative = async () => {
    logEvent("share_clicked", { channel: "native", moment });
    if (navigator.share) {
      await navigator.share({ title: "Free Global CV Builder", text: shareText, url: urls.native });
    } else {
      await navigator.clipboard.writeText(`${shareText} ${urls.copylink}`);
      setCopied(true);
    }
  };
  const copy = async () => {
    logEvent("share_clicked", { channel: "copylink", moment });
    await navigator.clipboard.writeText(`${shareText} ${urls.copylink}`);
    setCopied(true);
  };
  return (
    <section className="share-tool-card">
      <h3>Know someone job hunting?</h3>
      <p>Share this free CV builder for local, remote, and international jobs.</p>
      <div className="share-tool-actions">
        <button type="button" onClick={shareNative}>Share</button>
        <a onClick={() => logEvent("share_clicked", { channel: "whatsapp", moment })} href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${urls.whatsapp}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <a onClick={() => logEvent("share_clicked", { channel: "facebook", moment })} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urls.facebook)}`} target="_blank" rel="noreferrer">Facebook</a>
        <button type="button" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
      </div>
    </section>
  );
}

function EmailCapture({ source = "download", roleInterest = "" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/.netlify/functions/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source, roleInterest, website: form.get("website") }),
    });
    if (!response.ok) {
      setStatus("Please check your email and try again.");
      return;
    }
    const data = await response.json();
    logEvent("email_subscribed", { source });
    setStatus("You are subscribed. Download the checklist below.");
    if (data.downloadUrl) window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <form onSubmit={submit} className="email-capture-card">
      <h3>Want the free Job Hunt Checklist?</h3>
      <p>We will email it to you, plus occasional CV tips. No spam.</p>
      <input className="hidden" name="website" tabIndex="-1" autoComplete="off" />
      <div className="email-capture-row">
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@email.com" />
        <button>Send me the checklist</button>
      </div>
      {status && <p className="email-capture-status">{status}</p>}
    </form>
  );
}

function BuilderSidebar({ currentStep, onStep, completedSteps, completion, workspaceMode, onWorkspaceMode, onCoverLetter, onAccess, cloudSavingEnabled, userEmail }) {
  return <aside className="builder-sidebar-v2 workspace-sidebar" aria-label="Builder navigation">
    <div className="workspace-documents" aria-label="Document type">
      <button type="button" className="active" aria-pressed="true" title="CV Builder"><Icon name="file" className="h-4 w-4" /><span>CV Builder</span></button>
      <button type="button" onClick={onCoverLetter} title="Cover Letter Builder"><Icon name="file" className="h-4 w-4" /><span>Cover letter</span></button>
    </div>
    <p className="workspace-sidebar-caption">CV sections</p>
    <nav className="workspace-sections" aria-label="CV sections">
      {builderSteps.map((step) => <button key={step.id} type="button" onClick={() => onStep(step.id)} aria-current={workspaceMode === "content" && currentStep === step.id ? "step" : undefined} title={step.label}>
        <Icon name={step.icon} className="h-4 w-4" /><span>{step.label}</span>{completedSteps[step.id] && <Icon name="check" className="workspace-section-done h-3 w-3" />}
      </button>)}
    </nav>
    <div className="workspace-sidebar-tools">
      <button type="button" onClick={() => onStep("import")} aria-current={workspaceMode === "content" && currentStep === "import" ? "step" : undefined} title="Upload & Translate CV"><Icon name="upload" className="h-4 w-4" /><span>Upload & translate</span></button>
      <button type="button" onClick={() => onWorkspaceMode("design")} title="Choose template and layout"><Icon name="file" className="h-4 w-4" /><span>Templates & layout</span></button>
    </div>
    <div className="workspace-sidebar-bottom">
      <section className="workspace-progress" aria-label="CV completion">
        <div><span>CV completeness</span><strong>{completion.percent}%</strong></div>
        <progress max="100" value={completion.percent}>{completion.percent}%</progress>
        <p>{completion.nextStep}</p>
      </section>
      {cloudSavingEnabled ? <div className="workspace-account"><Icon name="check" className="h-4 w-4" /><span title={userEmail}>{userEmail}</span></div> : <button className="workspace-account" type="button" onClick={onAccess} title="Sign in to save online"><Icon name="user" className="h-4 w-4" /><span>Save online</span><Icon name="arrow" className="h-4 w-4" /></button>}
    </div>
  </aside>;
}

function BuilderTemplateDock({ categoryId, onCategory, themeId, onTheme }) {
  return (
    <section className="builder-template-dock" aria-label="Template and colour">
      <div className="builder-template-head">
        <div>
          <p>Choose a template</p>
          <h2>Pick the design that matches your job.</h2>
        </div>
        <span>Design only. Your data stays safe.</span>
      </div>
      <CategorySelector selected={categoryId} onSelect={onCategory} />
      <div className="builder-color-strip" aria-label="Accent colour">
        <span>Accent colour</span>
        <div>
          {themes.slice(0, 8).map((theme) => (
            <button
              key={theme.id}
              type="button"
              title={theme.name}
              aria-label={`Set accent to ${theme.name}`}
              onClick={() => onTheme(theme.id)}
              className={themeId === theme.id ? "selected" : ""}
              style={{ background: theme.color }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function BuilderPreviewPanel({ cv, theme, layout, onDownload }) {
  const [message, setMessage] = useState("");
  const [previewZoom, setPreviewZoom] = useState(null);
  const [fitZoom, setFitZoom] = useState(56);
  const sheetRef = useRef(null);
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return undefined;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(sheet);
      const available = sheet.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setFitZoom(Math.max(20, Math.min(100, Math.floor(available / 794 * 100))));
    });
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);
  const completeness = getCompleteness(cv);
  const shareUrl = "https://buildmycvnow.com/builder";
  const changeZoom = (delta) => setPreviewZoom((value) => Math.min(120, Math.max(20, (value ?? fitZoom) + delta)));
  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Share link copied.");
    } catch {
      setMessage("Share link ready: buildmycvnow.com/builder");
    }
  };
  return (
    <aside className="builder-preview-panel-v2">
      <div className="preview-topbar-v2">
        <span className="preview-live-label"><span className="live-dot" /> Live preview</span>
        <div className="preview-actions-v2">
          <button type="button" onClick={copyShare} className="preview-action-button"><Icon name="share" className="h-3.5 w-3.5" /> Share</button>
        </div>
      </div>
      <div className="preview-strength">
        <div className="preview-strength-label">
          <span>CV strength</span>
          <span style={{ color: theme.color }}>{completeness.score}%</span>
        </div>
        <div className="preview-strength-track">
          <div className="preview-strength-fill" style={{ width: `${completeness.score}%`, background: theme.color }} />
        </div>
        <div className="preview-zoom-row" aria-label="Preview zoom controls">
          <span>A4 preview</span>
          <div className="preview-zoom-controls">
            <button type="button" onClick={() => changeZoom(-6)} aria-label="Zoom out">-</button>
            <strong>{previewZoom ?? fitZoom}%</strong>
            <button type="button" onClick={() => changeZoom(6)} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => setPreviewZoom(null)}>Fit</button>
          </div>
        </div>
        {message && <p className="mt-2 text-xs font-bold text-blue-700">{message}</p>}
      </div>
      <div ref={sheetRef} className="preview-sheet-scroll" style={{ "--preview-zoom": (previewZoom ?? fitZoom) / 100 }}>
        <LiveCVPreview cv={cv} theme={theme} layout={layout} />
        <button type="button" onClick={onDownload} className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700">
          <Icon name="download" className="h-4 w-4" /> Download Free PDF
        </button>
      </div>
    </aside>
  );
}

function CoverLetterBuilder({
  cv,
  letter,
  onCvChange,
  onRoleChange,
  onLetterChange,
  onRegenerate,
  themeId,
  onThemeChange,
  fontId,
  onFontChange,
  layoutId,
  onLayoutChange,
  onDownload,
  downloaded,
}) {
  const theme = themes.find((item) => item.id === themeId) || themes[1];
  const [mode, setMode] = useState("light");
  const [copyStatus, setCopyStatus] = useState("Copy to clipboard");
  const [savedTemplates, setSavedTemplates] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cvforall:cover-letter-templates") || "[]");
    } catch {
      return [];
    }
  });
  const copyLetter = async () => {
    await navigator.clipboard.writeText(coverLetterToText(letter, cv));
    setCopyStatus("Copied");
    window.setTimeout(() => setCopyStatus("Copy to clipboard"), 1800);
  };
  const saveTemplate = () => {
    const nextTemplates = [
      { id: Date.now(), name: `${letter.position || "Cover Letter"} - ${letter.companyName || "Company"}`, letter },
      ...savedTemplates,
    ].slice(0, 8);
    setSavedTemplates(nextTemplates);
    localStorage.setItem("cvforall:cover-letter-templates", JSON.stringify(nextTemplates));
  };
  return (
    <div className={`builder-shell mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 lg:grid-cols-[0.9fr_1.1fr_0.65fr] ${mode === "dark" ? "text-white" : ""}`}>
      <aside className="builder-panel min-w-0 space-y-5 rounded bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="rounded border border-green-200 bg-green-50 p-4">
          <h2 className="font-black text-green-900">Create Cover Letter</h2>
          <p className="mt-2 text-sm leading-6 text-green-900">
            This letter matches your selected CV category and uses your CV details. You can edit every paragraph before downloading for free.
          </p>
        </div>
        <CoverLetterTemplateSelector selectedRole={letter.position} onSelect={onRoleChange} />
        <CoverLetterApplicantForm cv={cv} letter={letter} onCvChange={onCvChange} onLetterChange={onLetterChange} />
        <CoverLetterForm letter={letter} onChange={onLetterChange} onRegenerate={onRegenerate} />
      </aside>
      <section className="builder-panel min-w-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black text-slate-950">Live cover letter preview</h2>
          <span className="flex items-center gap-2 text-sm font-bold text-slate-500"><Icon name="eye" className="h-4 w-4" /> Updates instantly</span>
        </div>
        <div className={mode === "dark" ? "rounded bg-slate-950 p-4" : ""}>
          <CoverLetterPreview cv={cv} letter={letter} theme={theme} fontId={fontId} layoutId={layoutId} />
        </div>
        <section className="mt-5 rounded bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="panel-title">Sample generated letters</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {sampleCoverLetters.slice(0, 13).map((sample) => (
              <button
                key={sample.role}
                onClick={() => onRoleChange(sample.role)}
                className="rounded border border-slate-200 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:border-green-500 hover:bg-green-50"
              >
                {sample.role}
              </button>
            ))}
          </div>
        </section>
      </section>
      <aside className="builder-panel min-w-0 space-y-6 rounded bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <section>
          <h3 className="panel-title">Display mode</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["light", "dark"].map((item) => (
              <button key={item} onClick={() => setMode(item)} className={`rounded px-4 py-3 text-sm font-black capitalize ${mode === item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>
                {item}
              </button>
            ))}
          </div>
        </section>
        <ThemeSelector selected={themeId} onSelect={onThemeChange} />
        <FontSelector selected={fontId} onSelect={onFontChange} />
        <CoverLetterLayoutSelector selected={layoutId} onSelect={onLayoutChange} />
        <button onClick={onDownload} className="flex w-full items-center justify-center gap-2 rounded bg-green-600 px-5 py-4 font-bold text-white hover:bg-green-700">
          <Icon name="download" /> Download Cover Letter
        </button>
        <button onClick={copyLetter} className="flex w-full items-center justify-center gap-2 rounded border border-slate-300 px-5 py-4 font-bold text-slate-700 hover:bg-slate-50">
          <Icon name="file" /> {copyStatus}
        </button>
        <button onClick={saveTemplate} className="flex w-full items-center justify-center gap-2 rounded border border-blue-600 px-5 py-4 font-bold text-blue-700 hover:bg-blue-50">
          <Icon name="check" /> Save template
        </button>
        {savedTemplates.length > 0 && (
          <section>
            <h3 className="panel-title">Saved templates</h3>
            <div className="mt-3 space-y-2">
              {savedTemplates.slice(0, 4).map((item) => (
                <button key={item.id} onClick={() => Object.entries(item.letter).forEach(([key, value]) => onLetterChange(key, value))} className="w-full rounded border border-slate-200 px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50">
                  {item.name}
                </button>
              ))}
            </div>
          </section>
        )}
        {BUILDER_ADS_ENABLED && <AdBanner compact label="Google AdSense cover letter builder ad" slot="6666666666" />}
        {downloaded && (
          <div className="rounded border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-900">Cover letter download confirmed. You can also download your CV for free.</div>
        )}
      </aside>
    </div>
  );
}

function CVBuilderApp({ onHome }) {
  const [entryOptions] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return {
      category: categories.find((item) => item.id === query.get("category")),
      theme: themes.find((item) => item.id === query.get("theme")),
      layout: layouts.find((item) => item.id === query.get("layout")),
      upload: query.get("start") === "upload",
      saveOnline: query.get("access") === "save",
    };
  });
  const [activeBuilder, setActiveBuilder] = useState(() => (window.location.hash === "#cover-letter" ? "cover" : "cv"));
  const [categoryId, setCategoryId] = useState(entryOptions.category?.id || defaultCategory.id);
  const [cv, setCv] = useState(() => {
    const category = entryOptions.category;
    return {
      ...initialCv,
      ...(category ? { jobTitle: category.title, summary: category.summary, skills: category.skills, experience: category.experience, workExperiences: [createExperienceEntry(category)] } : {}),
      ...(entryOptions.upload ? { onboardingCompleted: true, builderStartOption: "Upload existing CV" } : {}),
    };
  });
  const [currentCvId, setCurrentCvId] = useState(null);
  const [coverLetter, setCoverLetter] = useState(() => createCoverLetterFromCv(cv, categoryId));
  const [themeId, setThemeId] = useState(entryOptions.theme?.id || "blue");
  const [layoutId, setLayoutId] = useState(entryOptions.layout?.id || "sidebar");
  const [coverThemeId, setCoverThemeId] = useState("blue");
  const [coverFontId, setCoverFontId] = useState("sans");
  const [coverLayoutId, setCoverLayoutId] = useState("classic");
  const [downloadTarget, setDownloadTarget] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const [coverDownloaded, setCoverDownloaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Auto-save ready");
  const [draftStatus, setDraftStatus] = useState("Cloud draft sync is ready.");
  const [mobileCvView, setMobileCvView] = useState("edit");
  const [currentStep, setCurrentStep] = useState(entryOptions.upload ? "import" : "personal");
  const [workspaceMode, setWorkspaceMode] = useState("content");
  const appliedImportIdsRef = useRef(new Set());
  const photoUploadRevision = useRef(0);
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(entryOptions.saveOnline);
  const [pendingTemplateId, setPendingTemplateId] = useState(null);
  const [sectionReorderOpen, setSectionReorderOpen] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(() => sessionStorage.getItem("bmcv_share_prompt_seen") !== "1");
  const [userMode, setUserMode] = useState(() => localStorage.getItem("cvforall:user-mode") || "guest");
  const theme = useMemo(() => themes.find((item) => item.id === themeId), [themeId]);
  const coverTheme = useMemo(() => themes.find((item) => item.id === coverThemeId), [coverThemeId]);
  const completion = useMemo(() => computeCompletion({ ...cv, categoryId }), [cv, categoryId]);
  const previousCompletionRef = useRef(completion.percent);
  const cvEventSessionIdRef = useRef(getCvEventSessionId());
  const trackedSectionRef = useRef({});
  const user = session?.user || null;
  const cloudSavingEnabled = Boolean(user && userMode === "registered");
  const noCloudMode = userMode === "urgent-local";
  const builderMotionRoot = useBuilderMotion(currentStep, activeBuilder === "cv");
  const completedSteps = useMemo(() => getBuilderStepState(cv), [cv]);
  const recordCvEvent = (eventName, metadata = {}) => {
    trackEvent(eventName, metadata);
    trackCvEvent({
      eventName,
      userId: user?.id || null,
      cvId: currentCvId,
      sessionId: cvEventSessionIdRef.current,
      metadata: {
        template_id: categoryId,
        target_country: cv.targetCountry || "",
        target_job_title: cv.targetJobTitle || "",
        source_page: activeBuilder === "cover" ? "cover-letter-builder" : "cv-builder",
        ...metadata,
      },
    });
  };
  const jumpToStep = (id) => {
    const step = id === "references" || id === "qr" ? "extras" : id;
    if (step !== "import" && !builderSteps.some(item => item.id === step)) return;
    setWorkspaceMode("content");
    setCurrentStep(step);
    setMobileCvView("edit");
    requestAnimationFrame(() => {
      document.getElementById("builder-editor-heading")?.focus({ preventScroll: true });
      document.querySelector(".builder-form-panel-v2")?.scrollTo({ top: 0, behavior: "auto" });
    });
  };
  useEffect(() => {
    document.querySelector(".builder-workspace .builder-form-panel-v2")?.scrollTo({ top: 0 });
  }, [workspaceMode, currentStep]);
  const requestCvDownload = () => {
    if (completion.percent < 40) {
      logEvent("export_below_threshold", { percent: completion.percent });
      if (!window.confirm(`Your CV is only ${completion.percent}% complete. Recruiters may reject incomplete CVs. Export anyway?`)) return;
    }
    recordCvEvent("download_clicked", { completion_percent: completion.percent });
    setDownloadTarget("cv");
  };
  const handleNextStep = (section) => {
    logEvent("nextstep_clicked", { step: section });
    if (section === "download") requestCvDownload();
    else jumpToStep(section);
  };
  useEffect(() => {
    const previous = previousCompletionRef.current;
    previousCompletionRef.current = completion.percent;
    if (completion.percent <= previous) return;
    const fired = JSON.parse(localStorage.getItem("bmcv_milestones") || "[]");
    const fire = async (percent, message) => {
      if (fired.includes(percent)) return;
      localStorage.setItem("bmcv_milestones", JSON.stringify([...fired, percent]));
      logEvent("completion_milestone", { percent });
      setCompletionMessage(message);
      window.setTimeout(() => setCompletionMessage(""), 4500);
      if (percent === 100) {
        setCompletionModalOpen(true);
        const confetti = await import("canvas-confetti");
        (confetti.default || confetti)({ particleCount: 90, spread: 70, origin: { y: 0.25 } });
      }
    };
    if (previous < 50 && completion.percent >= 50) fire(50, "Halfway there. Your CV is taking shape.");
    if (previous < 80 && completion.percent >= 80) fire(80, "Almost done. Recruiters will see this soon.");
    if (previous < 100 && completion.percent >= 100) fire(100, "Your CV is complete.");
  }, [completion.percent]);
  useEffect(() => {
    if (theme?.color) document.documentElement.style.setProperty("--cv-accent", theme.color);
  }, [theme?.color]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get("role");
    const city = params.get("city");
    logEvent("builder_opened", {
      source: params.get("utm_source") || "direct",
      role: role || "",
      city: city || "",
    });
    if (!role) return;
    const seoJob = seoJobs.find((item) => item.slug === role);
    if (!seoJob) return;
    const matchingCategory = categories.find((item) => item.id === seoJob.industry);
    setCv((current) => ({
      ...current,
      jobTitle: current.jobTitle && current.jobTitle !== initialCv.jobTitle ? current.jobTitle : seoJob.title,
    }));
    if (matchingCategory) setCategoryId(matchingCategory.id);
    logEvent("seo_page_to_builder", { role, city: city || "" });
  }, []);
  useEffect(() => {
    recordCvEvent("builder_started", { start_option: cv.builderStartOption || "scratch" });
    if (!sessionStorage.getItem("bmcv_draft_created")) {
      sessionStorage.setItem("bmcv_draft_created", "1");
      recordCvEvent("cv_draft_created", { mode: cloudSavingEnabled ? "registered" : "local" });
    }
  }, []);
  useEffect(() => {
    initAnalytics();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const sectionEvents = {
      personal: "personal_info_completed",
      experience: "work_experience_added",
      education: "education_added",
      skills: "skills_added",
      summary: "preview_viewed",
    };
    Object.entries(completedSteps).forEach(([section, done]) => {
      const eventName = sectionEvents[section];
      if (!done || !eventName || trackedSectionRef.current[eventName]) return;
      trackedSectionRef.current[eventName] = true;
      recordCvEvent(eventName, { section });
    });
  }, [completedSteps.personal, completedSteps.experience, completedSteps.education, completedSteps.skills, completedSteps.summary]);
  useEffect(() => {
    try {
      const savedOrder = JSON.parse(localStorage.getItem("bmcv_section_order") || "null");
      const savedHidden = JSON.parse(localStorage.getItem("bmcv_hidden_sections") || "null");
      const savedTips = localStorage.getItem("bmcv_tips_enabled");
      if (Array.isArray(savedOrder) || Array.isArray(savedHidden)) {
        setCv((current) => ({
          ...current,
          sectionOrder: Array.isArray(savedOrder) ? normalizeSectionOrder({ sectionOrder: savedOrder }) : current.sectionOrder,
          hiddenSections: Array.isArray(savedHidden) ? savedHidden.filter((id) => defaultSectionOrder.includes(id)) : current.hiddenSections,
          tipsEnabled: savedTips === null ? current.tipsEnabled : savedTips === "true",
        }));
      } else if (savedTips !== null) {
        setCv((current) => ({ ...current, tipsEnabled: savedTips === "true" }));
      }
    } catch {
      localStorage.removeItem("bmcv_section_order");
      localStorage.removeItem("bmcv_hidden_sections");
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("cvforall:user-mode", userMode);
  }, [userMode]);
  useEffect(() => {
    if (!noCloudMode && user) {
      setUserMode("registered");
    }
  }, [user?.id, noCloudMode]);
  const applyDraftPayload = (draftData) => {
    if (!draftData?.cv) return false;
    setCv({ ...initialCv, ...draftData.cv });
    setCurrentCvId(draftData.currentCvId || null);
    setCoverLetter(draftData.coverLetter || createCoverLetterFromCv({ ...initialCv, ...draftData.cv }, draftData.categoryId || defaultCategory.id));
    setCategoryId(draftData.categoryId || defaultCategory.id);
    setThemeId(draftData.themeId || "blue");
    setLayoutId(draftData.layoutId || "sidebar");
    setCoverThemeId(draftData.coverThemeId || "blue");
    setCoverFontId(draftData.coverFontId || "sans");
    setCoverLayoutId(draftData.coverLayoutId || "classic");
    return true;
  };
  const draftPayload = () => createDraftPayload({ cv, coverLetter, categoryId, themeId, layoutId, coverThemeId, coverFontId, coverLayoutId, currentCvId });
  const saveCloudDraft = async (statusMessage = "Saving cloud draft...") => {
    if (!cloudSavingEnabled) {
      setDraftStatus("Sign in or create an account to save drafts online.");
      return;
    }
    try {
      setDraftStatus(statusMessage);
      await saveDraftForUser({ userId: user.id, draftData: draftPayload() });
      recordCvEvent("cv_draft_updated", { save_mode: "cloud" });
      setDraftStatus(`Cloud draft saved at ${new Date().toLocaleTimeString()}.`);
    } catch (error) {
      setDraftStatus(error.message || "Cloud draft could not be saved.");
    }
  };
  const restoreCloudDraft = async () => {
    if (!cloudSavingEnabled) {
      setDraftStatus("Sign in or create an account to restore cloud drafts.");
      return;
    }
    try {
      setDraftStatus("Loading latest cloud draft...");
      const draft = await loadLatestDraftForUser(user.id);
      if (!draft?.draft_data || !applyDraftPayload(draft.draft_data)) {
        setDraftStatus("No saved cloud draft found yet.");
        return;
      }
      setDraftStatus(`Restored cloud draft from ${new Date(draft.updated_at || draft.created_at).toLocaleString()}.`);
      trackEvent("restore_cloud_draft");
    } catch (error) {
      setDraftStatus(error.message || "Could not restore cloud draft.");
    }
  };
  useEffect(() => {
    if (!cloudSavingEnabled) return;
    let ignore = false;
    const restoreInitialDraft = async () => {
      try {
        const draft = await loadLatestDraftForUser(user.id);
        if (ignore || !draft?.draft_data) return;
        if (applyDraftPayload(draft.draft_data)) {
          setDraftStatus(`Latest cloud draft restored from ${new Date(draft.updated_at || draft.created_at).toLocaleString()}.`);
        }
      } catch (error) {
        if (!ignore) setDraftStatus(error.message || "Could not load cloud draft.");
      }
    };
    restoreInitialDraft();
    return () => {
      ignore = true;
    };
  }, [cloudSavingEnabled, user?.id]);
  useEffect(() => {
    if (!noCloudMode || downloaded || coverDownloaded) return;
    const warnBeforeLeave = (event) => {
      event.preventDefault();
      event.returnValue = "Your CV will not be saved online. Download your file before closing the browser.";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [noCloudMode, downloaded, coverDownloaded]);
  useEffect(() => {
    const saveDraft = async () => {
      const payload = draftPayload();
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      recordCvEvent("cv_draft_updated", { save_mode: cloudSavingEnabled ? "cloud-and-local" : "local" });
      setSaveStatus("Saved locally");
      if (cloudSavingEnabled) {
        try {
          await saveDraftForUser({ userId: user.id, draftData: payload });
          setDraftStatus(`Cloud draft auto-saved at ${new Date().toLocaleTimeString()}.`);
        } catch (error) {
          setDraftStatus(error.message || "Cloud draft auto-save failed.");
        }
      }
      window.setTimeout(() => setSaveStatus("Auto-save ready"), 2200);
    };
    const timer = window.setInterval(saveDraft, 30000);
    return () => window.clearInterval(timer);
  }, [cv, coverLetter, categoryId, themeId, layoutId, coverThemeId, coverFontId, coverLayoutId, cloudSavingEnabled, user?.id]);
  const keepCurrentDataForTemplate = (id) => {
    if (!id || id === categoryId) {
      setPendingTemplateId(null);
      return;
    }
    setCategoryId(id);
    setCoverLetter(createCoverLetterFromCv(cv, id));
    setPendingTemplateId(null);
    trackEvent("switch_template_keep_data");
    recordCvEvent("template_selected", { mode: "keep_data", template_id: id });
  };
  const loadTemplateSampleData = (id) => {
    const category = categories.find((item) => item.id === id);
    if (!category) {
      setPendingTemplateId(null);
      return;
    }
    setCategoryId(id);
    setCv((current) => {
      const nextCv = {
        ...current,
        jobTitle: category.title,
        summary: category.summary,
        skills: category.skills,
        experience: category.experience,
        workExperiences: [createExperienceEntry(category)],
      };
      setCoverLetter(createCoverLetterFromCv(nextCv, id));
      return nextCv;
    });
    setPendingTemplateId(null);
    trackEvent("switch_template_load_sample");
    recordCvEvent("template_selected", { mode: "sample_data", template_id: id });
  };
  const handleCategory = (id) => {
    if (!id || id === categoryId) return;
    if (hasUserEnteredCvData(cv)) {
      setPendingTemplateId(id);
      return;
    }
    loadTemplateSampleData(id);
  };
  const updateCvField = (key, value) => {
    if (key === "tipsEnabled") localStorage.setItem("bmcv_tips_enabled", String(Boolean(value)));
    setCv((current) => ({ ...current, [key]: value }));
  };
  const applyAtsSuggestion = (action, insights = {}) => {
    if (!cv.jobDescription?.trim()) return;
    const missingSkillText = (insights.recommendedSkills || []).filter(Boolean).join(", ");
    setCv((current) => {
      let next = { ...current };
      if (action === "summary" || action === "all") {
        const additions = (insights.missingKeywords || []).slice(0, 3).join(", ");
        next.summary = `${String(current.summary || "").trim().replace(/\.$/, "")}. Tailored for ${current.targetJobTitle || current.jobTitle || "this role"} with focus on ${additions || "the job requirements"}.`.trim();
      }
      if (action === "experience" || action === "all") {
        const enriched = normalizeWorkExperiences(current).map((entry, index) => {
          if (index > 1) return entry;
          const detail = (insights.missingKeywords || []).slice(0, 2).join(" and ");
          const extraLine = detail ? `Highlighted ${detail} to better match the target job description.` : "Tailored this experience to better match the target job description.";
          return {
            ...entry,
            responsibilities: String(entry.responsibilities || "").includes(extraLine)
              ? entry.responsibilities
              : `${String(entry.responsibilities || "").trim()}\n${extraLine}`.trim(),
          };
        });
        next.workExperiences = enriched;
        next.experience = formatWorkExperiences(enriched);
      }
      if (action === "skills" || action === "all") {
        const merged = [current.skills, missingSkillText].filter(Boolean).join(", ");
        next.skills = [...new Set(merged.split(",").map((item) => item.trim()).filter(Boolean))].join(", ");
      }
      return next;
    });
    recordCvEvent("suggestion_applied", { action, keyword_count: (insights.missingKeywords || []).length });
  };
  const handleImport = (extracted, metadata = {}) => {
    if (!metadata.importId || appliedImportIdsRef.current.has(metadata.importId)) return false;
    appliedImportIdsRef.current.add(metadata.importId);
    setCv((current) => {
      const importedWorkExperiences = extracted.workExperiences.length ? extracted.workExperiences.map((entry, index) => ({ ...createBlankExperienceEntry(), ...entry, manualOrder: index })) : [createBlankExperienceEntry()];
      const nextCv = {
        ...current,
        onboardingCompleted: true,
        fullName: extracted.fullName ?? "",
        jobTitle: extracted.jobTitle ?? "",
        email: extracted.email ?? "",
        phone: extracted.phone ?? "",
        country: extracted.country ?? "",
        nationality: extracted.nationality ?? "",
        visaStatus: extracted.visaStatus ?? "",
        linkedIn: extracted.linkedIn ?? "",
        portfolioUrl: extracted.portfolioUrl ?? "",
        drivingLicense: extracted.drivingLicense ?? "",
        summary: extracted.summary ?? "",
        skills: extracted.skills ?? "",
        education: extracted.education ?? "",
        projects: extracted.projects ?? "",
        location: extracted.location ?? "",
        professionalLinks: extracted.professionalLinks ?? "",
        awards: extracted.awards ?? "",
        volunteerExperience: extracted.volunteerExperience ?? "",
        unclassifiedContent: extracted.unclassifiedContent ?? "",
        certifications: extracted.certifications ?? "",
        languages: extracted.languages ?? "",
        references: extracted.references?.trim() ? normalizeReferences(extracted.references) : { mode: "none", entries: [] },
        originalLanguage: extracted.originalLanguage ?? current.originalLanguage,
        outputLanguage: extracted.outputLanguage ?? current.outputLanguage,
        languageDirection: extracted.languageDirection ?? current.languageDirection,
        workExperiences: importedWorkExperiences,
        experience: formatWorkExperiences(importedWorkExperiences.filter((entry) => [entry.jobTitle, entry.employer, entry.companyLocation, entry.fromDate, entry.toDate, entry.responsibilities].some((value) => String(value || "").trim()))),
      };
      return nextCv;
    });
    // Import intentionally emits no document text, personal fields, or source language to analytics.
    return true;
  };
  const handleProfilePhotoChange = async (key, value) => {
    setCv((current) => ({ ...current, [key]: value }));
    if (key !== "profilePhoto") return;
    const revision = ++photoUploadRevision.current;
    if (!value || !cloudSavingEnabled) return;
    try {
      setStorageMessage("Uploading photo to Supabase Storage...");
      const uploaded = await uploadProfilePhoto(user.id, value);
      if (revision !== photoUploadRevision.current) return;
      setCv((current) => ({ ...current, profilePhoto: uploaded.publicUrl }));
      setStorageMessage("Photo uploaded to Supabase Storage.");
    } catch (error) {
      if (revision !== photoUploadRevision.current) return;
      setStorageMessage(`Photo kept locally: ${error.message}`);
    }
  };
  const loadSavedCv = (item) => {
    photoUploadRevision.current++;
    const nextCv = item.cv_data || initialCv;
    setCv(nextCv);
    setCurrentCvId(item.id || null);
    setCategoryId(item.category_id || defaultCategory.id);
    setThemeId(item.theme_id || "blue");
    setLayoutId(item.layout_id || "sidebar");
    setCoverLetter(createCoverLetterFromCv(nextCv, item.category_id || defaultCategory.id));
    trackEvent("load_saved_cv");
  };
  const updateCvFromCoverLetter = (key, value) => {
    setCv((current) => ({ ...current, [key]: ["summary", "skills", "experience"].includes(key) ? sanitizeCvTextForCoverLetter(value) : value }));
  };
  const handleCoverRoleChange = (role) => {
    setCoverLetter((current) => generateCoverLetterTemplate({ cv: { ...cv, jobTitle: role }, role, letter: current }));
    setCv((current) => ({ ...current, jobTitle: role }));
  };
  const regenerateCoverLetter = async () => {
    const safeCv = sanitizeCvForCoverLetter(cv);
    const localDraft = generateCoverLetterTemplate({ cv: safeCv, role: coverLetter.position, letter: sanitizeCoverLetterParagraphs(coverLetter) });
    try {
      const response = await fetch("/.netlify/functions/generateCoverLetter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cv: safeCv,
          companyName: coverLetter.companyName,
          position: coverLetter.position,
          category: coverLetter.position,
          experienceLevel: coverLetter.experienceLevel,
          yearsExperience: coverLetter.yearsExperience,
          region: coverLetter.region,
          jobDescription: coverLetter.jobDescription,
        }),
      });
      if (!response.ok) throw new Error("AI generation unavailable");
      const aiDraft = await response.json();
      setCoverLetter((current) => ({ ...current, ...localDraft, ...aiDraft }));
    } catch {
      setCoverLetter(localDraft);
    }
  };
  const ensureTrackedCvRecord = async () => {
    if (!cloudSavingEnabled) return currentCvId;
    if (currentCvId) return currentCvId;
    try {
      const saved = await saveCvForUser({ userId: user.id, cv, categoryId, themeId, layoutId });
      setCurrentCvId(saved?.id || null);
      return saved?.id || null;
    } catch {
      return null;
    }
  };
  const handleDownload = async (type) => {
    if (type === "email") {
      const toEmail = user?.email || session?.user?.email || cv.email;
      if (!user?.email && !session?.user?.email) {
        throw new Error("Please sign in with email first to receive a CV copy by email.");
      }
      const response = await fetch("/.netlify/functions/emailCv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: toEmail, cv: { ...cv, photoCropSource: undefined } }),
      });
      const result = await readJsonResponseSafely(response, "Could not email your CV.");
      if (!response.ok || !result.ok) throw new Error(result.message || "Could not email your CV.");
      logEvent("cv_email_requested", { templateId: categoryId, forwarded: result.forwarded });
      return result;
    }
    const trackedCvId = await ensureTrackedCvRecord();
    await downloadCvFile(cv, type, theme, layoutId);
    logEvent("cv_downloaded", { format: type, templateId: categoryId, completionPercent: completion.percent });
    recordCvEvent("download_completed", { format: type, completion_percent: completion.percent, cv_id: trackedCvId });
    if (trackedCvId) await markCvDownloaded(trackedCvId);
    setDownloaded(true);
    if (showSharePrompt) sessionStorage.setItem("bmcv_share_prompt_seen", "1");
    setDownloadTarget(null);
  };
  const handleCoverDownload = async (type) => {
    await downloadCoverLetterFile(coverLetter, cv, type, coverTheme);
    logEvent("cover_letter_downloaded", { format: type, templateId: categoryId });
    setCoverDownloaded(true);
    setDownloadTarget(null);
  };
  const switchBuilder = (id) => {
    window.location.hash = id === "cover" ? "cover-letter" : "builder";
    setActiveBuilder(id);
  };
  const signOut = async () => {
    await supabase?.auth.signOut();
    setUserMode("guest");
    trackEvent("logout");
  };
  const startUrgentMode = (method) => {
    setUserMode("urgent-local");
    setAuthOpen(false);
  };
  const startRegisteredMode = () => {
    setUserMode("registered");
  };
  const editorSection = workspaceMode === "ai" ? "summary" : currentStep;
  const sectionIndex = builderSteps.findIndex((step) => step.id === currentStep);
  const editorTitle = workspaceMode === "design" ? "Choose your design" : workspaceMode === "ai" ? "AI Optimizer" : {
    personal: "Personal information", experience: "Work history", education: "Education & certifications", skills: "Skills & languages", summary: "Professional summary", extras: "References & extras", import: "Upload & translate your CV",
  }[currentStep];
  const nextWorkspaceStep = () => {
    if (workspaceMode === "ai") requestCvDownload();
    else if (workspaceMode === "design") setWorkspaceMode("ai");
    else if (currentStep === "import") jumpToStep("personal");
    else if (sectionIndex < builderSteps.length - 1) jumpToStep(builderSteps[sectionIndex + 1].id);
    else setWorkspaceMode("design");
  };
  const previousWorkspaceStep = () => {
    if (workspaceMode === "ai") setWorkspaceMode("design");
    else if (workspaceMode === "design") setWorkspaceMode("content");
    else jumpToStep(builderSteps[Math.max(0, sectionIndex - 1)].id);
  };
  const nextWorkspaceLabel = workspaceMode === "ai" ? "Download CV" : workspaceMode === "design" ? "Review with AI" : currentStep === "import" ? "Review personal details" : sectionIndex === builderSteps.length - 1 ? "Choose design" : `Next: ${builderSteps[Math.max(0, sectionIndex + 1)].label}`;
  return (
    <main className={`builder-app-shell ${activeBuilder === "cv" ? "builder-workspace" : ""}`}>
      <BuilderTopBar
        onHome={onHome}
        saveStatus={saveStatus}
        onDownload={() => (activeBuilder === "cv" ? requestCvDownload() : setDownloadTarget("cover"))}
        cloudSavingEnabled={cloudSavingEnabled}
        userEmail={user?.email || session?.user?.email || ""}
        onAccess={() => setAuthOpen(true)}
        onSignOut={signOut}
        workspaceMode={activeBuilder === "cv" ? workspaceMode : null}
        onWorkspaceMode={setWorkspaceMode}
        onTranslate={() => jumpToStep("import")}
        activeBuilder={activeBuilder}
        onSwitchBuilder={switchBuilder}
      />
      <div className="builder-tabbar">
        {activeBuilder === "cv" && <BuilderStageTabs currentStep={currentStep} completedSteps={completedSteps} onStep={jumpToStep} />}
        <p className="builder-session-status">{cloudSavingEnabled ? "Saved online" : "Download-only mode"} · <button type="button" onClick={() => setAuthOpen(true)}>{cloudSavingEnabled ? "Manage account" : "Sign in to save online"}</button></p>
      </div>
      {noCloudMode && (
        <section className="workspace-storage-notice border-b border-amber-200 bg-amber-50 px-5 py-3">
          <div className="mx-auto max-w-7xl text-sm font-bold leading-6 text-amber-950">
            Your CV will not be saved online. Download your file before closing the browser.
          </div>
        </section>
      )}
      {activeBuilder === "cv" ? (
        <>
        <div className="builder-layout-v2" ref={builderMotionRoot}>
          <BuilderSidebar
            currentStep={currentStep}
            onStep={jumpToStep}
            completedSteps={completedSteps}
            workspaceMode={workspaceMode}
            onWorkspaceMode={setWorkspaceMode}
            onCoverLetter={() => switchBuilder("cover")}
            completion={completion}
            cloudSavingEnabled={cloudSavingEnabled}
            userEmail={user?.email || session?.user?.email || ""}
            onAccess={() => setAuthOpen(true)}
          />
          <section className="builder-form-panel-v2" id={`workspace-panel-${workspaceMode}`} role="tabpanel" aria-labelledby={`workspace-tab-${workspaceMode}`} tabIndex={0}>
            <div className="builder-form-inner">
              <div className="workspace-editor-heading"><span>{workspaceMode === "content" ? "Content" : workspaceMode === "design" ? "Appearance" : "Review & refine"}</span><h1 id="builder-editor-heading" tabIndex={-1}>{editorTitle}</h1></div>
              <div hidden={workspaceMode !== "design"} className="workspace-design-templates">
                <BuilderTemplateDock categoryId={categoryId} onCategory={handleCategory} themeId={themeId} onTheme={setThemeId} />
              </div>
              <div hidden={workspaceMode !== "content" || currentStep !== "import"}><ExistingCVImporter onImport={handleImport} currentCv={cv} onRestore={(previous) => { setCv(previous); appliedImportIdsRef.current.clear(); }} /></div>
              {storageMessage && cloudSavingEnabled && <p className="rounded bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">{storageMessage}</p>}
              <div hidden={workspaceMode !== "ai"} className="workspace-ai-panel"><ATSPanel cv={cv} jobDescription={cv.jobDescription || ""} onJobDescriptionChange={(value) => updateCvField("jobDescription", value)} onApplySuggestion={applyAtsSuggestion} onTrackEvent={recordCvEvent} /></div>
              <div hidden={workspaceMode !== "content" || currentStep !== "personal"}><ProfilePhotoUploader cv={cv} onChange={handleProfilePhotoChange} /></div>
              <div hidden={workspaceMode === "design" || (workspaceMode === "content" && currentStep === "import")}>
                <CVBuilderForm cv={cv} onChange={updateCvField} activeSection={editorSection} />
              </div>
              <section hidden={workspaceMode !== "design"} className="workspace-design-settings rounded border border-slate-200 bg-white p-4">
                <h3 className="panel-title">Save and layout</h3>
                <div className="workspace-settings-grid mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-4">
                    <LayoutSelector selected={layoutId} onSelect={setLayoutId} />
                    <PageBorderSelector cv={cv} onChange={updateCvField} />
                    <button
                      type="button"
                      onClick={() => setSectionReorderOpen(true)}
                      className="flex w-full items-center justify-between rounded border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-black text-blue-800 hover:bg-blue-100"
                    >
                      <span>Reorder CV sections</span>
                      <span className="text-lg leading-none">+</span>
                    </button>
                  </div>
                  <div>
                    {cloudSavingEnabled ? (
                      <MyCvsPanel
                        user={user}
                        cv={cv}
                        categoryId={categoryId}
                        themeId={themeId}
                        layoutId={layoutId}
                        onLoad={loadSavedCv}
                        onSaved={(item) => {
                          setCurrentCvId(item?.id || null);
                        }}
                        onSaveDraft={() => saveCloudDraft()}
                        onLoadDraft={restoreCloudDraft}
                        draftStatus={draftStatus}
                      />
                    ) : (
                      <section className="rounded border border-amber-200 bg-amber-50 p-4">
                        <h3 className="panel-title text-amber-950">Download-only mode</h3>
                        <p className="mt-2 text-xs font-bold leading-5 text-amber-900">
                          Cloud saving is off. Your CV stays in this browser only and will not be saved to Supabase.
                        </p>
                        <button onClick={() => setAuthOpen(true)} className="mt-3 w-full rounded border border-amber-300 bg-white px-4 py-3 text-sm font-black text-amber-900 hover:bg-amber-100">
                          Sign in to save online
                        </button>
                      </section>
                    )}
                    <label className="mt-4 flex items-start gap-3 rounded border border-slate-200 bg-white p-4">
                      <input
                        type="checkbox"
                        checked={cv.showCredit !== false}
                        onChange={(event) => updateCvField("showCredit", event.target.checked)}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        <span className="block text-sm font-black text-slate-950">Show "created with" credit on my CV</span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">Default on, freely removable. This keeps the free tool easy to share without adding a watermark.</span>
                      </span>
                    </label>
                  </div>
                </div>
              </section>
              {BUILDER_ADS_ENABLED && <AdBanner compact label="Google AdSense form ad" slot="1010101010" />}
            </div>
            <footer className="workspace-editor-footer"><button type="button" onClick={previousWorkspaceStep} disabled={workspaceMode === "content" && currentStep === "personal"}><Icon name="arrow" className="workspace-back-icon h-4 w-4" />Back</button><button type="button" onClick={nextWorkspaceStep} className="workspace-next">{nextWorkspaceLabel}<Icon name={workspaceMode === "ai" ? "download" : "arrow"} className="h-4 w-4" /></button></footer>
          </section>
          <div className="builder-right-stack">
            <BuilderPreviewPanel cv={cv} theme={theme} layout={layoutId} onDownload={requestCvDownload} />
          </div>
          <CompletionBar completion={completion} onNextStep={handleNextStep} onDownload={requestCvDownload} />
        </div>
        <button type="button" onClick={() => setMobileCvView("preview")} className="btn-preview-float">
          <Icon name="eye" className="h-4 w-4" /> Preview CV
        </button>
        <nav className="mobile-builder-tabbar" aria-label="CV builder mobile actions">
          <button type="button" onClick={() => setMobileCvView("edit")} className={mobileCvView === "edit" ? "active" : ""}>
            Edit CV
          </button>
          <button type="button" onClick={() => setMobileCvView("preview")} className={mobileCvView === "preview" ? "active" : ""}>
            Preview
          </button>
          <button type="button" onClick={() => setMobileCvView("ats")} className={mobileCvView === "ats" ? "active" : ""}>
            ATS Score
          </button>
          <button type="button" onClick={requestCvDownload}>
            Export
          </button>
        </nav>
        {mobileCvView === "preview" && (
          <div className="mobile-sheet-backdrop" onClick={() => setMobileCvView("edit")}>
            <div className="mobile-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="mobile-sheet-handle" />
              <div className="mb-3 flex items-center justify-between">
                <span className="preview-live-label"><span className="live-dot" /> Live preview</span>
                <button type="button" onClick={() => setMobileCvView("edit")} className="rounded border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">Close</button>
              </div>
              <BuilderPreviewPanel cv={cv} theme={theme} layout={layoutId} onDownload={requestCvDownload} />
            </div>
          </div>
        )}
        {mobileCvView === "ats" && (
          <div className="mobile-sheet-backdrop" onClick={() => setMobileCvView("edit")}>
            <div className="mobile-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="mobile-sheet-handle" />
              <div className="mb-3 flex items-center justify-between">
                <span className="preview-live-label"><span className="live-dot" /> ATS score</span>
                <button type="button" onClick={() => setMobileCvView("edit")} className="rounded border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">Close</button>
              </div>
              <ATSPanel
                cv={cv}
                jobDescription={cv.jobDescription || ""}
                onJobDescriptionChange={(value) => updateCvField("jobDescription", value)}
                onApplySuggestion={applyAtsSuggestion}
                onTrackEvent={recordCvEvent}
              />
            </div>
          </div>
        )}
        {downloaded && (
          <div className="download-success-stack">
            <div className="rounded border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-900 shadow-lg">Download confirmed. Your CV file is ready.</div>
            {showSharePrompt && (
              <div>
                <ShareTool moment="post_download" />
                <EmailCapture source="download" roleInterest={cv.jobTitle} />
              </div>
            )}
          </div>
        )}
        {completionMessage && (
          <div className="fixed bottom-36 right-5 z-40 rounded border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900 shadow-lg">{completionMessage}</div>
        )}
        </>
      ) : (
        <CoverLetterBuilder
          cv={cv}
          letter={coverLetter}
          onCvChange={updateCvFromCoverLetter}
          onRoleChange={handleCoverRoleChange}
          onLetterChange={(key, value) => setCoverLetter((current) => ({ ...current, [key]: coverLetterParagraphFields.has(key) ? sanitizeCvTextForCoverLetter(value) : value }))}
          onRegenerate={regenerateCoverLetter}
          themeId={coverThemeId}
          onThemeChange={setCoverThemeId}
          fontId={coverFontId}
          onFontChange={setCoverFontId}
          layoutId={coverLayoutId}
          onLayoutChange={setCoverLayoutId}
          onDownload={() => setDownloadTarget("cover")}
          downloaded={coverDownloaded}
        />
      )}
      {completionModalOpen && (
        <div className="mobile-sheet-backdrop" onClick={() => setCompletionModalOpen(false)}>
          <div className="completion-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Your CV is complete!</h2>
            <p>You can download now or keep polishing your wording.</p>
            <div className="completion-modal-actions">
              <button type="button" onClick={() => { setCompletionModalOpen(false); requestCvDownload(); }}>Download PDF</button>
              <button type="button" onClick={() => setCompletionModalOpen(false)}>Keep polishing</button>
            </div>
            <ShareTool moment="completion_100" />
          </div>
        </div>
      )}
      {downloadTarget === "cv" && (
        <DownloadModal
          cv={cv}
          onClose={() => setDownloadTarget(null)}
          onVerifiedDownload={handleDownload}
          onOtpRequested={(details) => recordCvEvent("otp_requested", { email: details.email, method: "download-email-otp" })}
          onOtpVerified={(details) => recordCvEvent("otp_requested", { email: details.email, method: "download-email-otp-verified" })}
          canEmailCopy={Boolean(user?.email || session?.user?.email)}
          emailCopyAddress={user?.email || session?.user?.email || ""}
        />
      )}
      {downloadTarget === "cover" && <CoverLetterDownloadModal cv={cv} onClose={() => setDownloadTarget(null)} onVerifiedDownload={handleCoverDownload} />}
      {pendingTemplateId && (
        <SwitchTemplateModal
          templateName={categories.find((item) => item.id === pendingTemplateId)?.name}
          onKeepData={() => keepCurrentDataForTemplate(pendingTemplateId)}
          onLoadSample={() => loadTemplateSampleData(pendingTemplateId)}
          onClose={() => setPendingTemplateId(null)}
        />
      )}
      {sectionReorderOpen && <SectionReorderPanel cv={cv} onChange={updateCvField} onClose={() => setSectionReorderOpen(false)} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onUrgentMode={startUrgentMode} onRegisteredMode={startRegisteredMode} />}
    </main>
  );
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isBuilderHash = ["#builder", "#cover-letter"].includes(location.hash);
  const goToBuilder = (target) => navigate(typeof target === "string" && target.startsWith("/builder") ? target : "/builder");
  const goHome = () => navigate("/");

  useEffect(() => {
    initAnalytics();
  }, []);
  useEffect(() => {
    if (!location.hash || isBuilderHash) return;
    const targetId = location.hash.slice(1);
    let attempts = 0;
    const scrollToHash = () => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: attempts > 0 ? "smooth" : "auto", block: "start" });
        return;
      }
      attempts += 1;
      if (attempts < 10) window.setTimeout(scrollToHash, 80);
    };
    window.setTimeout(scrollToHash, 40);
  }, [location.hash, location.pathname, isBuilderHash]);

  if (isBuilderHash && location.pathname === "/") {
    return (
      <>
        <AdSenseScript />
        <CVBuilderApp onHome={goHome} />
        <CookieNotice />
      </>
    );
  }

  return (
    <>
      <AdSenseScript />
      <Routes>
        <Route
          path="/"
          element={
            <>
              <LandingPage onStart={goToBuilder} />
            </>
          }
        />
        <Route path="/builder" element={<CVBuilderApp onHome={goHome} />} />
        <Route path="/about" element={<AboutPage onStart={goToBuilder} />} />
        <Route path="/contact" element={<ContactPage onStart={goToBuilder} />} />
        <Route path="/privacy" element={<PrivacyPage onStart={goToBuilder} />} />
        <Route path="/terms" element={<TermsPage onStart={goToBuilder} />} />
        <Route path="/blog" element={<BlogIndexPage onStart={goToBuilder} />} />
        <Route path="/blog/:slug" element={<BlogArticlePage onStart={goToBuilder} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieNotice />
    </>
  );
}
