import React, { useEffect, useMemo, useState } from "react";
import { categories, layouts, themes } from "./data/categories";
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
import { careerTips, faqs } from "./data/siteContent";
import { downloadCoverLetterFile, downloadCvFile } from "./utils/downloads";
import { initAnalytics, trackEvent } from "./utils/analytics";
import { isEmailJsConfigured, sendContactEmail } from "./utils/email";
import { getRecaptchaToken, isRecaptchaConfigured } from "./utils/recaptcha";
import {
  deleteUserCv,
  duplicateUserCv,
  isSupabaseConfigured,
  listUserCvs,
  saveCvForUser,
  supabase,
  uploadProfilePhoto,
} from "./utils/supabaseClient";

const defaultCategory = categories[0];

const initialCv = {
  fullName: "Juan Dela Cruz",
  jobTitle: defaultCategory.title,
  email: "juan.delacruz@email.com",
  phone: "+971 50 123 4567",
  country: "United Arab Emirates",
  summary: defaultCategory.summary,
  skills: defaultCategory.skills,
  experience: defaultCategory.experience,
  education: "High School Diploma\nManila High School, 2018",
  certifications: "Basic Food Safety Certificate",
  languages: "English, Filipino",
  references: "Available upon request",
  profilePhoto: "",
  photoShape: "round",
};

const createCoverLetterFromCv = (cv, categoryId) => {
  const template = coverLetterTemplates[categoryId] || coverLetterTemplates.hospitality;
  return generateCoverLetterTemplate({
    cv,
    role: template.position,
    letter: {
      companyName: "Company Name",
      companyAddress: cv.country,
      position: cv.jobTitle || template.position,
      opening: template.opening,
      body: template.body,
      closing: template.closing,
    },
  });
};

const coverLetterToText = (letter, cv) => {
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
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
    letter.opening,
    "",
    letter.body,
    "",
    letter.qualifications,
    "",
    letter.value,
    "",
    letter.closing,
    "",
    "Sincerely,",
    cv.fullName,
  ]
    .filter((line) => line !== "")
    .join("\n");
};

const DRAFT_STORAGE_KEY = "cvforall:draft:v1";
const AUTH_REDIRECT_URL = import.meta.env.VITE_AUTH_REDIRECT_URL || "https://buildmycvforfree.netlify.app/#builder";
const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === "true";

const completenessFields = [
  ["Contact details", (cv) => cv.fullName && cv.email && cv.phone && cv.country],
  ["Professional summary", (cv) => cv.summary && cv.summary.length > 40],
  ["Skills", (cv) => cv.skills && cv.skills.split(",").length >= 3],
  ["Work experience", (cv) => cv.experience && cv.experience.length > 35],
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
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function AdPlaceholder({ label = "Google AdSense Placeholder (728x90)", compact = false }) {
  return (
    <div className={`mx-auto flex w-full max-w-6xl items-center justify-center rounded border border-dashed border-slate-300 bg-white text-slate-500 ${compact ? "min-h-20 text-sm" : "min-h-24"}`}>
      {label}
    </div>
  );
}

function Header({ onStart }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <a href="#top" className="flex items-center gap-2 font-bold text-slate-950">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-green-600 text-white">
            <Icon name="file" className="h-5 w-5" />
          </span>
          <span className="text-xl">CV<span className="text-green-600">forAll</span></span>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
          <a href="#templates">Templates</a>
          <a href="#about">About</a>
          <a href="#blog">Career Tips</a>
          <a href="#faq">FAQ</a>
          <a href="#contact">Contact</a>
        </nav>
        <button onClick={onStart} className="rounded bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-700">
          Start your free CV
        </button>
      </div>
    </header>
  );
}

