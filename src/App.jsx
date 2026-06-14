import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { categories, layouts, themes } from "./data/categories";
import TemplatesSectionV3 from "./components/TemplatesSectionV3";
import PhotoUploadCrop from "./components/PhotoUploadCrop";
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
import { faqs } from "./data/siteContent";
import {
  HOME_BUILD_STEPS,
  HOME_CITY_PILLS,
  HOME_EYEBROW,
  HOME_FEATURES,
  HOME_H1,
  HOME_META_DESCRIPTION,
  HOME_META_TITLE,
  HOME_ATS_PREVIEW,
  HOME_PORTFOLIO_FLOW,
  HOME_SUBHEAD,
  HOME_TRANSFORMATION_EXAMPLES,
  HOME_TRUST_ITEMS,
  HOME_TRUST_METRICS,
  HOME_VIDEO,
} from "./content/homepage";
import { downloadCoverLetterFile, downloadCvFile, normalizePageMargin, pageMarginToCss, pageMarginToInches } from "./utils/downloads";
import { initAnalytics, trackEvent } from "./utils/analytics";
import { getRecaptchaToken, isRecaptchaConfigured } from "./utils/recaptcha";
import {
  deleteUserCv,
  duplicateUserCv,
  isSupabaseConfigured,
  listUserCvs,
  loadLatestDraftForUser,
  SAVED_CV_LIMIT,
  SAVED_CV_RETENTION_DAYS,
  saveCvForUser,
  saveDraftForUser,
  submitContactMessage,
  supabase,
  uploadProfilePhoto,
} from "./supabaseClient";

const defaultCategory = categories[0];
const defaultSectionOrder = ["summary", "experience", "education", "skills", "educationProjects", "certifications", "languages", "references"];
const defaultQrCode = { enabled: false, url: "", label: "Scan for LinkedIn", position: "header" };
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
  skills: "Skills",
  certifications: "Certifications",
  languages: "Languages",
  references: "References",
};

const createExperienceEntry = (category = defaultCategory) => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  jobTitle: category.title,
  employer: "Employer name",
  companyLocation: "",
  fromDate: "",
  toDate: "",
  isCurrent: false,
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
      sortValue: entry.isCurrent
        ? 999999
        : Math.max(parseExperienceDateValue(entry.toDate), parseExperienceDateValue(entry.fromDate)),
    }))
    .sort((a, b) => (b.sortValue - a.sortValue) || (a.index - b.index))
    .map(({ entry }) => entry);

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
    return sortWorkExperiences(cv.workExperiences.map((entry) => ({ ...createExperienceEntry(), ...entry })));
  }
  if (!cv.experience) return [createExperienceEntry()];
  return [
    {
      ...createExperienceEntry(),
      jobTitle: cv.jobTitle || "",
      employer: "",
      companyLocation: "",
      responsibilities: cv.experience,
    },
  ];
};

const photoShapeClass = (shape = "circle", roundedClass = "rounded-xl") => {
  if (shape === "circle" || shape === "round") return "rounded-full";
  if (shape === "rounded") return roundedClass;
  return "rounded-none";
};

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
  pageMargin: { type: "default" },
  showCredit: true,
  references: defaultReferences,
  sectionOrder: defaultSectionOrder,
  hiddenSections: [],
  profilePhoto: "",
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
const DEFAULT_AUTH_REDIRECT_URL =
  typeof window !== "undefined" ? `${window.location.origin}/builder/#builder` : "https://buildmycvnow.com/builder/#builder";
const AUTH_REDIRECT_URL = import.meta.env.VITE_AUTH_REDIRECT_URL || DEFAULT_AUTH_REDIRECT_URL;
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

const createDraftPayload = ({ cv, coverLetter, categoryId, themeId, layoutId, coverThemeId, coverFontId, coverLayoutId }) => ({
  cv,
  coverLetter,
  categoryId,
  themeId,
  layoutId,
  coverThemeId,
  coverFontId,
  coverLayoutId,
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
    arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
    check: <path d="m20 6-11 11-5-5" />,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>,
    camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    sparkle: <><path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.7l6.8-4.4" /><path d="M8.6 13.3l6.8 4.4" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h2v2h-2z" /><path d="M19 14h2v2h-2z" /><path d="M14 19h2v2h-2z" /><path d="M19 19h2v2h-2z" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 0 20" /><path d="M12 2a15.3 15.3 0 0 0 0 20" /></>,
    alert: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></>,
    info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
    moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 7 7 0 1 0 20.5 14.5z" />,
    monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /><path d="M12 16v4" /></>,
    lightbulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14a6 6 0 1 1 7 0c-.8.6-1.5 1.6-1.5 2.6h-4c0-1-.7-2-1.5-2.6z" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function Seo({ title, description, image = "https://buildmycvnow.com/assets/og-image.jpg", type = "website" }) {
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
    setMeta("meta[property='og:image:width']", "content", "1200");
    setMeta("meta[property='og:image:height']", "content", "630");
    setMeta("meta[property='og:image:type']", "content", "image/jpeg");
    setMeta("meta[property='og:site_name']", "content", "BuildMyCVNow");
    setMeta("meta[name='twitter:card']", "content", "summary_large_image");
    setMeta("meta[name='twitter:title']", "content", fullTitle);
    setMeta("meta[name='twitter:description']", "content", description);
    setMeta("meta[name='twitter:image']", "content", image);
    let canonicalTag = document.querySelector("link[rel='canonical']");
    if (!canonicalTag) {
      canonicalTag = document.createElement("link");
      canonicalTag.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute("href", canonical);
  }, [title, description, image, type]);
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

function Header({ onStart, onSignIn }) {
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
        <span className="nav-logo-mark">
            <Icon name="file" className="h-5 w-5" />
          </span>
        <span>BuildMyCV<span>Now</span></span>
        </Link>
      <div className="nav-right">
        <nav className="nav-links" aria-label="Landing page navigation">
          <Link to="/#templates" className="nav-link">Templates</Link>
          <Link to="/#how-it-works" className="nav-link">How it works</Link>
          <Link to="/blog" className="nav-link">Blog</Link>
        </nav>
        {onSignIn && (
          <button onClick={onSignIn} className="nav-signin">
            Sign In / Sign Up
          </button>
        )}
        <button onClick={onStart} className="nav-cta">
          Create and download CV for free
        </button>
      </div>
      <button onClick={onStart} className="nav-mobile-cta" aria-label="Create and download CV for free">
        CV
      </button>
    </header>
  );
}

