import React, { useEffect, useMemo, useState } from "react";
import { scoreCV } from "../lib/atsScorer";

const scoreColor = (score) => {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#d97706";
  return "#dc2626";
};

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

export default function ATSPanel({ cv }) {
  const [jobDescription, setJobDescription] = useState("");
  const [debouncedJobDescription, setDebouncedJobDescription] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedJobDescription(jobDescription), 800);
    return () => window.clearTimeout(timer);
  }, [jobDescription]);

  const result = useMemo(() => scoreCV(cv, debouncedJobDescription), [cv, debouncedJobDescription]);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColor(result.score);
  const offset = circumference * (1 - result.score / 100);

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
              <h3>ATS Score Checker</h3>
              <p>Live CV score for UAE and GCC applications.</p>
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
            <textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={4} />
          </label>
          <AccordionBlock title="Passed checks" items={result.passed} tone="green" />
          <AccordionBlock title="Warnings" items={result.warnings} tone="amber" />
          <AccordionBlock title="Tips" items={result.tips} tone="blue" />
        </>
      )}
    </section>
  );
}