function LandingPage({ onStart }) {
  const benefits = [
    ["check", "100% Free", "Create and download without hidden charges."],
    ["file", "Professional templates", "Simple wording that fits real job categories."],
    ["lock", "Private and secure", "Mock verification flow today, ready for real security later."],
    ["download", "PDF and Word", "Download in the format employers commonly request."],
  ];
  return (
    <main id="top">
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-10 pt-14 lg:grid-cols-[1fr_0.9fr] lg:pt-20">
        <div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Create a professional CV for free in minutes.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Easy to use for first-time CV creators, fresh graduates, skilled workers, domestic service workers, and job seekers who want better opportunities.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={onStart} className="inline-flex items-center justify-center gap-3 rounded bg-green-600 px-7 py-4 font-bold text-white shadow-soft transition hover:bg-green-700">
              Start your free CV <Icon name="arrow" className="h-5 w-5" />
            </button>
            <a href="#templates" className="inline-flex items-center justify-center rounded border border-blue-600 px-7 py-4 font-bold text-blue-700 transition hover:bg-blue-50">
              See templates
            </a>
          </div>
          <div className="mt-8 grid gap-3 text-sm font-semibold text-slate-700 sm:grid-cols-3">
            <span className="flex items-center gap-2"><Icon name="check" className="h-5 w-5 text-green-600" /> 100% free</span>
            <span className="flex items-center gap-2"><Icon name="lock" className="h-5 w-5 text-blue-600" /> Beginner-friendly</span>
            <span className="flex items-center gap-2"><Icon name="download" className="h-5 w-5 text-red-500" /> PDF or Word</span>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute right-0 top-4 z-10 rounded-full bg-amber-300 px-5 py-5 text-center text-sm font-black text-slate-950 shadow-soft">FREE<br />FOREVER</div>
          <div className="rotate-2 rounded-sm bg-white p-8 shadow-soft ring-1 ring-slate-200">
            <div className="border-b border-slate-200 pb-5">
              <h2 className="text-2xl font-black text-slate-950">MARIA SANTOS</h2>
              <p className="text-sm font-bold text-blue-700">Hospitality Assistant</p>
            </div>
            <div className="mt-6 space-y-5 text-sm text-slate-700">
              <CVLine title="Professional Summary" text="Reliable worker with a friendly attitude and strong customer service experience." />
              <CVLine title="Work Experience" text="Assisted guests, prepared service areas, and followed daily team duties." />
              <CVLine title="Skills" text="Customer service, teamwork, cleaning, time management" />
            </div>
          </div>
        </div>
      </section>
      <div className="px-5 py-5"><AdPlaceholder /></div>
      <section id="how" className="mx-auto max-w-7xl px-5 py-14">
        <h2 className="text-center text-3xl font-black text-slate-950">Build your CV in 3 easy steps</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {["Choose your job category", "Fill in your details", "Preview, verify, and download"].map((step, index) => (
            <div key={step} className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-700">
                <span className="font-black">{index + 1}</span>
              </div>
              <h3 className="mt-4 font-black text-slate-950">{step}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
                {index === 0 ? "Pick the template that best matches your work." : index === 1 ? "Answer simple questions and add your experience." : "Check your CV and download it for free."}
              </p>
            </div>
          ))}
        </div>
      </section>
      <IPhonePortraitDisplay onStart={onStart} />
      <section className="border-y border-slate-200 bg-slate-50 px-5 py-14">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-black text-slate-950">Why job seekers trust CVforAll</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(([icon, title, text]) => (
              <div key={title} className="rounded bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <Icon name={icon} className="h-8 w-8 text-green-600" />
                <h3 className="mt-5 font-black text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="templates" className="mx-auto max-w-7xl px-5 py-14">
        <h2 className="text-center text-3xl font-black text-slate-950">CV templates for every job category</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <button key={category.id} onClick={onStart} className="rounded border border-slate-200 bg-white p-5 text-left transition hover:border-green-500 hover:shadow-soft">
              <Icon name="briefcase" className="h-7 w-7 text-blue-600" />
              <h3 className="mt-4 font-black text-slate-950">{category.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{category.title}</p>
            </button>
          ))}
        </div>
      </section>
      <div className="px-5 pb-6"><AdPlaceholder /></div>
      <AboutSection onStart={onStart} />
      <BlogCareerTips />
      <section id="faq" className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <h2 className="text-3xl font-black text-slate-950">Frequently asked questions</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Simple answers for first-time CV creators, workers, and job seekers using CVforAll.
          </p>
          <button onClick={onStart} className="mt-7 rounded bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700">Start your free CV</button>
        </div>
        <div className="space-y-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="rounded border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer font-bold text-slate-950">{q}</summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <ContactSection />
      <PolicySections />
      <SiteFooter onStart={onStart} />
    </main>
  );
}