function TrustMetricsBar() {
  return (
    <section className="growth-trust-strip" aria-label="BuildMyCVNow trust metrics">
      <div className="growth-trust-grid">
        {HOME_TRUST_METRICS.map(([value, label]) => (
          <div key={label} className="growth-trust-item">
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PortfolioWebsiteSection({ onStart }) {
  return (
    <section className="growth-section growth-portfolio" aria-labelledby="portfolio-heading">
      <div className="growth-section-copy">
        <div className="section-eyebrow">Product roadmap</div>
        <h2 id="portfolio-heading" className="section-title">Start with your CV. Portfolio and website coming soon.</h2>
        <p className="section-sub">
          BuildMyCVNow is live today as a free CV builder. Portfolio and personal website tools are planned next, so job seekers can grow from a strong CV into a fuller online profile.
        </p>
      </div>
      <div className="portfolio-flow" aria-label="CV to portfolio to personal website flow">
        {HOME_PORTFOLIO_FLOW.map((step) => (
          <article key={step.label} className={`portfolio-step-card ${step.status === "coming-soon" ? "coming-soon" : "live"}`}>
            {step.status === "coming-soon" && <em>Coming soon</em>}
            <span>{step.number}</span>
            <h3>{step.label}</h3>
            <p>{step.description}</p>
            {step.status === "live" ? (
              <button type="button" onClick={onStart}>Start building -&gt;</button>
            ) : (
              <button type="button" disabled>Notify me when live</button>
            )}
          </article>
        ))}
      </div>
      <div className="portfolio-mockup" aria-label="Portfolio and personal website preview">
        <div className="portfolio-browser-bar">
          <span />
          <span />
          <span />
          <strong>buildmycvnow.com/profile</strong>
        </div>
        <div className="portfolio-preview-grid">
          <div>
            <div className="portfolio-avatar">CV</div>
            <h3>Professional Profile</h3>
            <p>CV, projects, skills, links, and contact details in one shareable page.</p>
          </div>
          <div className="portfolio-preview-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <button type="button" className="growth-primary-link" onClick={onStart}>Start with my CV</button>
    </section>
  );
}

function AtsPreviewSection({ onStart }) {
  return (
    <section className="growth-section growth-ats" aria-labelledby="ats-preview-heading">
      <div className="ats-score-card">
        <div className="ats-score-ring" aria-label={`Example ATS score ${HOME_ATS_PREVIEW.score} out of 100`}>
          <strong>{HOME_ATS_PREVIEW.score}</strong>
          <span>/100</span>
        </div>
        <div>
          <h2 id="ats-preview-heading">{HOME_ATS_PREVIEW.title}</h2>
          <p>{HOME_ATS_PREVIEW.description}</p>
        </div>
      </div>
      <div className="ats-check-list">
        {HOME_ATS_PREVIEW.checks.map((item) => (
          <div key={item.label} className={item.status === "warn" ? "warn" : "pass"}>
            <Icon name={item.icon} className="h-5 w-5" />
            <span>
              <strong>{item.label}</strong>
              <small>{item.desc}</small>
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="growth-primary-link" onClick={onStart}>Check my CV score</button>
    </section>
  );
}

function BeforeAfterSection({ onStart }) {
  return (
    <section className="growth-section growth-transform" aria-labelledby="transform-heading">
      <div className="growth-section-copy">
        <div className="section-eyebrow">AI resume improvement</div>
        <h2 id="transform-heading" className="section-title">Turn weak CV wording into professional resume writing</h2>
        <p className="section-sub">
          Show recruiters stronger summaries, clearer work experience, and better skills with CV content enhancement you can approve before it changes your document.
        </p>
      </div>
      <div className="transform-grid">
        {HOME_TRANSFORMATION_EXAMPLES.map((item) => (
          <article key={item.label} className="transform-card">
            <h3>{item.label}</h3>
            <div className="transform-columns">
              <div>
                <span>Before</span>
                <p>{item.before}</p>
              </div>
              <div>
                <span>After</span>
                <p>{item.after}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      <button type="button" className="growth-primary-link" onClick={onStart}>Improve My CV Now</button>
    </section>
  );
}

function LandingPage({ onStart, onUpload }) {
  const buildSteps = HOME_BUILD_STEPS;
  const features = HOME_FEATURES;
  const testimonials = [
    ["Maria Santos", "Hotel Receptionist - Dubai, UAE", "MS", "#E6F1FB", "#0C447C", "I built my hotel CV on my phone in 15 minutes. Got a callback from a Dubai property within the week.", "PH"],
    ["Raj Menon", "IT Support Specialist - Abu Dhabi, UAE", "RM", "#E1F5EE", "#085041", "The ATS tips helped me land interviews at two IT firms in Abu Dhabi. I had been applying for months with no results before.", "IN"],
    ["Ana Cruz", "Admin Assistant - Riyadh, Saudi Arabia", "AC", "#EEEDFE", "#3C3489", "I uploaded my old CV and the AI rewrote my experience bullets. The difference was immediately obvious.", "PH"],
    ["James Okafor", "Civil Engineer - Lagos, Nigeria", "JO", "#FEF3C7", "#92400E", "Free, fast, and no hidden paywall at the end. I have recommended it to everyone in my batch.", "NG"],
    ["Fatima Al Nuaimi", "Accounts Assistant - Sharjah, UAE", "FA", "#DBEAFE", "#1E40AF", "The finance template helped me organize VAT, payroll, and supplier payment experience in a cleaner way.", "AE"],
    ["Liza Fernandez", "Domestic Services - Doha, Qatar", "LF", "#DCFCE7", "#166534", "I needed a simple CV for overseas applications. The builder gave me a clear PDF without asking for payment.", "PH"],
  ];
  const heroCards = [
    {
      initials: "RK",
      name: "Rahul Kumar",
      role: "Software Engineer",
      location: "Bengaluru, India",
      accentColor: "#1e40af",
      accentLight: "#dbeafe",
      accentMid: "#2563eb",
      textLight: "#bfdbfe",
      textMuted: "#93c5fd",
      skillBg: "#eff6ff",
      skillText: "#1d4ed8",
      skills: ["React", "Node.js", "AWS"],
      className: "global-cv-card-left",
    },
    {
      initials: "AN",
      name: "Amina Nwosu",
      role: "Marketing Lead",
      location: "Lagos, Nigeria",
      accentColor: "#059669",
      accentLight: "#d1fae5",
      accentMid: "#10b981",
      textLight: "#d1fae5",
      textMuted: "#a7f3d0",
      skillBg: "#ecfdf5",
      skillText: "#065f46",
      skills: ["SEO", "Copywriting", "Meta Ads"],
      featured: true,
      className: "global-cv-card-center",
    },
    {
      initials: "SC",
      name: "Sarah Chen",
      role: "Finance Analyst",
      location: "London, UK",
      accentColor: "#7c3aed",
      accentLight: "#ede9fe",
      accentMid: "#8b5cf6",
      textLight: "#ede9fe",
      textMuted: "#ddd6fe",
      skillBg: "#f5f3ff",
      skillText: "#5b21b6",
      skills: ["Excel", "SQL", "CFA"],
      className: "global-cv-card-right",
    },
  ];
  return (
    <main id="top" className="landing-page-redesign">
      <Seo
        title={HOME_META_TITLE}
        description={HOME_META_DESCRIPTION}
      />
      <section className="global-hero-section">
        <div className="global-hero-arc" aria-hidden="true" />
        <div className="global-hero-arc-inner" aria-hidden="true" />
        <div className="global-hero-blob" aria-hidden="true" />
        <div className="global-hero-inner">
          <div className="global-hero-copy">
            <span className="global-hero-eyebrow">{HOME_EYEBROW}</span>
            <h1 className="global-hero-headline">
              {HOME_H1.split(". ")[0]}.
              <span>{HOME_H1.split(". ")[1]}</span>
            </h1>
            <p className="global-hero-subhead">
              {HOME_SUBHEAD}
            </p>
            <div className="global-hero-cta-row">
              <button type="button" onClick={onStart} className="global-hero-primary">
                <Icon name="file" className="h-4 w-4" />
                Create and download CV for free
              </button>
              <button type="button" onClick={onUpload || onStart} className="global-hero-secondary upload-hero-cta">
                <Icon name="upload" className="h-4 w-4" />
                Upload Existing CV
              </button>
            </div>
            <p className="global-upload-note">Upload your existing CV and improve it with AI.</p>
            <div className="global-hero-trust" role="list">
              {HOME_TRUST_ITEMS.map((item) => (
                <span key={item} role="listitem"><i aria-hidden="true" /> {item}</span>
              ))}
            </div>
          </div>
          <div className="global-hero-cards" aria-hidden="true">
            {heroCards.map((card) => (
              <div key={card.name} className={`global-cv-card ${card.className} ${card.featured ? "featured" : ""}`}>
                <div className="global-cv-card-header" style={{ background: card.accentColor }}>
                  <div className="global-cv-avatar" style={{ background: card.accentMid }}>{card.initials}</div>
                  <div>
                    <div className="global-cv-name" style={{ color: card.textLight }}>{card.name}</div>
                    <div className="global-cv-role" style={{ color: card.textMuted }}>{card.role} - {card.location}</div>
                  </div>
                </div>
                <div className="global-cv-card-body">
                  <div className="global-cv-lines">
                    <span style={{ width: "82%", background: card.accentLight }} />
                    <span style={{ width: "64%" }} />
                    <span style={{ width: "72%" }} />
                  </div>
                  <div className="global-cv-label" style={{ color: card.accentColor }}>Experience</div>
                  <div className="global-cv-divider" />
                  <div className="global-cv-lines">
                    <span style={{ width: "88%" }} />
                    <span style={{ width: "72%" }} />
                    <span style={{ width: "80%" }} />
                  </div>
                  <div className="global-cv-label" style={{ color: card.accentColor }}>Skills</div>
                  <div className="global-cv-divider" />
                  <div className="global-cv-skills">
                    {card.skills.map((skill) => (
                      <span key={skill} style={{ background: card.skillBg, color: card.skillText }}>{skill}</span>
                    ))}
                  </div>
                  {card.featured && <div className="global-cv-ats" style={{ background: card.accentColor }}>ATS-ready</div>}
                </div>
              </div>
            ))}
            <div className="global-location-pills">
              {HOME_CITY_PILLS.map((city) => <span key={city}>{city}</span>)}
            </div>
          </div>
        </div>
      </section>

      <TrustMetricsBar />

      <TemplatesSectionV3 onStart={onStart} />

      <PortfolioWebsiteSection onStart={onStart} />

      <AtsPreviewSection onStart={onStart} />

      <section className="video-section" id="how-it-works">
        <div className="section-eyebrow">See it in action</div>
        <h2 className="section-title">{HOME_VIDEO.title}</h2>
        <p className="section-sub">{HOME_VIDEO.subtitle}</p>
        <div className="video-wrapper">
          <div className="browser-chrome">
            <div className="browser-bar">
              <div className="browser-dots" aria-hidden="true"><span /><span /><span /></div>
              <div className="browser-url">buildmycvnow.com/builder</div>
            </div>
            <div className="video-screen">
              <video
                className="demo-video"
                src={HOME_VIDEO.file}
                poster="/assets/cv-video-thumb.jpg"
                preload="metadata"
                playsInline
                controls
                aria-label="BuildMyCVNow CV builder demo"
              />
            </div>
          </div>
        </div>
        <div className="build-steps-panel">
          <h3>How to Build Your CV</h3>
          <div className="build-steps-grid">
            {buildSteps.map((step, index) => (
              <div key={step} className="build-step-card">
                <span>Step {index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
          <p className="build-step-tip">Tip: You can switch templates at any time without losing your data.</p>
        </div>
        <div className="stats-row">
          {[
            ["5 min", "avg. time to finish"],
            ["8+", "job-specific templates"],
            ["100%", "free to download"],
          ].map(([num, label]) => (
            <div key={num} className="stat-card"><div className="stat-num">{num}</div><div className="stat-label">{label}</div></div>
          ))}
        </div>
      </section>

      <section className="features-section">
        <div className="section-inner">
          <div className="section-eyebrow">Why BuildMyCVNow</div>
          <h2 className="section-title">Everything you need, nothing you don't</h2>
          <div className="features-grid">
            {features.map(([icon, title, desc], index) => (
              <div key={title} className="feature-card">
                <div className={`feature-icon feature-icon-${index}`}><Icon name={icon} className="h-5 w-5" /></div>
                <div>
                  <div className="feature-title">{title}</div>
                  <p className="feature-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <BeforeAfterSection onStart={onStart} />

      <section className="testimonials-section">
        <div className="section-inner">
          <div className="section-eyebrow">Real stories</div>
          <h2 className="section-title">Job seekers across 60+ countries</h2>
          <div className="testi-grid">
            {testimonials.map(([name, role, initialsText, bg, color, quote, country]) => (
              <div key={name} className="testi-card">
                <div className="testi-stars" aria-label="5 star rating">*****</div>
                <p className="testi-quote">"{quote}"</p>
                <div className="testi-person">
                  <div className="testi-avatar" style={{ background: bg, color }}>{initialsText}</div>
                  <div><div className="testi-name">{name} <span>{country}</span></div><div className="testi-role">{role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-box">
          <h2 className="cta-h2">Ready to build your CV?</h2>
          <p className="cta-sub">Free forever. No sign-up. Download as PDF in minutes.</p>
          <button type="button" onClick={onStart} className="btn-cta-white">Start building now <Icon name="arrow" className="h-4 w-4" /></button>
          <p className="cta-note">No account required - works on mobile and desktop</p>
        </div>
      </section>

      <section id="faq" className="landing-faq">
        <div>
          <h2>Frequently asked questions</h2>
          <p>
            Simple answers for first-time CV creators, workers, and job seekers using BuildMyCVNow.
          </p>
        </div>
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <SiteFooter onStart={onStart} />
    </main>
  );
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
        <p>Registered users can save up to 10 CVs online and generate/save up to 10 CVs per day. Saved CVs are stored with Supabase under the user account for up to 15 days, then are designed to expire so users are encouraged to download their own records.</p>
        <p>Google Analytics, reCAPTCHA, and AdSense may use cookies or similar technologies when enabled. Ads are intended to support the free service without interfering with CV creation.</p>
      </PolicyCard>
      <PolicyCard id="terms" title="Terms & Conditions">
        <p>BuildMyCVNow provides free CV-building tools, templates, OTP-protected downloads, saved-CV account features, and career tips for general guidance.</p>
        <p>Users own the CV information they enter and must keep it honest, accurate, and lawful. Users are responsible for downloading their own CV copies, especially in download-only mode and before the 14-day account storage period ends.</p>
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
          <p><strong>Registered account use:</strong> Users may create a free account to save and manage CVs online. Each account may save up to 10 CVs and generate/save up to 10 CVs per day. Saved CVs are kept for up to 15 days and may be automatically deleted after that period. Users are responsible for downloading their own files before expiry.</p>
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

function BlogIndexPage({ onStart }) {
  return (
    <PageShell onStart={onStart}>
      <Seo
        title="Blog and Career Tips"
        description="Read CV writing and job search tips for local, overseas, remote, and international job seekers."
      />
      <StaticHero title="Blog and Career Tips" description="Practical articles to help job seekers write stronger CVs and prepare for applications." />
      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {blogArticles.map((article) => (
            <article key={article.slug} className="rounded border border-slate-200 bg-white p-5 shadow-sm transition hover:border-green-500 hover:shadow-soft">
              <p className="flex flex-wrap gap-2 text-xs font-black uppercase text-slate-500">
                <span>{article.category}</span>
                <span>-</span>
                <span>{article.readTime}</span>
              </p>
              <h2 className="mt-3 text-xl font-black leading-7 text-slate-950">{article.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{article.excerpt}</p>
              <p className="mt-4 text-xs font-black uppercase text-slate-400">{new Date(article.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</p>
              <Link to={`/blog/${article.slug}`} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-green-700">
                Read more <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function BlogArticlePage({ onStart }) {
  const { slug } = useParams();
  const article = blogArticles.find((item) => item.slug === slug);
  if (!article) return <Navigate to="/blog" replace />;
  const related = blogArticles.filter((item) => item.slug !== article.slug && item.category === article.category).slice(0, 3);
  const splitIndex = Math.ceil(article.content.length / 2);
  return (
    <PageShell onStart={onStart}>
      <Seo title={article.title} description={article.excerpt} />
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
      <div className="footer-logo">
        <span className="footer-logo-mark"><Icon name="file" className="h-4 w-4" /></span>
        BuildMyCVNow
      </div>
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
            <span className="flex items-center gap-2 text-sm font-black text-slate-950">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white">
                <Icon name="file" className="h-4 w-4" />
              </span>
              BuildMyCV<span className="text-green-600">Now</span>
            </span>
            <span className="rounded bg-green-50 px-3 py-2 text-xs font-black text-green-700">
              Watch below
            </span>
          </div>
          <div className="landing-video-frame">
            <video controls playsInline preload="metadata" poster="/assets/cv-video-thumb.jpg" aria-label="How to create and download your CV for free">
              <source src={HOME_VIDEO.file} type="video/mp4" />
              Your browser cannot play this video.
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
              See how it works
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
    <div>
      <p className="template-safe-note">Change template anytime. Your CV details stay saved.</p>
      <div className="template-card-grid">
        {categories.map((category, index) => (
          <button
            type="button"
            value={category.id}
            key={category.id}
            onClick={() => onSelect(category.id)}
            className={`template-card-button ${selected === category.id ? "selected" : ""}`}
          >
            {index === 0 && <span className="template-popular-badge">Popular</span>}
            <span className="template-mini-preview" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="template-card-name">{category.name}</span>
            <span className="template-card-sub">{category.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExistingCVImporter({ onImport }) {
  const [status, setStatus] = useState("Upload CV -> Extract Content -> Select Output Language -> Translate & Improve -> Edit in Builder -> Download Final CV.");
  const [outputLanguage, setOutputLanguage] = useState("English");
  const [customLanguage, setCustomLanguage] = useState("");
  const [improveWording, setImproveWording] = useState(true);
  const selectedLanguage = outputLanguage === "Other language" ? customLanguage.trim() || "English" : outputLanguage;
  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("Reading uploaded CV and preparing extraction...");
    try {
      const source = await readCvSource(file);
      setStatus("AI/OCR is extracting CV sections and detecting the original language...");
      const extracted = await extractCvDetails(source, file.name);
      setStatus(`Translating and preparing a professional ${selectedLanguage} CV...`);
      const translated = await translateCvDetails(extracted, selectedLanguage, improveWording);
      onImport(translated);
      const sourceLanguage = translated.originalLanguage || extracted.originalLanguage || "detected language";
      setStatus(`Done. Original language: ${sourceLanguage}. Output language: ${translated.outputLanguage || selectedLanguage}. Review and edit before download.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      event.target.value = "";
    }
  };
  return (
    <section className="rounded border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-blue-600 text-white">
          <Icon name="upload" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="panel-title">Upload & Translate CV</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Upload PDF, DOCX, TXT, JPG, PNG, or WEBP. AI/OCR will extract, translate, improve, and fill the builder.
          </p>
          <div className="mt-3 grid gap-3 rounded border border-blue-100 bg-white/70 p-3">
            <div>
              <span className="form-label">Final CV output language</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {translationLanguageOptions.map((language) => (
                  <button
                    key={language}
                    type="button"
                    onClick={() => setOutputLanguage(language)}
                    className={`rounded border px-3 py-2 text-xs font-black ${outputLanguage === language ? "border-blue-700 bg-blue-700 text-white" : "border-blue-100 bg-white text-blue-900"}`}
                  >
                    {language}
                  </button>
                ))}
              </div>
              {outputLanguage === "Other language" && (
                <input
                  value={customLanguage}
                  onChange={(event) => setCustomLanguage(event.target.value)}
                  className="form-field mt-2"
                  placeholder="Type any language, for example Spanish or Hindi"
                />
              )}
            </div>
            <label className="flex items-start gap-3 rounded bg-green-50 p-3 text-sm font-bold text-green-950">
              <input
                type="checkbox"
                checked={improveWording}
                onChange={(event) => setImproveWording(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-green-300 text-green-700"
              />
              <span>
                <span className="block">Improve CV wording during translation</span>
                <span className="mt-1 block text-xs leading-5 text-green-800">Default ON. Keeps facts the same while making the CV sound professional.</span>
              </span>
            </label>
          </div>
          <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded bg-white px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50">
            Choose CV file
            <input className="hidden" type="file" accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*" onChange={handleFile} />
          </label>
          <p className="mt-3 text-xs font-bold leading-5 text-blue-900">{status}</p>
        </div>
      </div>
    </section>
  );
}

function ProfilePhotoUploader({ cv, onChange }) {
  return (
    <section className="optional-guidance-card">
      <div className="optional-guidance-head">
        <strong>Profile photo <em>(optional)</em></strong>
        <FieldHelp content="Required in UAE, GCC, and most Asian job markets. Omit for EU, US, and Canada applications." />
      </div>
      <PhotoUploadCrop
        value={cv.profilePhoto}
        shape={cv.photoShape === "round" ? "circle" : cv.photoShape}
        onPhotoSaved={(dataUrl, shape) => {
          onChange("photoShape", shape);
          onChange("profilePhoto", dataUrl);
        }}
        onPhotoRemoved={() => onChange("profilePhoto", "")}
      />
    </section>
  );
}

function WorkExperienceEditor({ cv, onChange }) {
  const entries = normalizeWorkExperiences(cv);
  const [openId, setOpenId] = useState(entries[0]?.id || "");
  const [aiStatus, setAiStatus] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState({});
  const commitEntries = (nextEntries) => {
    onChange("workExperiences", nextEntries);
    onChange("experience", formatWorkExperiences(nextEntries));
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
    const nextEntry = { ...createExperienceEntry(), jobTitle: cv.jobTitle || "", employer: "" };
    commitEntries([...entries, nextEntry]);
    setOpenId(nextEntry.id);
  };
  const removeEntry = (id) => {
    commitEntries(entries.length === 1 ? [{ ...createExperienceEntry(), jobTitle: cv.jobTitle || "" }] : entries.filter((entry) => entry.id !== id));
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
            <button type="button" onClick={() => removeEntry(entry.id)} className="self-start rounded border border-red-200 px-3 py-2 text-xs font-black text-red-700">
              Remove role
            </button>
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

function CollapsibleFormSection({ id, title, icon = "file", defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={`builder-section-${id}`} className={`form-section-card ${open ? "open" : ""}`}>
      <button type="button" className="form-section-head" onClick={() => setOpen(!open)}>
        <Icon name={icon} className="h-4 w-4 text-blue-700" />
        <span className="form-section-title">{title}</span>
        {badge && <span className="entry-current-badge">{badge}</span>}
        <Icon name="chevron" className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="form-section-body">{children}</div>}
    </section>
  );
}

function FieldHelp({ content }) {
  const [open, setOpen] = useState(false);
  if (!content) return null;
  return (
    <span
      className="field-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-label={content}
    >
      <Icon name="info" className="h-3.5 w-3.5" />
      {open && <span role="tooltip">{content}</span>}
    </span>
  );
}

function FormField({ label, value, onChange, type = "text", rows = 3, placeholder = "", optional = false, help = "" }) {
  return (
    <label className="block">
      <span className="form-label">
        {label}
        {optional && <em>(optional)</em>}
        <FieldHelp content={help} />
      </span>
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
      <div className="optional-section-note">
        <strong>References <em>(optional)</em></strong>
        <FieldHelp content="Usually omitted until requested. Include only if the job post asks or your reference has approved sharing their details." />
        <span>Recommended default: References available upon request.</span>
      </div>
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

function CVBuilderForm({ cv, onChange }) {
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
      <CollapsibleFormSection id="personal" title="Personal info" icon="file" defaultOpen badge={cv.fullName ? "Done" : ""}>
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
        </TipSection>
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
          <FormField label="Nationality" optional help="Include for UAE/GCC applications. It may be omitted for western markets." value={cv.nationality} onChange={(value) => onChange("nationality", value)} placeholder="Filipino" />
        </div>
        <div className="field-pair">
          <FormField label="Visa status" optional help="Include if you are applying in a country where work authorization matters." value={cv.visaStatus} onChange={(value) => onChange("visaStatus", value)} placeholder="Visit visa / Own visa / Employment visa" />
          <FormField label="Driving license" optional help="Include if the job requires driving, delivery, site visits, or vehicle ownership." value={cv.drivingLicense} onChange={(value) => onChange("drivingLicense", value)} placeholder="UAE driving license / No UAE license" />
        </div>
        <div className="field-pair">
          <FormField label="LinkedIn URL" optional help="Highly recommended. Recruiters check LinkedIn for many professional roles." type="url" value={cv.linkedIn} onChange={(value) => onChange("linkedIn", value)} placeholder="https://linkedin.com/in/yourname" />
          <FormField label="Portfolio URL" optional help="Use this for GitHub, Behance, a work sample, or a personal website if relevant." type="url" value={cv.portfolioUrl} onChange={(value) => onChange("portfolioUrl", value)} placeholder="Portfolio, GitHub, or work sample link" />
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
      </CollapsibleFormSection>

      <CollapsibleFormSection id="experience" title="Work experience" icon="briefcase" defaultOpen badge={normalizeWorkExperiences(cv).some((entry) => entry.employer) ? "Done" : ""}>
        <InlineTip industry={cv.industry} field="experience" enabled={tipsEnabled} />
        <WorkExperienceEditor cv={cv} onChange={onChange} />
      </CollapsibleFormSection>

      <CollapsibleFormSection id="education" title="Education and certifications" icon="file" badge={cv.education ? "Done" : ""}>
        <FormField label="Education" type="textarea" rows={4} value={cv.education} onChange={(value) => onChange("education", value)} placeholder="Example: High School Diploma, Manila High School, 2018" />
        <FormField label="Projects" optional type="textarea" rows={4} value={cv.projects} onChange={(value) => onChange("projects", value)} placeholder="Example: Website redesign, inventory tracking project, school capstone, or work improvement project" />
        <FormField label="Certifications & licenses" optional type="textarea" rows={3} value={cv.certifications} onChange={(value) => onChange("certifications", value)} placeholder="Example: Basic Food Safety Certificate, TESDA NC II, UAE driving license" />
      </CollapsibleFormSection>

      <ReferencesSection cv={cv} onChange={onChange} />

      <CollapsibleFormSection id="skills" title="Skills and languages" icon="check" badge={cv.skills ? "Done" : ""}>
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

      <QrCodeSection cv={cv} onChange={onChange} />

      <CollapsibleFormSection id="summary" title="Professional summary" icon="file" badge={cv.summary?.length > 40 ? "Done" : ""}>
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

async function readCvFile(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("text/") || name.endsWith(".txt")) {
    return file.text();
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (!result.value?.trim()) {
      throw new Error("Could not find readable text in this DOCX file.");
    }
    return result.value;
  }

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lineMap = new Map();
      content.items.forEach((item) => {
        const y = Math.round(item.transform?.[5] || 0);
        const x = item.transform?.[4] || 0;
        const current = lineMap.get(y) || [];
        current.push({ x, text: item.str });
        lineMap.set(y, current);
      });
      const pageText = [...lineMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
      pages.push(pageText);
    }
    const text = pages.join("\n").trim();
    if (!text) {
      throw new Error("Could not find readable text in this PDF. If it is a scanned image, please upload a text-based PDF or DOCX.");
    }
    return text;
  }

  if (name.endsWith(".doc")) {
    throw new Error("Old .doc files cannot be read reliably in the browser. Please save it as .docx, PDF, or TXT and upload again.");
  }

  throw new Error("Unsupported file type. Please upload a PDF, DOCX, TXT, or image CV.");
}

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this image file."));
    reader.readAsDataURL(file);
  });

async function readCvSource(file) {
  const name = file.name.toLowerCase();
  const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name);
  if (isImage) {
    return {
      fileName: file.name,
      imageDataUrl: await fileToDataUrl(file),
      text: "",
    };
  }
  return {
    fileName: file.name,
    text: await readCvFile(file),
  };
}

async function extractCvDetails(source, fileName) {
  const payload = typeof source === "string" ? { text: source, fileName } : { ...source, fileName: source.fileName || fileName };
  try {
    const response = await fetch("/.netlify/functions/parseCv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (response.ok && result.ok && result.cv) return result.cv;
    if (response.status === 422) throw new Error(result.message || "This document does not look like a CV/resume.");
  } catch (error) {
    if (/does not look like a CV|actual CV/i.test(error.message || "")) throw error;
  }
  if (!payload.text?.trim()) throw new Error("Image OCR needs AI extraction. Please try a text-based PDF/DOCX or check AI configuration.");
  return mockAiExtractCv(payload.text, payload.fileName);
}

async function translateCvDetails(cv, outputLanguage = "English", improveWording = true) {
  try {
    const response = await fetch("/.netlify/functions/translateCv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cv, outputLanguage, improveWording }),
    });
    const result = await response.json();
    if (response.ok && result.ok && result.cv) return result.cv;
  } catch {
    // Local fallback keeps the extracted CV editable when AI translation is unavailable.
  }
  return {
    ...cv,
    outputLanguage,
    originalLanguage: cv.originalLanguage || "Auto-detected",
    languageDirection: isArabicLanguage(outputLanguage) ? "rtl" : "ltr",
  };
}

const cvSectionHeading = /^(summary|profile|objective|skills|core\s+competencies|work\s+experience|professional\s+experience|employment\s+history|employment|career\s+history|education|certifications?|licenses?|languages?|references?|projects?)$/i;
const mojibakeDashPattern = "\u00e2\u20ac[\u201c\u201d]";
const dateRangePattern = new RegExp(`((?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?\\s+)?(?:19|20)\\d{2})\\s*(?:-|\\u2013|\\u2014|${mojibakeDashPattern}|to|until|till|through)\\s*((?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?\\s+)?(?:19|20)\\d{2}|present|current|till\\s+date|to\\s+date|now)`, "i");
const singleDatePattern = /((?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+)(?:19|20)\d{2})\s*$/i;
const locationPattern = /\b(abu\s*dhabi|ajman|al\s*ain|bahrain|canada|cebu|chennai|cochin|doha|dubai|gcc|india|kerala|kuwait|lagos|london|mangalore|manila|oman|philippines|qatar|riyadh|saudi|sharjah|singapore|toronto|uae|u\.a\.e\.|united\s+arab\s+emirates|uk|usa)\b/i;
const jobTitlePattern = /\b(accountant|admin|analyst|assistant|associate|cashier|clerk|controller|coordinator|counsellor|counselor|developer|driver|electrician|engineer|executive|helper|housekeeper|intern|manager|nanny|officer|operator|plumber|receptionist|representative|sales|secretary|supervisor|support|technician|waiter|warehouse|welder)\b/i;
const employerPattern = /\b(agency|association|bank|company|consultancy|corp|corporation|department|forwarding|fzc|hotel|hypermarket|industries|international|llc|limited|logistics|ltd|mart|restaurant|school|services|shipping|solutions|trading|transport|warehouse)\b/i;
const responsibilityVerbPattern = /^(achieved|assisted|checked|cleaned|communicated|conducted|coordinated|created|delivered|developed|drove|ensured|followed|gained|greeted|handled|helped|improved|installed|maintained|managed|monitored|operated|organized|oversaw|performed|prepared|processed|provided|received|recorded|repaired|reported|resolved|served|supported|supervised|trained|updated|worked)\b/i;

const cleanCvLine = (line) =>
  String(line || "")
    .replace(/[•●▪◦]/g, "-")
    .replace(/\u00e2\u20ac[\u00a2\u201d]\u008f?|\u00e2\u2013[\u00aa\u00a6]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const normalizeImportedDate = (value = "") =>
  cleanCvLine(value)
    .replace(new RegExp(`^(?:-|\\u2013|\\u2014|${mojibakeDashPattern})\\s*`), "")
    .replace(/\btill\s+date\b/i, "Present")
    .replace(/\bto\s+date\b/i, "Present")
    .replace(/\bcurrent\b/i, "Present")
    .replace(/\bnow\b/i, "Present");

const isResponsibilityLine = (line) => {
  const cleaned = cleanCvLine(line);
  return /^[-*]\s+/.test(cleaned) || responsibilityVerbPattern.test(cleaned.replace(/^[-*]\s*/, "")) || cleaned.length > 70;
};

const splitEmployerAndLocation = (value = "") => {
  const cleaned = cleanCvLine(value).replace(/^[-*]\s*/, "");
  if (!cleaned) return { employer: "", companyLocation: "" };
  const separators = [" | ", " - ", "\u2013", "\u2014", ` ${"\u00e2\u20ac\u201c"} `, ` ${"\u00e2\u20ac\u201d"} `];
  for (const separator of separators) {
    if (!cleaned.includes(separator)) continue;
    const parts = cleaned.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2 && locationPattern.test(parts[parts.length - 1])) {
      return { employer: parts.slice(0, -1).join(separator), companyLocation: parts[parts.length - 1] };
    }
  }
  const commaParts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2 && commaParts.slice(1).some((part) => locationPattern.test(part))) {
    return { employer: commaParts[0], companyLocation: commaParts.slice(1).join(", ") };
  }
  return locationPattern.test(cleaned) && !employerPattern.test(cleaned) && !jobTitlePattern.test(cleaned)
    ? { employer: "", companyLocation: cleaned }
    : { employer: cleaned, companyLocation: "" };
};

const parseInlineExperienceHeader = (line = "", match) => {
  const beforeDate = cleanCvLine(line.slice(0, match.index)).replace(new RegExp(`[,;|\\-\\u2013\\u2014\\s]+$|(?:${mojibakeDashPattern})\\s*$`), "");
  if (!beforeDate) return {};
  const atMatch = beforeDate.match(/(.+?)\s+(?:at|with)\s+(.+)$/i);
  if (atMatch) {
    const employerLocation = splitEmployerAndLocation(atMatch[2]);
    return {
      jobTitle: cleanCvLine(atMatch[1]),
      employer: employerLocation.employer,
      companyLocation: employerLocation.companyLocation,
    };
  }
  const separators = [" | ", " - ", "\u2013", "\u2014", ` ${"\u00e2\u20ac\u201c"} `, ` ${"\u00e2\u20ac\u201d"} `];
  for (const separator of separators) {
    if (!beforeDate.includes(separator)) continue;
    const parts = beforeDate.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const employerLocation = splitEmployerAndLocation(parts.slice(1).join(separator));
      return {
        jobTitle: parts[0],
        employer: employerLocation.employer,
        companyLocation: employerLocation.companyLocation,
      };
    }
  }
  const commaParts = beforeDate.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 3 && jobTitlePattern.test(commaParts[0])) {
    const employerLocation = splitEmployerAndLocation(commaParts.slice(1).join(", "));
    return {
      jobTitle: commaParts[0],
      employer: employerLocation.employer,
      companyLocation: employerLocation.companyLocation,
    };
  }
  return jobTitlePattern.test(beforeDate) ? { jobTitle: beforeDate } : splitEmployerAndLocation(beforeDate);
};

const assignExperienceMeta = (beforeMeta, afterMeta, fallbackJobTitle = "") => {
  const entry = {
    ...createExperienceEntry(),
    jobTitle: "",
    employer: "",
    companyLocation: "",
    fromDate: "",
    toDate: "",
    isCurrent: false,
    responsibilities: "",
  };
  const before = beforeMeta.map(cleanCvLine).filter(Boolean);
  const after = afterMeta.map(cleanCvLine).filter(Boolean);
  const titleCandidate = [...before].reverse().find((line) => jobTitlePattern.test(line) && !employerPattern.test(line)) || before[0] || fallbackJobTitle;
  entry.jobTitle = titleCandidate || fallbackJobTitle || "";
  const employerCandidates = [...before, ...after].filter((line) => line !== entry.jobTitle && !dateRangePattern.test(line));
  const employerCandidate = employerCandidates.find((line) => employerPattern.test(line)) || employerCandidates.find((line) => !isResponsibilityLine(line)) || "";
  const employerLocation = splitEmployerAndLocation(employerCandidate);
  entry.employer = employerLocation.employer;
  entry.companyLocation = employerLocation.companyLocation;
  const locationCandidate = employerCandidates.find((line) => line !== employerCandidate && locationPattern.test(line));
  if (!entry.companyLocation && locationCandidate) {
    const split = splitEmployerAndLocation(locationCandidate);
    entry.companyLocation = split.companyLocation || split.employer;
  }
  return entry;
};

const extractStructuredWorkExperiences = (experienceText = "", fallbackJobTitle = "") => {
  const rawLines = String(experienceText || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(cleanCvLine)
    .filter(Boolean)
    .filter((line) => !cvSectionHeading.test(line));
  if (!rawLines.length) return [];

  const dateIndices = rawLines
    .map((line, index) => {
      const rangeMatch = line.match(dateRangePattern);
      const singleMatch = rangeMatch ? null : line.match(singleDatePattern);
      return {
        line,
        index,
        match: rangeMatch || singleMatch,
        isSingleDate: Boolean(singleMatch),
      };
    })
    .filter((item) => item.match);

  if (!dateIndices.length) {
    const duties = rawLines.filter((line) => isResponsibilityLine(line)).map((line) => line.replace(/^[-*]\s*/, ""));
    const meta = rawLines.filter((line) => !isResponsibilityLine(line)).slice(0, 3);
    if (!duties.length && !meta.length) return [];
    return [{
      ...assignExperienceMeta(meta, [], fallbackJobTitle),
      responsibilities: (duties.length ? duties : rawLines).join("\n"),
    }];
  }

  const entries = dateIndices.map(({ line: dateLine, index, match, isSingleDate }, datePosition) => {
    const previousDateIndex = datePosition > 0 ? dateIndices[datePosition - 1].index : -1;
    const nextDateIndex = datePosition < dateIndices.length - 1 ? dateIndices[datePosition + 1].index : rawLines.length;
    const beforeMeta = [];
    for (let pointer = index - 1; pointer > previousDateIndex; pointer -= 1) {
      const line = rawLines[pointer];
      if (isResponsibilityLine(line)) break;
      beforeMeta.unshift(line);
      if (beforeMeta.length >= 3) break;
    }
    const afterMeta = [];
    let dutiesStart = index + 1;
    for (let pointer = index + 1; pointer < nextDateIndex; pointer += 1) {
      const line = rawLines[pointer];
      if (isResponsibilityLine(line) || dateRangePattern.test(line)) break;
      afterMeta.push(line);
      dutiesStart = pointer + 1;
      if (afterMeta.length >= 2) break;
    }
    let duties = rawLines.slice(dutiesStart, nextDateIndex);
    while (duties.length && !isResponsibilityLine(duties[duties.length - 1])) duties = duties.slice(0, -1);
    duties = duties.map((line) => line.replace(/^[-*]\s*/, "")).filter(Boolean);
    const inlineMeta = parseInlineExperienceHeader(dateLine, match);
    const entry = { ...assignExperienceMeta(beforeMeta, afterMeta, fallbackJobTitle), ...inlineMeta };
    if (!entry.companyLocation) {
      const locationAfterDate = afterMeta.find((item) => locationPattern.test(item));
      if (locationAfterDate) entry.companyLocation = splitEmployerAndLocation(locationAfterDate).companyLocation || locationAfterDate;
    }
    entry.fromDate = normalizeImportedDate(match[1]);
    entry.toDate = isSingleDate ? "" : normalizeImportedDate(match[2]);
    entry.isCurrent = /present/i.test(entry.toDate);
    if (entry.isCurrent) entry.toDate = "";
    entry.responsibilities = duties.join("\n") || "Please review imported CV and add responsibilities for this role.";
    return entry;
  }).filter((entry) => entry.jobTitle || entry.employer || entry.responsibilities);
  return sortWorkExperiences(entries);
};

function mockAiExtractCv(text, fileName) {
  const clean = text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
  const lines = clean.split("\n").map((line) => line.trim()).filter(Boolean);
  const firstPageText = lines.slice(0, 24).join(" ");
  if (/(codex\s+developer\s+handoff|client-rendered\s+spa|root\s+cause|features?\s+\d+\s*(?:-|to|through)\s*\d+|prompt\s+batch|traffic\s+growth\s+context)/i.test(firstPageText)) {
    throw new Error("This file looks like a project brief or prompt, not a CV. Please upload the applicant's actual CV or resume file.");
  }
  const email = clean.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const rawPhone = clean.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim();
  const phone = rawPhone && rawPhone.replace(/\D/g, "").length >= 8 && rawPhone.length <= 28 ? rawPhone : "";
  const linkedIn = clean.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0] || clean.match(/linkedin\.com\/[^\s)]+/i)?.[0];
  const urlMatches = clean.match(/https?:\/\/[^\s)]+/gi) || [];
  const portfolioUrl = urlMatches.find((url) => !/linkedin\.com/i.test(url)) || "";
  const nationality = clean.match(/nationality\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim();
  const visaStatus = clean.match(/visa\s*(?:status)?\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim();
  const drivingLicense = clean.match(/(?:driving|driver'?s?)\s+licen[cs]e\s*[:\-]?\s*([^\n]*)/i)?.[0]?.trim();
  const headingPattern = /summary|profile|objective|skills|core competencies|experience|professional experience|employment|work history|education|certification|certificate|language|reference|contact|nationality|visa|driving|linkedin|portfolio|curriculum|resume|cv/i;
  const hasCvSignals = Boolean(email || phone || linkedIn) || lines.some((line) => /^(professional\s+summary|summary|profile|objective|skills|core\s+competencies|professional\s+experience|work\s+experience|employment\s+history|education|certifications?|languages?)$/i.test(line));
  if (!hasCvSignals) {
    throw new Error("Could not identify this file as a CV. Please upload a readable CV with contact details, work experience, education, or skills sections.");
  }
  const firstLine = lines.find((line) => !line.includes("@") && !headingPattern.test(line) && !/^\+?\d/.test(line) && line.length <= 60 && /[a-z]/i.test(line));
  const compactText = lines.join("\n");
  const section = (names, maxLines = 6) => {
    const index = lines.findIndex((line) => names.some((name) => new RegExp(`^${name}\\b`, "i").test(line) || line.toLowerCase() === name));
    if (index === -1) return "";
    const nextIndex = lines.findIndex((line, lineIndex) => lineIndex > index && /^(summary|profile|objective|skills|core\s+competencies|work\s+experience|professional\s+experience|employment\s+history|employment|career\s+history|work\s+history|education|projects?|certifications?|certificates?|languages?|references?)$/i.test(line));
    return lines.slice(index + 1, nextIndex === -1 ? Math.min(lines.length, index + 1 + maxLines) : nextIndex).join("\n").trim();
  };
  const skills = section(["skills", "core competencies"], 20);
  const experience = section(["experience", "professional experience", "employment", "employment history", "work history", "career history"], 120);
  const education = section(["education"], 14);
  const projects = section(["project", "projects"], 30);
  const certifications = section(["certification", "certificate"], 10);
  const languages = section(["language"], 8);
  const summary = section(["summary", "profile", "objective"], 4);
  const jobTitle = lines.find((line, index) => index > 0 && index < 8 && !line.includes("@") && !phone?.includes(line) && !headingPattern.test(line) && line.length <= 70);
  const summaryFallback = (() => {
    const stopIndex = lines.findIndex((line) => /^(core\s+competencies|skills|professional\s+experience|work\s+experience|employment|education)$/i.test(line));
    const usableLines = lines
      .slice(1, stopIndex === -1 ? Math.min(lines.length, 8) : stopIndex)
      .filter((line) => line.length > 35)
      .filter((line) => !line.includes("@") && !/linkedin|https?:|^\+?\d/.test(line))
      .filter((line) => !headingPattern.test(line));
    return usableLines.join(" ").trim();
  })();
  const structuredWorkExperiences = extractStructuredWorkExperiences(experience, jobTitle || "");
  const fallbackWorkExperiences = [
    {
      ...createExperienceEntry(),
      jobTitle: jobTitle || "",
      employer: "",
      companyLocation: "",
      fromDate: "",
      toDate: "",
      isCurrent: false,
      responsibilities: experience || "Please review imported CV and add work experience here.",
    },
  ];
  return {
    fullName: firstLine || fileName.replace(/\.[^.]+$/, "").replaceAll("-", " "),
    jobTitle: jobTitle || "",
    email: email || "",
    phone: phone || "",
    nationality: nationality || "",
    visaStatus: visaStatus || "",
    linkedIn: linkedIn || "",
    portfolioUrl,
    drivingLicense: drivingLicense || "Add driving license status here.",
    summary: sanitizeCvTextForCoverLetter(summary || summaryFallback || compactText.split("\n").filter((line) => line.length > 40 && !line.includes("@") && !/linkedin/i.test(line)).slice(0, 2).join(" ")) || "Please review imported CV and add a professional summary here.",
    skills: sanitizeCvTextForCoverLetter(skills) || "Please review imported CV and add key skills here.",
    experience: experience || "Please review imported CV and add work experience here.",
    workExperiences: structuredWorkExperiences.length ? structuredWorkExperiences : fallbackWorkExperiences,
    education: education || "Please review imported CV and add education details here.",
    projects,
    certifications: certifications || "Add certificates or training here.",
    languages: languages || "English",
    references: section(["reference"]) || "Available upon request",
    originalLanguage: "Auto-detected",
    outputLanguage: "English",
    languageDirection: "ltr",
  };
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

function PageMarginSelector({ value, onChange }) {
  const margin = normalizePageMargin(value);
  const [customValue, setCustomValue] = useState(margin.type === "custom" ? String(margin.value) : "1");
  const [customUnit, setCustomUnit] = useState(margin.type === "custom" ? margin.unit : "in");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = normalizePageMargin(value);
    if (next.type === "custom") {
      setCustomValue(String(next.value));
      setCustomUnit(next.unit);
    }
  }, [value]);

  const applyCustom = (nextValue = customValue, nextUnit = customUnit) => {
    const numeric = Number(nextValue);
    if (!String(nextValue).trim() || !Number.isFinite(numeric) || numeric <= 0) {
      setError("Enter a positive margin value.");
      return;
    }
    setError("");
    onChange({ type: "custom", value: numeric, unit: nextUnit });
  };

  const choose = (next) => {
    setError("");
    if (next.type === "custom") {
      applyCustom(customValue, customUnit);
      return;
    }
    onChange(next);
  };

  const active = (type, unit, presetValue) => {
    if (type === "default") return margin.type === "default";
    if (type === "custom") return margin.type === "custom";
    return margin.type === "preset" && margin.unit === unit && Number(margin.value) === Number(presetValue);
  };

  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h3 className="panel-title">Page Margins</h3>
      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">Controls spacing around every CV page before download.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          ["Default", { type: "default" }],
          ["5 cm", { type: "preset", value: 5, unit: "cm" }],
          ["1 inch", { type: "preset", value: 1, unit: "in" }],
          ["Custom", { type: "custom" }],
        ].map(([label, option]) => (
          <button
            key={label}
            type="button"
            onClick={() => choose(option)}
            className={`rounded border px-3 py-2 text-sm font-black ${active(option.type, option.unit, option.value) ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {margin.type === "custom" && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={customValue}
            onChange={(event) => {
              setCustomValue(event.target.value);
              applyCustom(event.target.value, customUnit);
            }}
            onBlur={() => applyCustom()}
            className="form-field"
            aria-label="Custom page margin value"
          />
          <select
            value={customUnit}
            onChange={(event) => {
              setCustomUnit(event.target.value);
              applyCustom(customValue, event.target.value);
            }}
            className="form-field"
            aria-label="Custom page margin unit"
          >
            <option value="cm">cm</option>
            <option value="in">inch</option>
          </select>
        </div>
      )}
      {error && <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs font-bold text-red-700">{error}</p>}
    </section>
  );
}

const contactIconPaths = {
  location: "M12 21s7-4.7 7-11a7 7 0 1 0-14 0c0 6.3 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  email: "M3 6.5h18v11H3v-11Zm1.8 1.6 7.2 5.1 7.2-5.1M4.8 16l5.3-4M19.2 16l-5.3-4",
  phone: "M7 4h4l1 5-2.5 1.5A13 13 0 0 0 14 15l1.5-2.5 5 1v4c0 1.1-.9 2-2 2A14.5 14.5 0 0 1 4 5.9C4 4.8 4.9 4 6 4h1Z",
  linkedin: "M5 8.5h3v10H5v-10ZM6.5 5a1.7 1.7 0 1 1 0 3.4A1.7 1.7 0 0 1 6.5 5Zm4 3.5h2.9v1.4h.1c.4-.8 1.4-1.6 2.9-1.6 3 0 3.6 2 3.6 4.6v5.6h-3v-5c0-1.2 0-2.7-1.7-2.7s-1.9 1.3-1.9 2.6v5.1h-3v-10Z",
  link: "M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1",
};

function ContactIcon({ type }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 flex-none fill-current stroke-current stroke-[0.35]">
      <path d={contactIconPaths[type] || contactIconPaths.link} />
    </svg>
  );
}

const cvContactItems = (cv) =>
  [
    cv.country && { type: "location", text: cv.country },
    cv.email && { type: "email", text: cv.email },
    cv.phone && { type: "phone", text: cv.phone },
    cv.linkedIn && { type: "linkedin", text: cv.linkedIn.replace(/^https?:\/\/(www\.)?/i, "") },
    cv.portfolioUrl && { type: "link", text: cv.portfolioUrl.replace(/^https?:\/\/(www\.)?/i, "") },
  ].filter(Boolean);

function ContactItem({ item, compact = false }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${compact ? "" : "mr-3"}`}>
      <ContactIcon type={item.type} />
      <span className="break-words">{item.text}</span>
    </span>
  );
}

function LiveCVPreview({ cv, theme, layout }) {
  const isRtl = cv.languageDirection === "rtl" || isArabicLanguage(cv.outputLanguage);
  const pageMarginCss = pageMarginToCss(cv.pageMargin);
  const previewMarginPx = Math.min(260, Math.max(0, pageMarginToInches(cv.pageMargin) * 96));
  const pageMarginStyle = { padding: `${previewMarginPx}px`, "--cv-page-margin": pageMarginCss };
  const lines = (value) => String(value || "").split("\n").filter(Boolean);
  const chunks = (items, size) => {
    const result = [];
    for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
    return result.length ? result : [[]];
  };
  const contactItems = cvContactItems(cv);
  const personalDetails = [
    cv.nationality && `Nationality: ${cv.nationality}`,
    cv.visaStatus && `Visa Status: ${cv.visaStatus}`,
    cv.drivingLicense && `Driving License: ${cv.drivingLicense}`,
    cv.expectedSalaryEnabled && cv.expectedSalary && `Expected Salary: ${cv.expectedSalary}`,
  ].filter(Boolean);
  const photo = (size = "h-16 w-16") =>
    cv.profilePhoto ? (
      <img src={cv.profilePhoto} alt={`${cv.fullName} profile`} className={`${size} object-cover ${photoShapeClass(cv.photoShape, "rounded-xl")}`} />
    ) : null;
  const section = (title, content, list = false) => (
    <section className="break-inside-avoid">
      <h3 className="cv-section-title" style={{ color: theme.dark, borderColor: theme.color }}>{title}</h3>
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
        <h3 className="cv-section-title" style={{ color: theme.dark, borderColor: theme.color }}>References</h3>
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
      {block.showTitle && <h3 className="cv-section-title" style={{ color: theme.dark, borderColor: theme.color }}>{block.title}</h3>}
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
    if (current.length && currentWeight + block.weight > pageLimit) acc.push([block]);
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
            <img src={cv.profilePhoto} alt={`${cv.fullName} profile`} className={`profile-photo ${cv.photoShape === "circle" || cv.photoShape === "round" ? "round" : cv.photoShape === "rounded" ? "rounded" : "square"}`} />
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
        {contactItems.map((item) => (
          <p key={`${item.type}-${item.text}`} className="flex min-w-0 items-start gap-2">
            <ContactIcon type={item.type} />
            <span className="break-words">{item.text}</span>
          </p>
        ))}
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
      {photo("h-20 w-20")}
      <div>
        <h2 className="text-2xl font-black leading-tight">{cv.fullName}</h2>
        <p className={`mt-1 text-sm font-bold ${layout === "header" ? "text-white/90" : "text-blue-700"}`} style={layout === "header" ? {} : { color: theme.color }}>{cv.jobTitle}</p>
        <p className={`mt-3 flex flex-wrap gap-y-1 text-[11px] ${layout === "header" ? "text-white/80" : "text-slate-500"}`}>
          {contactItems.map((item) => <ContactItem key={`${item.type}-${item.text}`} item={item} />)}
        </p>
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
      <p className="flex flex-wrap gap-y-1">
        {contactItems.filter((item) => ["location", "email", "phone"].includes(item.type)).map((item) => <ContactItem key={`${item.type}-${item.text}`} item={item} compact />)}
      </p>
    </header>
  );
  return (
    <div className={`cv-page-stack ${isRtl ? "cv-rtl" : ""}`} dir={isRtl ? "rtl" : "ltr"} aria-label={`${pages.length} page CV preview`}>
      {pages.map((pageBlocks, pageIndex) => pageIndex > 0 ? (
        <article key={pageIndex} className={`cv-paper cv-paper-page ${isRtl ? "cv-rtl" : ""} ${layout === "compact" ? "p-6" : "p-8"}`} style={pageMarginStyle}>
          {renderContinuationHeader()}
          <div className="mt-6">{renderPageContent(pageBlocks)}</div>
          {cv.qrCode?.position === "footer" && pageIndex === pages.length - 1 && <div className="mt-6 flex justify-center"><QrBlock qrCode={cv.qrCode} color="#1E293B" /></div>}
          <p className="cv-page-number">Page {pageIndex + 1} of {pages.length}</p>
        </article>
      ) : layout === "sidebar" ? (
        <article key={pageIndex} className={`cv-paper cv-paper-page grid grid-cols-[0.38fr_0.62fr] overflow-hidden p-0 ${isRtl ? "cv-rtl" : ""}`} style={pageMarginStyle}>
          {renderSidebar(pageIndex)}
          <div className="p-7">
            {renderPageContent(pageBlocks)}
            <p className="cv-page-number">Page {pageIndex + 1} of {pages.length}</p>
          </div>
        </article>
      ) : (
        <article key={pageIndex} className={`cv-paper cv-paper-page ${isRtl ? "cv-rtl" : ""} ${layout === "compact" ? "p-6" : "p-8"}`} style={pageMarginStyle}>
          {renderHeader()}
          <div className="mt-6">{renderPageContent(pageBlocks)}</div>
          {cv.qrCode?.position === "footer" && pageIndex === pages.length - 1 && <div className="mt-6 flex justify-center"><QrBlock qrCode={cv.qrCode} color="#1E293B" /></div>}
          <p className="cv-page-number">Page {pageIndex + 1} of {pages.length}</p>
        </article>
      ))}
    </div>
  );
}

function DownloadModal({ cv, onClose, onVerifiedDownload, canEmailCopy = false, emailCopyAddress = "", title = "Verify to download", description = "Enter your contact details. We will send an OTP before unlocking downloads.", label = "Downloads" }) {
  const [details, setDetails] = useState({ name: cv.fullName, email: cv.email, country: cv.country, phone: cv.phone });
  const [otp, setOtp] = useState("");
  const [otpChallenge, setOtpChallenge] = useState(null);
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
    setOtpChallenge(null);
    try {
      const response = await fetch("/.netlify/functions/emailOtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email: details.email, name: details.name, purpose: "download" }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Could not send OTP.");
      setOtpChallenge(result.challenge);
      setActionStatus(result.message || "OTP sent. Enter the code to unlock downloads.");
    } catch (error) {
      setActionStatus(error.message || "Could not send OTP. Please try again.");
    }
  };
  const verify = async () => {
    try {
      const response = await fetch("/.netlify/functions/emailOtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: details.email, otp, challenge: otpChallenge, purpose: "download" }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Invalid OTP.");
      setVerified(true);
      setActionStatus("OTP verified. Downloads are unlocked.");
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
          <button onClick={onClose} className="text-2xl leading-none text-slate-500">Ã—</button>
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
            <div className="mt-3 flex gap-2">
              <input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" maxLength={6} className="form-field" placeholder="Enter 6-digit OTP" />
              <button onClick={verify} className="rounded bg-green-600 px-5 py-3 font-bold text-white">Verify</button>
            </div>
            {verified && <p className="mt-3 text-sm font-bold text-green-800">OTP verified. {label} are unlocked.</p>}
          </div>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button disabled={!verified} onClick={() => runDownloadAction("pdf")} className="rounded bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Download PDF</button>
          <button disabled={!verified} onClick={() => runDownloadAction("word")} className="rounded border border-blue-600 px-5 py-3 font-bold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">Download DOCX</button>
          {canEmailCopy ? (
            <button disabled={!verified} onClick={() => runDownloadAction("email")} className="rounded border border-green-600 bg-green-50 px-5 py-3 font-bold text-green-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-white disabled:text-slate-400 sm:col-span-2">
              Email CV copy to {emailCopyAddress || details.email}
            </button>
          ) : (
            <p className="rounded bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-900 sm:col-span-2">
              Sign in or create an account if you want BuildMyCVNow to save CVs online and email generated CV copies.
            </p>
          )}
        </div>
        {actionStatus && <p className="mt-3 rounded bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-700">{actionStatus}</p>}
      </div>
    </div>
  );
}

function AuthModal({ onClose, onUrgentMode, onRegisteredMode, onAuthenticated }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accountOtp, setAccountOtp] = useState({ name: "", email: "", phone: "", token: "", sent: false, channel: "email" });
  const [signupOtp, setSignupOtp] = useState({ sent: false, token: "", challenge: null });
  const [message, setMessage] = useState(isSupabaseConfigured ? "" : "Add VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY to .env to enable login.");
  const [loading, setLoading] = useState(false);
  const [lastSignupEmail, setLastSignupEmail] = useState("");
  const startUrgentMode = () => {
    trackEvent("urgent_mode_start", { method: "local" });
    onUrgentMode("local");
    onClose();
  };
  const finishAuthenticated = async (nextSession = null) => {
    let resolvedSession = nextSession;
    if (!resolvedSession && supabase) {
      const { data } = await supabase.auth.getSession();
      resolvedSession = data?.session || null;
    }
    if (resolvedSession) onAuthenticated?.(resolvedSession);
    onRegisteredMode();
    onClose();
  };
  const verifyHuman = async (action) => {
    if (!isRecaptchaConfigured) return "";
    const captchaToken = await getRecaptchaToken(action);
    const captchaResponse = await fetch("/.netlify/functions/verifyRecaptcha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: captchaToken, action }),
    });
    const captchaResult = await captchaResponse.json().catch(() => ({}));
    if (!captchaResponse.ok || captchaResult.success === false) {
      throw new Error(captchaResult.error || captchaResult.message || "reCAPTCHA verification failed. Please try again.");
    }
    return captchaToken;
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    try {
      const captchaToken = await verifyHuman(mode === "signup" ? "signup" : "signin");
      if (mode === "signup") {
        if (!signupOtp.sent) {
          const response = await fetch("/.netlify/functions/emailOtp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "send", email: form.email, name: form.name, purpose: "signup" }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.ok) throw new Error(result.message || "Could not send signup OTP.");
          setSignupOtp({ sent: true, token: "", challenge: result.challenge });
          setLastSignupEmail(form.email);
          setMessage("Verification code sent. Please check your inbox and spam folder, then enter the 6-digit code here.");
          return;
        }
        const signupResponse = await fetch("/.netlify/functions/verifiedSignup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            name: form.name,
            otp: signupOtp.token,
            challenge: signupOtp.challenge,
            purpose: "signup",
          }),
        });
        const signupResult = await signupResponse.json().catch(() => ({}));
        if (!signupResponse.ok || !signupResult.ok) {
          const alreadyHasAccount = signupResponse.status === 409 || /already has an account|already|registered|exists/i.test(signupResult.message || "");
          if (alreadyHasAccount) {
            const { data: existingLoginData, error: existingLoginError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password, captchaToken });
            if (existingLoginError) {
              throw new Error("This email already has an account. Please use the Login tab with the same email and password.");
            }
            trackEvent("login", { method: "existing_signup_email" });
            setSignupOtp({ sent: false, token: "", challenge: null });
            setMessage("Account already exists. Signed in and opening your dashboard.");
            await finishAuthenticated(existingLoginData?.session);
            return;
          }
          throw new Error(signupResult.message || "Could not create account.");
        }
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password, captchaToken });
        if (loginError) throw loginError;
        trackEvent("signup", { method: "email_otp" });
        setSignupOtp({ sent: false, token: "", challenge: null });
        setMessage("Account created and signed in successfully.");
        await finishAuthenticated(loginData?.session);
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password, captchaToken });
      if (error) throw error;
      trackEvent("login", { method: "email" });
      setMessage("Signed in successfully.");
      await finishAuthenticated(data?.session);
    } catch (error) {
      const errorMessage = error.message || "Authentication failed.";
      setMessage(
        /invalid login credentials/i.test(errorMessage)
          ? "Password not recognized. Use the Sign up tab to verify your email OTP and set a new password, or use Continue with Google."
          : errorMessage
      );
    } finally {
      setLoading(false);
    }
  };
  const resendConfirmation = async () => {
    if (!supabase || !lastSignupEmail) return;
    setLoading(true);
    setMessage("Sending confirmation email again...");
    try {
      const captchaToken = await verifyHuman("resend_confirmation");
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: lastSignupEmail,
        options: { emailRedirectTo: AUTH_REDIRECT_URL, captchaToken },
      });
      if (error) {
        const fallback = await fetch("/.netlify/functions/resendSignupConfirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: lastSignupEmail }),
        });
        if (!fallback.ok) throw error;
      }
      trackEvent("signup_confirmation_resend");
      setMessage("Confirmation email sent again. Please check your inbox and spam folder.");
    } catch (error) {
      setMessage(error.message || "Could not resend confirmation email.");
    } finally {
      setLoading(false);
    }
  };
  const signInWithGoogle = async () => {
    if (!supabase) return;
    setLoading(true);
    setMessage("Opening Google sign in...");
    try {
      await verifyHuman("google_signin");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: AUTH_REDIRECT_URL },
      });
      if (error) throw error;
      onRegisteredMode();
    } catch (error) {
      setMessage(error.message || "Google sign in could not start. Please check the Google provider settings in Supabase.");
    } finally {
      setLoading(false);
    }
  };
  const sendEmailSignInLink = async () => {
    if (!supabase || !form.email) {
      setMessage("Enter your email address first, then request the sign-in link.");
      return;
    }
    setLoading(true);
    setMessage("Sending sign-in link to your email...");
    try {
      const captchaToken = await verifyHuman("signin_link");
      const { error } = await supabase.auth.signInWithOtp({
        email: form.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: AUTH_REDIRECT_URL,
          captchaToken,
        },
      });
      if (error) throw error;
      trackEvent("login_link_sent", { method: "email" });
      setMessage("Sign-in link sent. Please check your inbox and spam folder, then open the link from the same device.");
    } catch (error) {
      setMessage(error.message || "Could not send the sign-in link. Check Supabase email settings or try Google sign in.");
    } finally {
      setLoading(false);
    }
  };
  const sendAccountEmailOtp = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("Sending account verification code...");
    try {
      const captchaToken = await verifyHuman("account_email_otp");
      const { error } = await supabase.auth.signInWithOtp({
        email: accountOtp.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: AUTH_REDIRECT_URL,
          data: { full_name: accountOtp.name },
          captchaToken,
        },
      });
      if (error) throw error;
      setAccountOtp((current) => ({ ...current, sent: true, token: "", channel: "email" }));
      trackEvent("account_email_otp_sent");
      setMessage("Account email sent. Enter the full code from your email. If Supabase sends a sign-in link, click that link to open your account.");
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
      const { data, error } = await supabase.auth.verifyOtp({
        email: accountOtp.email,
        token: accountOtp.token.trim(),
        type: "email",
      });
      if (error) throw error;
      trackEvent("account_email_otp_verified");
      await finishAuthenticated(data?.session);
    } catch (error) {
      setMessage(error.message || "Invalid account OTP.");
    } finally {
      setLoading(false);
    }
  };
  const sendAccountMobileOtp = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("Sending mobile OTP...");
    try {
      const captchaToken = await verifyHuman("account_mobile_otp");
      const { error } = await supabase.auth.signInWithOtp({
        phone: accountOtp.phone,
        options: { shouldCreateUser: true, captchaToken },
      });
      if (error) throw error;
      setAccountOtp((current) => ({ ...current, sent: true, token: "", channel: "mobile" }));
      trackEvent("account_mobile_otp_sent");
      setMessage("Mobile OTP sent. Enter the SMS code here.");
    } catch (error) {
      setMessage(error.message || "Could not send mobile OTP. Check that phone OTP is enabled in Supabase.");
    } finally {
      setLoading(false);
    }
  };
  const verifyAccountMobileOtp = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("Verifying mobile OTP...");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: accountOtp.phone,
        token: accountOtp.token,
        type: "sms",
      });
      if (error) throw error;
      trackEvent("account_mobile_otp_verified");
      await finishAuthenticated(data?.session);
    } catch (error) {
      setMessage(error.message || "Invalid mobile OTP.");
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
          <button onClick={onClose} className="text-2xl leading-none text-slate-500">x</button>
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["signin", "Login"],
            ["signup", "Sign up"],
            ["accountOtp", "Email OTP"],
            ["mobileOtp", "Mobile OTP"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setMode(id);
                setAccountOtp((current) => ({ ...current, token: "", sent: false, channel: id === "mobileOtp" ? "mobile" : "email" }));
                setSignupOtp({ sent: false, token: "", challenge: null });
              }}
              className={`rounded px-4 py-3 text-sm font-black ${mode === id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}
            >
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
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={accountOtp.token}
                  onChange={(event) => setAccountOtp({ ...accountOtp, token: event.target.value.replace(/\D/g, "").slice(0, 8) })}
                  placeholder="Enter the full email code"
                  required
                />
              </label>
            )}
            <button disabled={!isSupabaseConfigured || loading} className="rounded bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {loading ? "Please wait..." : accountOtp.sent ? "Verify OTP and open account" : "Send email OTP"}
            </button>
            <p className="rounded bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
              Free account mode lets you save up to 10 CVs online and generate/save up to 10 CVs per day. Saved CVs expire after 15 days.
            </p>
            {isRecaptchaConfigured && <p className="text-xs font-bold text-slate-500">Protected by Google reCAPTCHA.</p>}
          </form>
        ) : mode === "mobileOtp" ? (
          <form onSubmit={accountOtp.sent && accountOtp.channel === "mobile" ? verifyAccountMobileOtp : sendAccountMobileOtp} className="mt-5 grid gap-3">
            <label>
              <span className="form-label">Registered mobile number</span>
              <input className="form-field" type="tel" value={accountOtp.phone} onChange={(event) => setAccountOtp({ ...accountOtp, phone: event.target.value })} placeholder="+971501234567" required disabled={accountOtp.sent && accountOtp.channel === "mobile"} />
            </label>
            {accountOtp.sent && accountOtp.channel === "mobile" && (
              <label>
                <span className="form-label">Mobile OTP code</span>
                <input className="form-field" inputMode="numeric" maxLength={6} value={accountOtp.token} onChange={(event) => setAccountOtp({ ...accountOtp, token: event.target.value })} required />
              </label>
            )}
            <button disabled={!isSupabaseConfigured || loading} className="rounded bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {loading ? "Please wait..." : accountOtp.sent && accountOtp.channel === "mobile" ? "Verify mobile OTP and open account" : "Send mobile OTP"}
            </button>
            <p className="rounded bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
              Mobile OTP requires phone auth and an SMS provider to be enabled in Supabase.
            </p>
            {isRecaptchaConfigured && <p className="text-xs font-bold text-slate-500">Protected by Google reCAPTCHA.</p>}
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
            <input
              className="form-field"
              type="email"
              value={form.email}
              onChange={(event) => {
                setForm({ ...form, email: event.target.value });
                setSignupOtp({ sent: false, token: "", challenge: null });
              }}
              required
              disabled={mode === "signup" && signupOtp.sent}
            />
          </label>
          <label>
            <span className="form-label">Password</span>
            <input
              className="form-field"
              type="password"
              minLength={6}
              value={form.password}
              onChange={(event) => {
                setForm({ ...form, password: event.target.value });
                setSignupOtp({ sent: false, token: "", challenge: null });
              }}
              required
              disabled={mode === "signup" && signupOtp.sent}
            />
          </label>
          {mode === "signup" && signupOtp.sent && (
            <label>
              <span className="form-label">Email verification code</span>
              <input
                className="form-field"
                inputMode="numeric"
                maxLength={6}
                value={signupOtp.token}
                onChange={(event) => setSignupOtp({ ...signupOtp, token: event.target.value })}
                placeholder="6-digit code"
                required
              />
              <span className="mt-2 block text-xs font-bold leading-5 text-slate-500">
                Enter the code from your email, then click the green proceed button to create your account and open the dashboard.
              </span>
            </label>
          )}
          {isRecaptchaConfigured && <p className="text-xs font-bold text-slate-500">Protected by Google reCAPTCHA.</p>}
          <button disabled={!isSupabaseConfigured || loading} className="rounded bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? "Please wait..." : mode === "signin" ? "Login" : signupOtp.sent ? "Proceed: create account and open dashboard" : "Send signup OTP"}
          </button>
          {mode === "signup" && signupOtp.sent && (
            <button
              type="button"
              disabled={loading}
              onClick={() => setSignupOtp({ sent: false, token: "", challenge: null })}
              className="rounded border border-slate-300 px-5 py-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Change email or resend code
            </button>
          )}
          {mode === "signin" && (
            <button
              type="button"
              disabled={!isSupabaseConfigured || loading}
              onClick={sendEmailSignInLink}
              className="rounded border border-blue-600 px-5 py-3 font-bold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
            >
              Send email sign-in link
            </button>
          )}
        </form>
        )}
        <button disabled={!isSupabaseConfigured || loading} onClick={signInWithGoogle} className="mt-3 w-full rounded border border-blue-600 px-5 py-3 font-bold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">
          Continue with Google
        </button>
        <p className="mt-2 rounded bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
          Use Google sign in to save CVs online without waiting for an email link.
        </p>
        {lastSignupEmail && (
          <button disabled={loading} onClick={resendConfirmation} className="mt-3 w-full rounded border border-green-600 px-5 py-3 font-bold text-green-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">
            Resend confirmation email
          </button>
        )}
        {message && <p className="mt-4 rounded bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-700">{message}</p>}
      </div>
    </div>
  );
}

function MyCvsPanel({ user, cv, categoryId, themeId, layoutId, onLoad, onSaveDraft, onLoadDraft, draftStatus, refreshKey = 0 }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(user ? "Load your saved CVs." : `Login to save and manage up to ${SAVED_CV_LIMIT} CVs.`);
  const formatDateTime = (value) => {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const formatDate = (value) => {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };
  const expiryDateFor = (item) => {
    if (item.expires_at) return item.expires_at;
    if (!item.created_at) return "";
    return new Date(new Date(item.created_at).getTime() + SAVED_CV_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  };
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
  }, [user?.id, refreshKey]);
  const saveCurrent = async () => {
    if (!user) {
      setMessage("Please login first.");
      return;
    }
    try {
      await saveCvForUser({ userId: user.id, cv, categoryId, themeId, layoutId });
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
    <section id="account-dashboard" className="scroll-mt-28 rounded border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="panel-title">Account dashboard</h3>
          <p className="mt-1 text-[11px] font-bold text-slate-500">{items.length} saved version{items.length === 1 ? "" : "s"} of {SAVED_CV_LIMIT}</p>
        </div>
        <button onClick={saveCurrent} className="rounded bg-green-600 px-3 py-2 text-xs font-black text-white">Save</button>
      </div>
      <div className="mt-3 rounded border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs font-black text-blue-950">Save progress and come back later</p>
        <p className="mt-1 text-xs font-bold leading-5 text-blue-800">{draftStatus || "Cloud draft sync is ready."}</p>
        <p className="mt-1 text-xs font-bold leading-5 text-blue-900">Saved CVs are stored for {SAVED_CV_RETENTION_DAYS} days from their creation date, then removed automatically. Download your files regularly.</p>
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
            <p className="text-xs font-bold text-slate-500">{item.category_id || "CV version"}</p>
            <dl className="mt-2 grid gap-1 rounded bg-slate-50 p-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="font-black text-slate-800">Date created</dt>
                <dd>{formatDateTime(item.created_at)}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-800">Expiration date</dt>
                <dd className="font-bold text-amber-700">{formatDate(expiryDateFor(item))}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-black text-slate-800">Last updated</dt>
                <dd>{formatDateTime(item.updated_at || item.created_at)}</dd>
              </div>
            </dl>
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
        <p className="whitespace-pre-line text-justify">{cleanLetter.opening}</p>
        <p className="whitespace-pre-line text-justify">{cleanLetter.body}</p>
        {cleanLetter.qualifications && <p className="whitespace-pre-line text-justify">{cleanLetter.qualifications}</p>}
        {cleanLetter.value && <p className="whitespace-pre-line text-justify">{cleanLetter.value}</p>}
        <p className="whitespace-pre-line text-justify">{cleanLetter.closing}</p>
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
      description="Enter your contact details to receive an email OTP before unlocking your free cover letter download."
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
  { id: "personal", label: "Personal info" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "summary", label: "Summary" },
];

const builderProgressSteps = [
  { id: "template", label: "Template" },
  ...builderSteps,
  { id: "download", label: "Preview & download" },
];

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
    template: true,
    personal: Boolean(cv.fullName && cv.email && cv.phone && cv.country),
    experience: normalizeWorkExperiences(cv).some((entry) => entry.employer && entry.responsibilities),
    education: Boolean(cv.education),
    skills: Boolean(cv.skills && cv.languages),
    summary: Boolean(cv.summary && cv.summary.length > 40),
    download: getCompleteness(cv).score >= 80,
  };
}

function BuilderProgressBar({ currentStep, completedSteps, onStep }) {
  const currentIndex = Math.max(0, builderProgressSteps.findIndex((step) => step.id === currentStep));
  const progress = Math.round((currentIndex / Math.max(1, builderProgressSteps.length - 1)) * 100);
  return (
    <section className="builder-progress-bar" aria-label="Builder progress">
      <div className="builder-progress-mobile">
        <button type="button" onClick={() => onStep(builderProgressSteps[Math.max(0, currentIndex - 1)].id)} aria-label="Previous step">
          <Icon name="chevron" className="h-4 w-4 rotate-90" />
        </button>
        <div>
          <p>Step {currentIndex + 1} of {builderProgressSteps.length}</p>
          <strong>{builderProgressSteps[currentIndex]?.label || "Builder"}</strong>
        </div>
        <span>{progress}% done</span>
      </div>
      <div className="builder-progress-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <nav className="builder-progress-steps">
        {builderProgressSteps.map((step, index) => {
          const done = completedSteps[step.id] || index < currentIndex;
          const active = step.id === currentStep;
          return (
            <button key={step.id} type="button" onClick={() => (step.id === "download" ? onStep("download") : onStep(step.id))} className={`${active ? "active" : ""} ${done ? "done" : ""}`}>
              <span>{done ? <Icon name="check" className="h-3 w-3" /> : index + 1}</span>
              {step.label}
            </button>
          );
        })}
      </nav>
    </section>
  );
}

function BuilderTopBar({ onHome, onDownload, saveStatus }) {
  const { mode, setMode, cycleMode } = useTheme();
  const isSaving = /saving/i.test(saveStatus);
  return (
    <header className="builder-topbar">
      <button onClick={onHome} className="builder-logo">
        <span className="builder-logo-icon"><Icon name="file" className="h-5 w-5" /></span>
        BuildMyCV<span>Now</span>
      </button>
      <div className="builder-topbar-actions">
        <ThemeToggle mode={mode} setMode={setMode} cycleMode={cycleMode} />
        <span className={isSaving ? "builder-save-badge saving" : "builder-save-badge saved"}>
          <Icon name={isSaving ? "sparkle" : "check"} className="h-3 w-3" />
          {isSaving ? "Saving..." : "Saved"}
        </span>
        <button onClick={onDownload} className="builder-download-button">
          <Icon name="download" className="h-4 w-4" /> Download PDF
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

function CompletionBar({ completion, onNextStep }) {
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
    </section>
  );
}

function DraftRecoveryBanner({ draft, onContinue, onStartFresh }) {
  if (!draft) return null;
  const savedValue = draft.updatedAt || draft.savedAt || draft.createdAt;
  const savedDate = savedValue ? new Date(savedValue) : null;
  const ageMinutes = savedDate && !Number.isNaN(savedDate.getTime())
    ? Math.max(0, Math.round((Date.now() - savedDate.getTime()) / 60000))
    : null;
  return (
    <section className="draft-recovery-banner" aria-label="Saved browser draft">
      <div>
        <strong>You have a saved draft{ageMinutes !== null ? ` from ${ageMinutes} min ago` : ""}</strong>
        <p>Continue where you left off, or clear it and start a fresh CV.</p>
      </div>
      <div>
        <button type="button" onClick={onContinue}>Continue draft</button>
        <button type="button" onClick={onStartFresh}>Start fresh</button>
      </div>
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

function BuilderSidebar({ currentStep, onStep, completedSteps, categoryId, onCategory, themeId, onTheme }) {
  const prominent = ["hospitality", "it", "supply-chain-logistics", "finance", "engineering", "domestic", "skilled", "education"];
  const sortedCategories = [...categories].sort((a, b) => prominent.indexOf(a.id) - prominent.indexOf(b.id));
  return (
    <aside className="builder-sidebar-v2">
      <p className="sidebar-label-v2">Sections</p>
      <nav className="builder-step-list">
        {builderSteps.map((step, index) => {
          const done = completedSteps[step.id];
          const active = currentStep === step.id;
          return (
            <React.Fragment key={step.id}>
              <button type="button" onClick={() => onStep(step.id)} className={`builder-step ${active ? "active" : ""} ${done ? "done" : ""}`}>
                <span className="builder-step-dot">{done ? <Icon name="check" className="h-3 w-3" /> : index + 1}</span>
                <span>{step.label}</span>
              </button>
              {index < builderSteps.length - 1 && <span className="builder-step-connector" />}
            </React.Fragment>
          );
        })}
      </nav>
      <p className="sidebar-label-v2 mt-5">Template</p>
      <CategorySelector selected={categoryId} onSelect={onCategory} />
      <p className="sidebar-label-v2 mt-4">Accent colour</p>
      <div className="sidebar-swatch-row">
        {themes.slice(0, 8).map((theme) => (
          <button
            key={theme.id}
            type="button"
            title={theme.name}
            aria-label={`Set accent to ${theme.name}`}
            onClick={() => onTheme(theme.id)}
            className={`sidebar-swatch ${themeId === theme.id ? "selected" : ""}`}
            style={{ background: theme.color }}
          />
        ))}
      </div>
      {sortedCategories.length > 0 && null}
    </aside>
  );
}

function BuilderPreviewPanel({ cv, theme, layout, onDownload, onCoverLetter }) {
  const [message, setMessage] = useState("");
  const [previewZoom, setPreviewZoom] = useState(56);
  const completeness = getCompleteness(cv);
  const shareUrl = "https://buildmycvnow.com/builder";
  const changeZoom = (delta) => setPreviewZoom((value) => Math.min(100, Math.max(42, value + delta)));
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
            <strong>{previewZoom}%</strong>
            <button type="button" onClick={() => changeZoom(6)} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => setPreviewZoom(56)}>Fit</button>
          </div>
        </div>
        {message && <p className="mt-2 text-xs font-bold text-blue-700">{message}</p>}
      </div>
      <div className="preview-sheet-scroll" style={{ "--preview-zoom": previewZoom / 100 }}>
        <LiveCVPreview cv={cv} theme={theme} layout={layout} />
        <button type="button" onClick={onDownload} className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700">
          <Icon name="download" className="h-4 w-4" /> Download CV
        </button>
        <div className="cover-letter-cta">
          <div>
            <strong>Also need a cover letter?</strong>
            <p>Auto-filled from your CV. Edit and download as PDF.</p>
          </div>
          <button type="button" onClick={onCoverLetter}>Build cover letter</button>
        </div>
      </div>
    </aside>
  );
}

function DownloadSuccessScreen({ isSignedIn, onSaveAccount, onCoverLetter, onDownloadAgain, onEdit }) {
  const [copyStatus, setCopyStatus] = useState("Share via link");
  const copyShareLink = async () => {
    const url = "https://buildmycvnow.com/builder?utm_source=download_success&utm_medium=share";
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("Link copied");
    } catch {
      setCopyStatus("buildmycvnow.com/builder");
    }
    trackEvent("post_download_share_link");
  };
  return (
    <aside className="download-success-panel">
      <div className="download-success-icon"><Icon name="check" className="h-8 w-8" /></div>
      <h2>Your CV is downloaded!</h2>
      <p>Check your Downloads folder for your BuildMyCVNow CV file.</p>
      <div className="download-next-grid">
        {!isSignedIn && (
          <button type="button" onClick={onSaveAccount} className="download-next-card highlighted">
            <Icon name="lock" className="h-5 w-5" />
            <strong>Save to account</strong>
            <span>Access this CV from any device for up to 15 days.</span>
          </button>
        )}
        <button type="button" onClick={onCoverLetter} className="download-next-card">
          <Icon name="file" className="h-5 w-5" />
          <strong>Build a cover letter</strong>
          <span>Use your CV details to create a matching letter.</span>
        </button>
        <button type="button" onClick={copyShareLink} className="download-next-card">
          <Icon name="share" className="h-5 w-5" />
          <strong>{copyStatus}</strong>
          <span>Send BuildMyCVNow to someone job hunting.</span>
        </button>
      </div>
      <div className="download-success-actions">
        <button type="button" onClick={onDownloadAgain}>Download again</button>
        <button type="button" onClick={onEdit}>Edit CV</button>
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
  const [activeBuilder, setActiveBuilder] = useState(() => (window.location.hash === "#cover-letter" ? "cover" : "cv"));
  const [categoryId, setCategoryId] = useState(defaultCategory.id);
  const [cv, setCv] = useState(initialCv);
  const [coverLetter, setCoverLetter] = useState(() => createCoverLetterFromCv(initialCv, defaultCategory.id));
  const [themeId, setThemeId] = useState("blue");
  const [layoutId, setLayoutId] = useState("sidebar");
  const [coverThemeId, setCoverThemeId] = useState("blue");
  const [coverFontId, setCoverFontId] = useState("sans");
  const [coverLayoutId, setCoverLayoutId] = useState("classic");
  const [downloadTarget, setDownloadTarget] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const [coverDownloaded, setCoverDownloaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Auto-save ready");
  const [draftStatus, setDraftStatus] = useState("Cloud draft sync is ready.");
  const [mobileCvView, setMobileCvView] = useState("edit");
  const [currentStep, setCurrentStep] = useState("personal");
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState(null);
  const [sectionReorderOpen, setSectionReorderOpen] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [savedCvRefreshKey, setSavedCvRefreshKey] = useState(0);
  const [accountDashboardRequested, setAccountDashboardRequested] = useState(() => window.location.hash === "#account-dashboard");
  const [localDraftNotice, setLocalDraftNotice] = useState(null);
  const [userMode, setUserMode] = useState(() => localStorage.getItem("cvforall:user-mode") || "guest");
  const theme = useMemo(() => themes.find((item) => item.id === themeId), [themeId]);
  const coverTheme = useMemo(() => themes.find((item) => item.id === coverThemeId), [coverThemeId]);
  const completion = useMemo(() => computeCompletion({ ...cv, categoryId }), [cv, categoryId]);
  const previousCompletionRef = useRef(completion.percent);
  const user = session?.user || null;
  const cloudSavingEnabled = Boolean(user && userMode === "registered");
  const noCloudMode = userMode === "urgent-local";
  const completedSteps = useMemo(() => getBuilderStepState(cv), [cv]);
  const jumpToStep = (id) => {
    if (id === "download") {
      setCurrentStep("download");
      requestCvDownload();
      return;
    }
    if (id === "template") {
      setCurrentStep("template");
      const target = document.querySelector(".builder-sidebar-v2");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setCurrentStep(id);
    const target = document.getElementById(`builder-section-${id}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const requestCvDownload = () => {
    if (completion.percent < 40) {
      logEvent("export_below_threshold", { percent: completion.percent });
      if (!window.confirm(`Your CV is only ${completion.percent}% complete. Recruiters may reject incomplete CVs. Export anyway?`)) return;
    }
    setCurrentStep("download");
    if (cloudSavingEnabled) {
      handleDownload("pdf").catch((error) => {
        alert(error.message || "Could not download your CV. Please try again.");
      });
      return;
    }
    setDownloadTarget("cv");
  };
  const requestAccountDashboard = () => {
    setAccountDashboardRequested(true);
    setActiveBuilder("cv");
    if (window.location.hash !== "#account-dashboard") {
      window.location.hash = "account-dashboard";
    }
  };
  useEffect(() => {
    if (window.location.hash === "#signin") {
      setAuthOpen(true);
    }
    if (window.location.hash === "#account-dashboard") {
      requestAccountDashboard();
    }
  }, []);
  useEffect(() => {
    if (!accountDashboardRequested || !cloudSavingEnabled) return undefined;
    setAuthOpen(false);
    setActiveBuilder("cv");
    let attempts = 0;
    const scrollToDashboard = () => {
      attempts += 1;
      const target = document.getElementById("account-dashboard");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return Boolean(target) || attempts >= 12;
    };
    if (scrollToDashboard()) return undefined;
    const timer = window.setInterval(() => {
      if (scrollToDashboard()) window.clearInterval(timer);
    }, 150);
    return () => window.clearInterval(timer);
  }, [accountDashboardRequested, cloudSavingEnabled]);
  const handleNextStep = (section) => {
    logEvent("nextstep_clicked", { step: section });
    if (section === "download") requestCvDownload();
    else if (section === "template") jumpToStep("template");
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
    initAnalytics();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user && ["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"].includes(event)) {
        setUserMode("registered");
        setAuthOpen(false);
        if (window.location.hash === "#signin" || window.location.hash === "#account-dashboard") {
          requestAccountDashboard();
        }
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
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
    setCoverLetter(draftData.coverLetter || createCoverLetterFromCv({ ...initialCv, ...draftData.cv }, draftData.categoryId || defaultCategory.id));
    setCategoryId(draftData.categoryId || defaultCategory.id);
    setThemeId(draftData.themeId || "blue");
    setLayoutId(draftData.layoutId || "sidebar");
    setCoverThemeId(draftData.coverThemeId || "blue");
    setCoverFontId(draftData.coverFontId || "sans");
    setCoverLayoutId(draftData.coverLayoutId || "classic");
    return true;
  };
  const continueLocalDraft = () => {
    if (!localDraftNotice) return;
    if (applyDraftPayload(localDraftNotice)) {
      setSaveStatus("Draft restored");
      setLocalDraftNotice(null);
      trackEvent("restore_local_draft");
    }
  };
  const startFreshLocalDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setCv(initialCv);
    setCoverLetter(createCoverLetterFromCv(initialCv, defaultCategory.id));
    setCategoryId(defaultCategory.id);
    setThemeId("blue");
    setLayoutId("sidebar");
    setLocalDraftNotice(null);
    setSaveStatus("Fresh CV started");
    trackEvent("clear_local_draft");
  };
  const draftPayload = () => createDraftPayload({ cv, coverLetter, categoryId, themeId, layoutId, coverThemeId, coverFontId, coverLayoutId });
  const saveCloudDraft = async (statusMessage = "Saving cloud draft...") => {
    if (!cloudSavingEnabled) {
      setDraftStatus("Sign in or create an account to save drafts online.");
      return;
    }
    try {
      setDraftStatus(statusMessage);
      await saveDraftForUser({ userId: user.id, draftData: draftPayload() });
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
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.cv && hasUserEnteredCvData(parsed.cv)) {
        setLocalDraftNotice(parsed);
      }
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, []);
  useEffect(() => {
    if (localDraftNotice) return undefined;
    const timer = window.setTimeout(() => {
      try {
        setSaveStatus("Saving locally...");
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload()));
        setSaveStatus("Draft saved");
      } catch {
        setSaveStatus("Save failed");
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [cv, coverLetter, categoryId, themeId, layoutId, coverThemeId, coverFontId, coverLayoutId, localDraftNotice]);
  useEffect(() => {
    const saveDraft = async () => {
      if (localDraftNotice) return;
      const payload = draftPayload();
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
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
  }, [cv, coverLetter, categoryId, themeId, layoutId, coverThemeId, coverFontId, coverLayoutId, cloudSavingEnabled, user?.id, localDraftNotice]);
  const keepCurrentDataForTemplate = (id) => {
    if (!id || id === categoryId) {
      setPendingTemplateId(null);
      return;
    }
    setCategoryId(id);
    setCoverLetter(createCoverLetterFromCv(cv, id));
    setPendingTemplateId(null);
    trackEvent("switch_template_keep_data");
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
  const handleImport = (extracted) => {
    setCv((current) => {
      const nextCv = {
        ...current,
        ...Object.fromEntries(Object.entries(extracted).filter(([, value]) => value)),
      };
      setCoverLetter(createCoverLetterFromCv(nextCv, categoryId));
      return nextCv;
    });
  };
  const handleProfilePhotoChange = async (key, value) => {
    if (key !== "profilePhoto" || !value || !cloudSavingEnabled) {
      setCv((current) => ({ ...current, [key]: value }));
      return;
    }
    try {
      setStorageMessage("Uploading photo to Supabase Storage...");
      const uploaded = await uploadProfilePhoto(user.id, value);
      setCv((current) => ({ ...current, profilePhoto: uploaded.publicUrl }));
      setStorageMessage("Photo uploaded to Supabase Storage.");
    } catch (error) {
      setCv((current) => ({ ...current, profilePhoto: value }));
      setStorageMessage(`Photo kept locally: ${error.message}`);
    }
  };
  const loadSavedCv = (item) => {
    const nextCv = item.cv_data || initialCv;
    setCv(nextCv);
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
  const handleDownload = async (type) => {
    if (type === "email") {
      const toEmail = user?.email || session?.user?.email || cv.email;
      if (!user?.email && !session?.user?.email) {
        throw new Error("Please sign in with email first to receive a CV copy by email.");
      }
      const response = await fetch("/.netlify/functions/emailCv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: toEmail, cv }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Could not email your CV.");
      logEvent("cv_email_requested", { templateId: categoryId, forwarded: result.forwarded });
      return result;
    }
    await downloadCvFile(cv, type, theme, layoutId);
    if (cloudSavingEnabled && user?.id) {
      try {
        await saveCvForUser({ userId: user.id, cv, categoryId, themeId, layoutId });
        setStorageMessage(`Downloaded and saved online. Saved CVs expire after ${SAVED_CV_RETENTION_DAYS} days.`);
        setSavedCvRefreshKey((value) => value + 1);
        requestAccountDashboard();
      } catch (error) {
        setStorageMessage(`Downloaded, but online saving did not finish: ${error.message}`);
      }
    }
    logEvent("cv_downloaded", { format: type, templateId: categoryId, completionPercent: completion.percent });
    setDownloaded(true);
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
  const openAccountDashboard = () => {
    requestAccountDashboard();
  };
  const startUrgentMode = (method) => {
    setUserMode("urgent-local");
    setAuthOpen(false);
  };
  const startRegisteredMode = () => {
    setUserMode("registered");
    setAuthOpen(false);
    requestAccountDashboard();
  };
  return (
    <main className="builder-app-shell">
      <BuilderTopBar onHome={onHome} saveStatus={saveStatus} onDownload={() => (activeBuilder === "cv" ? requestCvDownload() : setDownloadTarget("cover"))} />
      {activeBuilder === "cv" && <CompletionBar completion={completion} onNextStep={handleNextStep} />}
      {activeBuilder === "cv" && <BuilderProgressBar currentStep={currentStep} completedSteps={completedSteps} onStep={handleNextStep} />}
      <div className="builder-tabbar">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            {[
              ["cv", "CV Builder"],
              ["cover", "Cover Letter Builder"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => switchBuilder(id)}
                className={`rounded px-5 py-3 text-sm font-black ${activeBuilder === id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>{cloudSavingEnabled ? `Cloud saving as ${user.email}` : noCloudMode ? "Download-only mode. No cloud saving." : "Choose download-only or sign in to save online."}</span>
            {cloudSavingEnabled ? (
              <>
                <button onClick={openAccountDashboard} className="rounded border border-blue-600 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">Account dashboard</button>
                <button onClick={signOut} className="rounded border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">Logout</button>
              </>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="rounded border border-blue-600 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">Sign In / Sign Up</button>
            )}
          </div>
        </div>
      </div>
      {activeBuilder === "cv" && <BuilderHeaderGuide cloudSavingEnabled={cloudSavingEnabled} noCloudMode={noCloudMode} />}
      {activeBuilder === "cv" && <DraftRecoveryBanner draft={localDraftNotice} onContinue={continueLocalDraft} onStartFresh={startFreshLocalDraft} />}
      {noCloudMode && (
        <section className="border-b border-amber-200 bg-amber-50 px-5 py-3">
          <div className="mx-auto max-w-7xl text-sm font-bold leading-6 text-amber-950">
            Your CV will not be saved online. Download your file before closing the browser.
          </div>
        </section>
      )}
      {activeBuilder === "cv" ? (
        <>
        <div className="builder-layout-v2">
          <BuilderSidebar
            currentStep={currentStep}
            onStep={jumpToStep}
            completedSteps={completedSteps}
            categoryId={categoryId}
            onCategory={handleCategory}
            themeId={themeId}
            onTheme={setThemeId}
          />
          <section className="builder-form-panel-v2">
            <div className="builder-form-inner">
              <ExistingCVImporter onImport={handleImport} />
              <ProfilePhotoUploader cv={cv} onChange={handleProfilePhotoChange} />
              {storageMessage && cloudSavingEnabled && <p className="rounded bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">{storageMessage}</p>}
              <CVBuilderForm cv={cv} onChange={updateCvField} />
              <section className="rounded border border-slate-200 bg-white p-4">
                <h3 className="panel-title">Save and layout</h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-4">
                    <LayoutSelector selected={layoutId} onSelect={setLayoutId} />
                    <PageMarginSelector value={cv.pageMargin} onChange={(pageMargin) => updateCvField("pageMargin", pageMargin)} />
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
                        onSaveDraft={() => saveCloudDraft()}
                        onLoadDraft={restoreCloudDraft}
                        draftStatus={draftStatus}
                        refreshKey={savedCvRefreshKey}
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
          </section>
          <div className="builder-right-stack">
            {downloaded ? (
              <DownloadSuccessScreen
                isSignedIn={cloudSavingEnabled}
                onSaveAccount={() => setAuthOpen(true)}
                onCoverLetter={() => switchBuilder("cover")}
                onDownloadAgain={requestCvDownload}
                onEdit={() => {
                  setDownloaded(false);
                  setCurrentStep("personal");
                }}
              />
            ) : (
              <BuilderPreviewPanel cv={cv} theme={theme} layout={layoutId} onDownload={requestCvDownload} onCoverLetter={() => switchBuilder("cover")} />
            )}
            <ATSPanel cv={cv} />
          </div>
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
              <LiveCVPreview cv={cv} theme={theme} layout={layoutId} />
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
              <ATSPanel cv={cv} />
            </div>
          </div>
        )}
        {downloaded && (
          <div className="download-confirm-toast">
            Download confirmed. Your next steps are shown in the preview panel.
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
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onUrgentMode={startUrgentMode}
          onRegisteredMode={startRegisteredMode}
          onAuthenticated={setSession}
        />
      )}
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
  const goToBuilder = () => navigate("/builder");
  const goToSignIn = () => navigate("/builder#signin");
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
              <Header onStart={goToBuilder} onSignIn={goToSignIn} />
              <LandingPage onStart={goToBuilder} onUpload={goToBuilder} />
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




