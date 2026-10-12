import React, { useEffect, useMemo, useState } from "react";
import { scoreCV } from "../lib/atsScorer";

const scoreColor = (score) => {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#d97706";
  return "#dc2626";
};

const tokenize = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3);

const fillWords = new Set([
  "with", "that", "this", "from", "your", "have", "will", "their", "they", "role",
  "team", "work", "years", "year", "good", "must", "able", "need", "jobs", "job",
  "looking", "candidate", "experience", "required", "preferred", "skills", "skill",
]);

function AccordionBlock({ title, items, tone }) {
  const colors = {
    green: "ats-list-green",
    amber: "ats-list-amber",
    blue: "ats-list-blue",
  };
  return (
    <details className="ats-accordion" open>
      <summary>{title}</summary>
      <ul className={colors[tone]}>
        {(items.length ? items : ["No items yet. Keep filling your CV."]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  );
}

export default function ATSPanel({
  cv,
  jobDescription = "",
  onJobDescriptionChange,
  onApplySuggestion,
  onTrackEvent,
}) {
  const [debouncedJobDescription, setDebouncedJobDescription] = useState(jobDescription || "");
  const [collapsed, setCollapsed] = useState(false);
  const [viewTracked, setViewTracked] = useState(false);
  const [pasteTracked, setPasteTracked] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedJobDescription(jobDescription || ""), 500);
    return () => window.clearTimeout(timer);
  }, [jobDescription]);

  useEffect(() => {
    if (viewTracked) return;
    onTrackEvent?.("ats_score_viewed", { scoreVisible: true });
    setViewTracked(true);
  }, [onTrackEvent, viewTracked]);

  useEffect(() => {
    if (!debouncedJobDescription.trim() || pasteTracked) return;
    onTrackEvent?.("job_description_pasted", { length: debouncedJobDescription.trim().length });
    setPasteTracked(true);
  }, [debouncedJobDescription, onTrackEvent, pasteTracked]);

  const result = useMemo(() => scoreCV(cv, debouncedJobDescription), [cv, debouncedJobDescription]);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColor(result.score);
  const offset = circumference * (1 - result.score / 100);

  const keywordInsights = useMemo(() => {
    const cvTokens = new Set(tokenize([
      cv.jobTitle,
      cv.summary,
      cv.skills,
      cv.languages,
      cv.certifications,
      ...(Array.isArray(cv.workExperiences) ? cv.workExperiences.map((entry) => [entry.jobTitle, entry.employer, entry.responsibilities].join(" ")) : []),
    ].join(" ")));
    const ranked = new Map();
    tokenize(debouncedJobDescription)
      .filter((word) => !fillWords.has(word))
      .forEach((word) => ranked.set(word, (ranked.get(word) || 0) + 1));
    const missingKeywords = [...ranked.entries()]
      .filter(([word]) => !cvTokens.has(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);
    const recommendedSkills = missingKeywords.slice(0, 5).map((word) =>
      word
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-"),
    );
    return { missingKeywords, recommendedSkills };
  }, [cv, debouncedJobDescription]);

  const weakSections = useMemo(() => {
    const sections = [];
    if ((cv.summary || "").trim().length < 60) sections.push("Professional summary needs more role-specific detail.");
    if ((cv.skills || "").split(/[\n,;]+/).filter(Boolean).length < 5) sections.push("Skills section is still too short for ATS matching.");
    if (!(cv.workExperiences || []).some((entry) => (entry.responsibilities || "").trim().length > 90)) {
      sections.push("Work experience bullets need more measurable detail.");
    }
    return sections;
  }, [cv]);

  const suggestionActions = [
    { id: "summary", label: "Improve Summary" },
    { id: "experience", label: "Improve Experience Bullets" },
    { id: "skills", label: "Add Missing Skills" },
    { id: "all", label: "Apply Suggestions" },
  ];

  const handleAction = (action) => {
    onTrackEvent?.("ai_rewrite_clicked", { action });
    onApplySuggestion?.(action, keywordInsights);
  };

  return (
    <section className={`ats-panel ${collapsed ? "collapsed" : ""}`}>
      <button type="button" className="ats-mobile-toggle" onClick={() => setCollapsed((value) => !value)}>
        ATS Score {result.score}% <span>{collapsed ? "Open" : "Hide"}</span>
      </button>
      {!collapsed && (
        <>
          <div className="ats-score-header">
            <svg className="ats-score-ring" width="108" height="108" viewBox="0 0 108 108" role="img" aria-label={`ATS score ${result.score}`}>
              <circle cx="54" cy="54" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
              <circle
                cx="54"
                cy="54"
                r={radius}
                stroke={color}
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 54 54)"
              />
              <text x="54" y="50" textAnchor="middle" className="ats-score-number">{result.score}</text>
              <text x="54" y="68" textAnchor="middle" className="ats-score-label">ATS</text>
            </svg>
            <div>
              <span className="ats-grade" style={{ background: color }}>Grade {result.grade}</span>
              <h3>Tailor CV to a Job</h3>
              <p>Paste a job description, compare the match, and improve weak sections before you download.</p>
            </div>
          </div>
          <div className="ats-breakdown">
            {Object.entries(result.breakdown).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <label className="ats-job-field">
            <span>Paste a job posting to check keyword match</span>
            <textarea
              value={jobDescription}
              onChange={(event) => onJobDescriptionChange?.(event.target.value)}
              rows={5}
              placeholder="Paste the vacancy description here to compare your CV against the target role."
            />
          </label>
          <div className="rounded border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-black text-slate-950">Match score and suggested fixes</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Missing keywords</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(keywordInsights.missingKeywords.length ? keywordInsights.missingKeywords : ["Paste a job description to see missing keywords."]).map((word) => (
                    <span key={word} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">{word}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Recommended skills</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(keywordInsights.recommendedSkills.length ? keywordInsights.recommendedSkills : ["More role-specific skills will appear here."]).map((word) => (
                    <span key={word} className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-900">{word}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-black uppercase text-slate-500">Weak sections</p>
              <ul className="mt-2 space-y-2 text-sm font-bold leading-6 text-slate-700">
                {(weakSections.length ? weakSections : ["Your main sections already have a strong baseline."]).map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestionActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleAction(action.id)}
                  className="rounded-full border border-green-200 bg-white px-3 py-2 text-xs font-black text-green-800 hover:bg-green-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
          <AccordionBlock title="Passed checks" items={result.passed} tone="green" />
          <AccordionBlock title="Warnings" items={result.warnings} tone="amber" />
          <AccordionBlock title="Suggested improvements" items={result.tips} tone="blue" />
        </>
      )}
    </section>
  );
}