function AboutSection({ onStart }) {
  return (
    <section id="about" className="border-y border-slate-200 bg-slate-50 px-5 py-14">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 className="text-3xl font-black text-slate-950">About Us</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            CVforAll was created to help people prepare a clear, professional CV without cost or confusion.
            The builder focuses on practical job categories, simple words, and editable templates that workers can use right away.
          </p>
          <button onClick={onStart} className="mt-7 rounded bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700">
            Build my CV
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Community-focused", "Made for fresh graduates, skilled workers, domestic workers, helpers, and job seekers."],
            ["Beginner-friendly", "Every section uses simple form fields and suggested wording."],
            ["Free access", "The experience is designed for free CV creation with clean ad placements."],
            ["Ready to grow", "The mock AI, OTP, PDF, and Word flows are structured for real backend services later."],
          ].map(([title, text]) => (
            <div key={title} className="rounded bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="font-black text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BlogCareerTips() {
  return (
    <section id="blog" className="mx-auto max-w-7xl px-5 py-14">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-950">Blog and Career Tips</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Short, practical articles to help job seekers write stronger CVs and prepare for applications.
          </p>
        </div>
        <AdPlaceholder compact label="Career tips ad area" />
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {careerTips.map((article) => (
          <article key={article.title} className="rounded border border-slate-200 bg-white p-5 transition hover:border-green-500 hover:shadow-soft">
            <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-500">
              <span>{article.category}</span>
              <span>{article.readTime}</span>
            </div>
            <h3 className="mt-4 text-lg font-black leading-7 text-slate-950">{article.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{article.summary}</p>
            <a href="#builder" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-green-700">
              Use this tip in my CV <Icon name="arrow" className="h-4 w-4" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function ContactSection() {
  const [status, setStatus] = useState(isEmailJsConfigured ? "Ready to send your message." : "EmailJS is not configured yet. Add the EmailJS Vite variables to enable sending.");
  const [sending, setSending] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSending(true);
    setStatus("Sending your message...");
    try {
      await sendContactEmail(event.currentTarget);
      trackEvent("contact_form_sent");
      event.currentTarget.reset();
      setStatus("Message sent successfully. We will reply as soon as possible.");
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
            Questions, feedback, and partnership messages are welcome. This form sends email through EmailJS when your service, template, and public key are configured.
          </p>
          <div className="mt-6 rounded bg-white p-5 text-sm leading-6 text-slate-600 ring-1 ring-slate-200">
            <p><strong className="text-slate-950">Email:</strong> support@cvforall.example</p>
            <p><strong className="text-slate-950">Response time:</strong> 1-2 business days</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 rounded bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <input type="hidden" name="app_name" value="CVforAll" />
          <input type="hidden" name="sent_at" value={new Date().toISOString()} />
          <label>
            <span className="form-label">Your name</span>
            <input className="form-field" name="user_name" placeholder="Enter your name" required />
          </label>
          <label>
            <span className="form-label">Email address</span>
            <input className="form-field" name="user_email" type="email" placeholder="Enter your email" required />
          </label>
          <label>
            <span className="form-label">Subject</span>
            <input className="form-field" name="subject" placeholder="What is your message about?" required />
          </label>
          <label>
            <span className="form-label">Message</span>
            <textarea className="form-field" name="message" rows={5} placeholder="How can we help?" required />
          </label>
          <button disabled={!isEmailJsConfigured || sending} className="rounded bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300">
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
        <p>CVforAll is designed to collect only the information needed to create and download a CV. Form data, uploaded CV text, profile photos, contact details, and OTP information are handled in the browser in this mock frontend.</p>
        <p>Do not upload sensitive documents unless you trust the final production deployment. A real production version should include secure storage, encryption, clear retention rules, and a way to delete user data.</p>
        <p>Ad areas are placeholders for Google AdSense. When ads are enabled, Google and partners may use cookies or similar technologies according to their own policies.</p>
      </PolicyCard>
      <PolicyCard id="terms" title="Terms & Conditions">
        <p>CVforAll provides free CV-building tools, templates, and career tips for general guidance. Users remain responsible for checking the accuracy of their CV before sending it to employers.</p>
        <p>The mock AI import, OTP, PDF, and Word features are demonstration flows until connected to real production services.</p>
        <p>The service does not guarantee job interviews, job offers, or employer acceptance. Templates and tips should be adapted honestly to each user&apos;s real experience.</p>
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

function SiteFooter({ onStart }) {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_1.4fr_auto]">
        <div>
          <div className="flex items-center gap-2 font-black">
            <span className="flex h-9 w-9 items-center justify-center rounded bg-green-600 text-white"><Icon name="file" className="h-5 w-5" /></span>
            CVforAll
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">Free, simple CV creation for workers and job seekers.</p>
        </div>
        <nav className="grid gap-3 text-sm font-bold text-slate-300 sm:grid-cols-3">
          <a href="#about">About Us</a>
          <a href="#contact">Contact Us</a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms & Conditions</a>
          <a href="#faq">FAQ</a>
          <a href="#blog">Blog/Career Tips</a>
        </nav>
        <button onClick={onStart} className="rounded bg-green-600 px-5 py-3 text-sm font-black text-white hover:bg-green-700">
          Start free CV
        </button>
      </div>
    </footer>
  );
}

function IPhonePortraitDisplay({ onStart }) {
  return (
    <section id="mobile-preview" className="border-y border-slate-200 bg-white px-5 py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.85fr_1fr]">
        <div className="mx-auto w-full max-w-sm">
          <div className="iphone-frame mx-auto">
            <div className="iphone-notch" />
            <div className="iphone-screen">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <span className="flex h-7 w-7 items-center justify-center rounded bg-green-600 text-white">
                    <Icon name="file" className="h-4 w-4" />
                  </span>
                  CV<span className="text-green-600">forAll</span>
                </span>
                <span className="rounded bg-green-600 px-3 py-2 text-xs font-black text-white">Download</span>
              </div>
              <div className="space-y-3 bg-slate-50 p-4">
                <div className="rounded bg-white p-3 shadow-sm ring-1 ring-slate-200">
                  <p className="text-[11px] font-black text-slate-700">Job category template</p>
                  <div className="mt-2 rounded border border-slate-200 px-3 py-2 text-sm">Skilled Workers</div>
                </div>
                <div className="rounded bg-white p-3 shadow-sm ring-1 ring-slate-200">
                  <p className="text-[11px] font-black text-slate-700">Live CV preview</p>
                  <div className="mt-3 rounded-sm bg-white p-4 ring-1 ring-slate-200">
                    <div className="border-b border-blue-600 pb-2">
                      <h3 className="text-lg font-black leading-tight text-slate-950">RAVI KUMAR</h3>
                      <p className="text-xs font-bold text-blue-700">AC Technician</p>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase text-blue-800">Summary</p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-600">Hardworking technician with repair and maintenance experience.</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-blue-800">Skills</p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-600">Installation, repair, safety, tools handling</p>
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={onStart} className="w-full rounded bg-green-600 py-3 text-sm font-black text-white">
                  Create CV on mobile
                </button>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h2 className="max-w-2xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Easy to use on iPhone and small screens.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Workers can choose a template, type their details, check the preview, and unlock downloads from a portrait phone screen.
          </p>
          <div className="mt-7 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
            <span className="flex items-center gap-2"><Icon name="check" className="h-5 w-5 text-green-600" /> Large form fields</span>
            <span className="flex items-center gap-2"><Icon name="eye" className="h-5 w-5 text-blue-600" /> Mobile CV preview</span>
            <span className="flex items-center gap-2"><Icon name="lock" className="h-5 w-5 text-green-600" /> OTP download flow</span>
            <span className="flex items-center gap-2"><Icon name="download" className="h-5 w-5 text-blue-600" /> PDF or Word</span>
          </div>
          <button onClick={onStart} className="mt-8 rounded bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700">
            Try the mobile builder
          </button>
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
    <label className="block">
      <span className="form-label">Job category template</span>
      <select value={selected} onChange={(event) => onSelect(event.target.value)} className="form-field">
        {categories.map((category) => (
          <option value={category.id} key={category.id}>{category.name}</option>
        ))}
      </select>
    </label>
  );
}

function ExistingCVImporter({ onImport }) {
  const [status, setStatus] = useState("Upload an existing CV. Mock AI will read the file text and fill the form.");
  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("Reading CV and extracting details...");
    try {
      const text = await readCvFile(file);
      const extracted = mockAiExtractCv(text, file.name);
      onImport(extracted);
      setStatus("Details filled automatically. Please review and edit before download.");
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
          <h3 className="panel-title">Upload existing CV</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            AI import fills the form automatically. You can still edit every field.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded bg-white px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50">
            Choose CV file
            <input className="hidden" type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleFile} />
          </label>
          <p className="mt-3 text-xs font-bold leading-5 text-blue-900">{status}</p>
        </div>
      </div>
    </section>
  );
}

function ProfilePhotoUploader({ cv, onChange }) {
  const [message, setMessage] = useState("Upload a square photo only. Max size: 2 MB.");
  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please upload an image file.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Photo is too large. Please choose an image under 2 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        if (image.width !== image.height) {
          setMessage("Photo must be a 1:1 square image. Please crop it before uploading.");
          event.target.value = "";
          return;
        }
        onChange("profilePhoto", reader.result);
        setMessage("Photo added. Choose round or square display below.");
        event.target.value = "";
      };
      image.onerror = () => setMessage("Could not read the photo. Please try another image.");
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={`profile-photo-preview ${cv.photoShape === "round" ? "rounded-full" : "rounded"}`}>
          {cv.profilePhoto ? (
            <img src={cv.profilePhoto} alt="Profile preview" />
          ) : (
            <Icon name="camera" className="h-8 w-8 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="panel-title">Profile photo</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Square 1:1 image only, up to 2 MB.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-slate-950 px-4 py-3 text-sm font-bold text-white">
              <Icon name="camera" className="h-4 w-4" /> Upload photo
              <input className="hidden" type="file" accept="image/*" onChange={handlePhoto} />
            </label>
            {["round", "square"].map((shape) => (
              <button
                key={shape}
                onClick={() => onChange("photoShape", shape)}
                className={`rounded border px-4 py-3 text-sm font-bold capitalize ${cv.photoShape === shape ? "border-green-600 bg-green-50 text-green-700" : "border-slate-200 text-slate-700"}`}
              >
                {shape}
              </button>
            ))}
            {cv.profilePhoto && (
              <button onClick={() => onChange("profilePhoto", "")} className="rounded border border-red-200 px-4 py-3 text-sm font-bold text-red-600">
                Remove
              </button>
            )}
          </div>
          <p className="mt-3 text-xs font-bold leading-5 text-slate-500">{message}</p>
        </div>
      </div>
    </section>
  );
}

function CVBuilderForm({ cv, onChange }) {
  const fields = [
    ["fullName", "Full name", "text"],
    ["jobTitle", "Job title", "text"],
    ["email", "Contact email", "email"],
    ["phone", "Contact number", "tel"],
    ["country", "Country", "text"],
    ["summary", "Professional summary", "textarea"],
    ["skills", "Skills", "textarea"],
    ["experience", "Work experience", "textarea"],
    ["education", "Education", "textarea"],
    ["certifications", "Certifications", "textarea"],
    ["languages", "Languages", "textarea"],
    ["references", "References", "textarea"],
  ];
  return (
    <div className="space-y-4">
      {fields.map(([key, label, type]) => (
        <label key={key} className="block">
          <span className="form-label">{label}</span>
          {type === "textarea" ? (
            <textarea value={cv[key]} onChange={(event) => onChange(key, event.target.value)} rows={key === "experience" ? 5 : 3} className="form-field resize-y" />
          ) : (
            <input type={type} value={cv[key]} onChange={(event) => onChange(key, event.target.value)} className="form-field" />
          )}
        </label>
      ))}
    </div>
  );
}

function readCvFile(file) {
  const textLike = file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt");
  if (!textLike) {
    return Promise.resolve(
      `${file.name}\nProfessional Summary\nExisting CV uploaded. Connect a real AI parser to extract PDF or Word content in production.\nSkills\nCustomer service, Teamwork, Time management\nWork Experience\nUploaded CV file ready for AI extraction.`
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this CV file."));
    reader.readAsText(file);
  });
}

function mockAiExtractCv(text, fileName) {
  const clean = text.replace(/\r/g, "").trim();
  const lines = clean.split("\n").map((line) => line.trim()).filter(Boolean);
  const email = clean.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = clean.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0];
  const firstLine = lines.find((line) => !line.includes("@") && !/curriculum|resume|cv/i.test(line));
  const section = (names) => {
    const index = lines.findIndex((line) => names.some((name) => line.toLowerCase().includes(name)));
    if (index === -1) return "";
    const nextIndex = lines.findIndex((line, lineIndex) => lineIndex > index && /summary|profile|skills|experience|employment|education|certification|language|reference/i.test(line));
    return lines.slice(index + 1, nextIndex === -1 ? index + 5 : nextIndex).join("\n");
  };
  const skills = section(["skills"]);
  const experience = section(["experience", "employment", "work history"]);
  const education = section(["education"]);
  const certifications = section(["certification", "certificate"]);
  const languages = section(["language"]);
  const summary = section(["summary", "profile", "objective"]);
  return {
    fullName: firstLine || fileName.replace(/\.[^.]+$/, "").replaceAll("-", " "),
    email: email || "",
    phone: phone || "",
    summary: summary || "Professional and reliable worker with experience from the uploaded CV. Please review and improve this summary.",
    skills: skills || "Teamwork, Communication, Time management",
    experience: experience || "Experience imported from existing CV. Please review and edit details.",
    education: education || "Education details imported from existing CV. Please review.",
    certifications: certifications || "Add certificates or training here.",
    languages: languages || "English",
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

function LiveCVPreview({ cv, theme, layout }) {
  const lines = (value) => value.split("\n").filter(Boolean);
  const photo = (size = "h-16 w-16") =>
    cv.profilePhoto ? (
      <img src={cv.profilePhoto} alt={`${cv.fullName} profile`} className={`${size} object-cover ${cv.photoShape === "round" ? "rounded-full" : "rounded"}`} />
    ) : null;
  const section = (title, content, list = false) => (
    <section className="break-inside-avoid">
      <h3 className="cv-section-title" style={{ color: theme.dark, borderColor: theme.color }}>{title}</h3>
      {list ? <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-5 text-slate-700">{lines(content).map((line) => <li key={line}>{line}</li>)}</ul> : <p className="mt-2 whitespace-pre-line text-[12px] leading-5 text-slate-700">{content}</p>}
    </section>
  );
  const content = (
    <div className={layout === "compact" ? "space-y-3" : "space-y-5"}>
      {section("Professional Summary", cv.summary)}
      {section("Skills", cv.skills)}
      {section("Work Experience", cv.experience, true)}
      {section("Education", cv.education)}
      {section("Certifications", cv.certifications)}
      {section("Languages", cv.languages)}
      {section("References", cv.references)}
    </div>
  );
  if (layout === "sidebar") {
    return (
      <article className="cv-paper grid grid-cols-[0.38fr_0.62fr] overflow-hidden p-0">
        <aside className="p-6 text-white" style={{ background: theme.dark }}>
          {photo() || <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-xl font-black">{initials(cv.fullName)}</div>}
          <h2 className="mt-5 text-xl font-black leading-tight">{cv.fullName}</h2>
          <p className="mt-1 text-sm font-bold text-white/85">{cv.jobTitle}</p>
          <div className="mt-7 space-y-3 text-[11px] leading-5 text-white/85">
            <p>{cv.email}</p><p>{cv.phone}</p><p>{cv.country}</p>
          </div>
        </aside>
        <div className="p-7">{content}</div>
      </article>
    );
  }
  return (
    <article className={`cv-paper ${layout === "compact" ? "p-6" : "p-8"}`}>
      <header className={`flex items-center gap-4 ${layout === "header" ? "rounded p-5 text-white" : "border-b border-slate-200 pb-5"}`} style={layout === "header" ? { background: theme.dark } : {}}>
        {photo("h-20 w-20")}
        <div>
          <h2 className="text-2xl font-black leading-tight">{cv.fullName}</h2>
          <p className={`mt-1 text-sm font-bold ${layout === "header" ? "text-white/90" : "text-blue-700"}`} style={layout === "header" ? {} : { color: theme.color }}>{cv.jobTitle}</p>
          <p className={`mt-3 text-[11px] ${layout === "header" ? "text-white/80" : "text-slate-500"}`}>{cv.email} | {cv.phone} | {cv.country}</p>
        </div>
      </header>
      <div className="mt-6">{content}</div>
    </article>
  );
}

function DownloadModal({ cv, onClose, onVerifiedDownload, title = "Verify to download", description = "Enter your contact details. This mock flow displays an OTP so real email or SMS can be added later.", label = "Downloads" }) {
  const [details, setDetails] = useState({ name: cv.fullName, email: cv.email, country: cv.country, phone: cv.phone });
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const sendOtp = (event) => {
    event.preventDefault();
    setSentOtp(String(Math.floor(100000 + Math.random() * 900000)));
    setOtp("");
  };
  const verify = () => setVerified(otp === sentOtp);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-lg rounded bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-slate-500">×</button>
        </div>
        <form onSubmit={sendOtp} className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["name", "Name"],
            ["email", "Contact email"],
            ["country", "Country"],
            ["phone", "Contact number"],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="form-label">{label}</span>
              <input value={details[key]} onChange={(event) => setDetails({ ...details, [key]: event.target.value })} className="form-field" required />
            </label>
          ))}
          <button className="rounded bg-blue-600 px-5 py-3 font-bold text-white sm:col-span-2">Generate OTP</button>
        </form>
        {sentOtp && (
          <div className="mt-5 rounded border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-900">Mock OTP: {sentOtp}</p>
            <div className="mt-3 flex gap-2">
              <input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" maxLength={6} className="form-field" placeholder="Enter 6-digit OTP" />
              <button onClick={verify} className="rounded bg-green-600 px-5 py-3 font-bold text-white">Verify</button>
            </div>
            {verified && <p className="mt-3 text-sm font-bold text-green-800">OTP verified. {label} are unlocked.</p>}
          </div>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button disabled={!verified} onClick={() => onVerifiedDownload("pdf")} className="rounded bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Download PDF</button>
          <button disabled={!verified} onClick={() => onVerifiedDownload("word")} className="rounded border border-blue-600 px-5 py-3 font-bold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">Download DOCX</button>
        </div>
      </div>
    </div>
  );
}

function AuthModal({ onClose, onUrgentMode, onRegisteredMode }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [phoneForm, setPhoneForm] = useState({ phone: "", otp: "" });
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [message, setMessage] = useState(isSupabaseConfigured ? "" : "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable login.");
  const [loading, setLoading] = useState(false);
  const [lastSignupEmail, setLastSignupEmail] = useState("");
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
        setMessage("Signup request sent. Please check your inbox and spam folder for the confirmation email. If it does not arrive, use Resend confirmation email below.");
      } else {
        setMessage("Signed in successfully.");
        onRegisteredMode();
      }
      if (mode === "signin") onClose();
    } catch (error) {
      setMessage(error.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };
  const resendConfirmation = async () => {
    if (!supabase || !lastSignupEmail) return;
    setLoading(true);
    setMessage("Sending confirmation email again...");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: lastSignupEmail,
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
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
    onRegisteredMode();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: AUTH_REDIRECT_URL },
    });
    if (error) setMessage(error.message);
  };
  const sendPhoneOtp = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("Sending mobile OTP...");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneForm.phone,
        options: { channel: "sms" },
      });
      if (error) throw error;
      setPhoneOtpSent(true);
      trackEvent("phone_otp_sent");
      setMessage("OTP sent. Enter the code from your SMS to continue without cloud saving.");
    } catch (error) {
      setMessage(error.message || "Could not send mobile OTP. Make sure Phone Auth is enabled in Supabase.");
    } finally {
      setLoading(false);
    }
  };
  const verifyPhoneOtp = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("Verifying OTP...");
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneForm.phone,
        token: phoneForm.otp,
        type: "sms",
      });
      if (error) throw error;
      await supabase.auth.signOut();
      trackEvent("phone_otp_verified");
      onUrgentMode("phone");
      onClose();
    } catch (error) {
      setMessage(error.message || "Invalid OTP. Please try again.");
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
          <button onClick={() => setMode("phone")} className={`rounded px-4 py-3 text-sm font-black ${mode === "phone" ? "bg-slate-950 text-white" : "bg-blue-50 text-blue-800"}`}>
            Continue with mobile OTP
          </button>
          <p className="rounded bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
            Download-only mode: Your CV will not be saved online. Download your file before closing the browser.
          </p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-black uppercase text-slate-500">Sign in / Create account to save online</p>
          <div className="grid grid-cols-2 gap-2">
          {[
            ["signin", "Login"],
            ["signup", "Sign up"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} className={`rounded px-4 py-3 text-sm font-black ${mode === id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>
              {label}
            </button>
          ))}
          </div>
        </div>
        {mode === "phone" ? (
          <form onSubmit={phoneOtpSent ? verifyPhoneOtp : sendPhoneOtp} className="mt-5 grid gap-3">
            <label>
              <span className="form-label">Mobile number</span>
              <input className="form-field" type="tel" value={phoneForm.phone} onChange={(event) => setPhoneForm({ ...phoneForm, phone: event.target.value })} placeholder="+971501234567" required />
            </label>
            {phoneOtpSent && (
              <label>
                <span className="form-label">OTP code</span>
                <input className="form-field" inputMode="numeric" maxLength={6} value={phoneForm.otp} onChange={(event) => setPhoneForm({ ...phoneForm, otp: event.target.value })} required />
              </label>
            )}
            <button disabled={!isSupabaseConfigured || loading} className="rounded bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {loading ? "Please wait..." : phoneOtpSent ? "Verify OTP and continue" : "Send OTP"}
            </button>
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

function MyCvsPanel({ user, cv, categoryId, themeId, layoutId, onLoad }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(user ? "Load your saved CVs." : "Login to save and manage up to 5 CVs.");
  const refresh = async () => {
    if (!user) return;
    try {
      setItems(await listUserCvs(user.id));
      setMessage("Saved CVs loaded.");
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
    <section className="rounded border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="panel-title">My CVs</h3>
        <button onClick={saveCurrent} className="rounded bg-green-600 px-3 py-2 text-xs font-black text-white">Save</button>
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{message}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-slate-200 p-3">
            <p className="text-sm font-black text-slate-900">{item.title}</p>
            <p className="text-xs text-slate-500">{new Date(item.updated_at || item.created_at).toLocaleDateString()}</p>
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
    ["skills", "Key Skills", "textarea"],
    ["summary", "Professional Summary", "textarea"],
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

function CoverLetterForm({ letter, onChange, onRegenerate }) {
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
        <label key={key} className="block">
          <span className="form-label">{label}</span>
          {type === "textarea" ? (
            <textarea value={letter[key] || ""} onChange={(event) => onChange(key, event.target.value)} rows={key === "body" ? 6 : 4} className="form-field resize-y" />
          ) : (
            <input value={letter[key] || ""} onChange={(event) => onChange(key, event.target.value)} className="form-field" />
          )}
        </label>
      ))}
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
        <p className="whitespace-pre-line">{letter.opening}</p>
        <p className="whitespace-pre-line">{letter.body}</p>
        {letter.qualifications && <p className="whitespace-pre-line">{letter.qualifications}</p>}
        {letter.value && <p className="whitespace-pre-line">{letter.value}</p>}
        <p className="whitespace-pre-line">{letter.closing}</p>
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
        <AdPlaceholder compact label="Cover letter ad area" />
        {downloaded && <div className="rounded border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-900">Cover letter download confirmed. You can also download your CV for free.</div>}
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
  const [mobileCvView, setMobileCvView] = useState("edit");
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [pendingDraft, setPendingDraft] = useState(null);
  const [userMode, setUserMode] = useState(() => localStorage.getItem("cvforall:user-mode") || "guest");
  const theme = useMemo(() => themes.find((item) => item.id === themeId), [themeId]);
  const coverTheme = useMemo(() => themes.find((item) => item.id === coverThemeId), [coverThemeId]);
  const user = session?.user || null;
  const cloudSavingEnabled = Boolean(user && userMode === "registered");
  const noCloudMode = userMode === "urgent-local" || userMode === "urgent-phone";
  useEffect(() => {
    initAnalytics();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    localStorage.setItem("cvforall:user-mode", userMode);
  }, [userMode]);
  useEffect(() => {
    if (!noCloudMode && user) {
      setUserMode("registered");
    }
  }, [user?.id, noCloudMode]);
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
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) return;
    try {
      const draft = JSON.parse(rawDraft);
      setPendingDraft(draft);
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, []);
  useEffect(() => {
    const saveDraft = () => {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          cv,
          coverLetter,
          categoryId,
          themeId,
          layoutId,
          coverThemeId,
          coverFontId,
          coverLayoutId,
          updatedAt: new Date().toISOString(),
        })
      );
      setSaveStatus("Saved locally");
      window.setTimeout(() => setSaveStatus("Auto-save ready"), 2200);
    };
    const timer = window.setInterval(saveDraft, 30000);
    return () => window.clearInterval(timer);
  }, [cv, coverLetter, categoryId, themeId, layoutId, coverThemeId, coverFontId, coverLayoutId]);
  const handleCategory = (id) => {
    const category = categories.find((item) => item.id === id);
    setCategoryId(id);
    setCv((current) => {
      const nextCv = {
        ...current,
        jobTitle: category.title,
        summary: category.summary,
        skills: category.skills,
        experience: category.experience,
      };
      setCoverLetter(createCoverLetterFromCv(nextCv, id));
      return nextCv;
    });
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
    setCv((current) => ({ ...current, [key]: value }));
  };
  const handleCoverRoleChange = (role) => {
    setCoverLetter((current) => generateCoverLetterTemplate({ cv: { ...cv, jobTitle: role }, role, letter: current }));
    setCv((current) => ({ ...current, jobTitle: role }));
  };
  const regenerateCoverLetter = async () => {
    const localDraft = generateCoverLetterTemplate({ cv, role: coverLetter.position, letter: coverLetter });
    try {
      const response = await fetch("/.netlify/functions/generateCoverLetter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cv,
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
    await downloadCvFile(cv, type, theme);
    setDownloaded(true);
    setDownloadTarget(null);
  };
  const handleCoverDownload = async (type) => {
    await downloadCoverLetterFile(coverLetter, cv, type, coverTheme);
    setCoverDownloaded(true);
    setDownloadTarget(null);
  };
  const switchBuilder = (id) => {
    window.location.hash = id === "cover" ? "cover-letter" : "builder";
    setActiveBuilder(id);
  };
  const restoreDraft = () => {
    if (!pendingDraft) return;
    setCv(pendingDraft.cv || initialCv);
    setCategoryId(pendingDraft.categoryId || defaultCategory.id);
    setCoverLetter(pendingDraft.coverLetter || createCoverLetterFromCv(pendingDraft.cv || initialCv, pendingDraft.categoryId || defaultCategory.id));
    setThemeId(pendingDraft.themeId || "blue");
    setLayoutId(pendingDraft.layoutId || "sidebar");
    setCoverThemeId(pendingDraft.coverThemeId || "blue");
    setCoverFontId(pendingDraft.coverFontId || "sans");
    setCoverLayoutId(pendingDraft.coverLayoutId || "classic");
    setSaveStatus("Draft restored");
    setPendingDraft(null);
  };
  const discardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setPendingDraft(null);
    setSaveStatus("Fresh CV started");
  };
  const signOut = async () => {
    await supabase?.auth.signOut();
    setUserMode("guest");
    trackEvent("logout");
  };
  const startUrgentMode = (method) => {
    setUserMode(method === "phone" ? "urgent-phone" : "urgent-local");
    setAuthOpen(false);
  };
  const startRegisteredMode = () => {
    setUserMode("registered");
  };
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <button onClick={onHome} className="flex items-center gap-2 font-bold text-slate-950">
            <span className="flex h-9 w-9 items-center justify-center rounded bg-green-600 text-white"><Icon name="file" className="h-5 w-5" /></span>
            CV<span className="text-green-600">forAll</span>
          </button>
          <div className="hidden items-center gap-5 text-sm font-bold text-slate-500 md:flex">
            <span className="text-green-700">1 Category</span><span>2 Details</span><span>3 Customize</span><span>4 Download</span>
          </div>
          <div className="flex items-center gap-2">
            {cloudSavingEnabled ? (
              <button onClick={signOut} className="rounded border border-slate-300 px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Logout
              </button>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="rounded border border-blue-600 px-3 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">
                Access
              </button>
            )}
            <button onClick={() => setDownloadTarget(activeBuilder === "cv" ? "cv" : "cover")} className="inline-flex items-center gap-2 rounded bg-green-600 px-3 py-3 text-sm font-bold text-white hover:bg-green-700 sm:px-5"><Icon name="download" className="h-4 w-4" /> <span className="hidden sm:inline">Download</span></button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 pb-4 md:flex-row md:items-center md:justify-between">
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
          <div className="text-xs font-bold text-slate-500">
            {saveStatus} - {cloudSavingEnabled ? `Cloud saving as ${user.email}` : noCloudMode ? "Download-only mode. No cloud saving." : "Choose download-only or sign in to save online."}
          </div>
        </div>
      </div>
      {noCloudMode && (
        <section className="border-b border-amber-200 bg-amber-50 px-5 py-3">
          <div className="mx-auto max-w-7xl text-sm font-bold leading-6 text-amber-950">
            Your CV will not be saved online. Download your file before closing the browser.
          </div>
        </section>
      )}
      {pendingDraft && (
        <section className="border-b border-amber-200 bg-amber-50 px-5 py-4">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-black text-amber-950">You have an unsaved CV draft</h2>
              <p className="mt-1 text-sm font-semibold text-amber-900">Continue editing your saved draft or start a fresh CV.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={restoreDraft} className="rounded bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700">
                Continue editing
              </button>
              <button onClick={discardDraft} className="rounded border border-amber-300 bg-white px-4 py-3 text-sm font-black text-amber-900 hover:bg-amber-100">
                Start fresh
              </button>
            </div>
          </div>
        </section>
      )}
      {activeBuilder === "cv" ? (
        <>
        <div className="mx-auto flex max-w-7xl gap-2 px-5 pt-5 lg:hidden">
          {[
            ["edit", "Edit"],
            ["preview", "Preview"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMobileCvView(id)}
              className={`flex-1 rounded px-4 py-3 text-sm font-black ${mobileCvView === id ? "bg-green-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="builder-shell mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 lg:grid-cols-[0.9fr_1.1fr_0.65fr]">
          <aside className={`builder-panel min-w-0 space-y-5 rounded bg-white p-5 shadow-sm ring-1 ring-slate-200 ${mobileCvView === "preview" ? "hidden lg:block" : ""}`}>
            <ExistingCVImporter onImport={handleImport} />
            <ProfilePhotoUploader cv={cv} onChange={handleProfilePhotoChange} />
            {storageMessage && cloudSavingEnabled && <p className="rounded bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">{storageMessage}</p>}
            <CategorySelector selected={categoryId} onSelect={handleCategory} />
            <CVBuilderForm cv={cv} onChange={(key, value) => setCv((current) => ({ ...current, [key]: value }))} />
          </aside>
          <section className={`builder-panel min-w-0 ${mobileCvView === "edit" ? "hidden lg:block" : ""}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-950">Live CV preview</h2>
              <span className="flex items-center gap-2 text-sm font-bold text-slate-500"><Icon name="eye" className="h-4 w-4" /> Updates instantly</span>
            </div>
            <LiveCVPreview cv={cv} theme={theme} layout={layoutId} />
          </section>
          <aside className={`builder-panel min-w-0 space-y-6 rounded bg-white p-5 shadow-sm ring-1 ring-slate-200 ${mobileCvView === "preview" ? "hidden lg:block" : ""}`}>
            <CVCompletenessPanel cv={cv} />
            {cloudSavingEnabled ? (
              <MyCvsPanel user={user} cv={cv} categoryId={categoryId} themeId={themeId} layoutId={layoutId} onLoad={loadSavedCv} />
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
            <ThemeSelector selected={themeId} onSelect={setThemeId} />
            <LayoutSelector selected={layoutId} onSelect={setLayoutId} />
            <button onClick={() => setDownloadTarget("cv")} className="flex w-full items-center justify-center gap-2 rounded bg-green-600 px-5 py-4 font-bold text-white hover:bg-green-700">
              <Icon name="download" /> Download CV
            </button>
            <button onClick={() => switchBuilder("cover")} className="flex w-full items-center justify-center gap-2 rounded border border-blue-600 px-5 py-4 font-bold text-blue-700 hover:bg-blue-50">
              <Icon name="file" /> Create Cover Letter
            </button>
            <AdPlaceholder compact label="Builder page ad area" />
            {downloaded && <div className="rounded border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-900">Download confirmed. Ad area can appear below confirmation.</div>}
          </aside>
        </div>
        </>
      ) : (
        <CoverLetterBuilder
          cv={cv}
          letter={coverLetter}
          onCvChange={updateCvFromCoverLetter}
          onRoleChange={handleCoverRoleChange}
          onLetterChange={(key, value) => setCoverLetter((current) => ({ ...current, [key]: value }))}
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
      {downloadTarget === "cv" && <DownloadModal cv={cv} onClose={() => setDownloadTarget(null)} onVerifiedDownload={handleDownload} />}
      {downloadTarget === "cover" && <CoverLetterDownloadModal cv={cv} onClose={() => setDownloadTarget(null)} onVerifiedDownload={handleCoverDownload} />}
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
  const [view, setView] = useState(() => (["#builder", "#cover-letter"].includes(window.location.hash) ? "builder" : "landing"));
  const goTo = (nextView) => {
    window.location.hash = nextView === "builder" ? "builder" : "top";
    setView(nextView);
  };
  useEffect(() => {
    initAnalytics();
    const syncHash = () => setView(["#builder", "#cover-letter"].includes(window.location.hash) ? "builder" : "landing");
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  return view === "landing" ? (
    <>
      <Header onStart={() => goTo("builder")} />
      <LandingPage onStart={() => goTo("builder")} />
    </>
  ) : (
    <CVBuilderApp onHome={() => goTo("landing")} />
  );
}
