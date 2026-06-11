import { useEffect, useRef, useState } from "react";

const templates = [
  {
    name: "Modern Blue",
    desc: "All industries - ATS",
    badge: "Most popular",
    badgeBg: "#dbeafe",
    badgeColor: "#1e40af",
    accent: "#2563eb",
    hdrBg: "linear-gradient(135deg,#1e40af 0%,#3b82f6 55%,#60a5fa 100%)",
    bodyBg: "#eff6ff",
    bodyAccent: "#93c5fd",
    person: "James M.",
    role: "Business Analyst",
    loc: "New York, USA",
    gender: "male",
    skin: "#f0b87a",
    hair: "#3d2b1f",
    shirt: "#1e40af",
    tieColor: "#93c5fd",
    hasTie: true,
    skills: ["Strategy", "Analytics", "Excel"],
    skillBg: "#dbeafe",
    skillClr: "#1e40af",
    typeChar: "Business",
    tag: "All industries",
  },
  {
    name: "Hospitality Pro",
    desc: "Hotels - F&B - Tourism",
    badge: "Global favourite",
    badgeBg: "#dcfce7",
    badgeColor: "#166534",
    accent: "#16a34a",
    hdrBg: "linear-gradient(135deg,#065f46 0%,#059669 55%,#34d399 100%)",
    bodyBg: "#f0fdf4",
    bodyAccent: "#86efac",
    person: "Amina N.",
    role: "Hotel Manager",
    loc: "Dubai, UAE",
    gender: "female",
    skin: "#d4956a",
    hair: "#1a0a00",
    shirt: "#064e3b",
    hasScarf: true,
    scarfColor: "#34d399",
    skills: ["F&B Ops", "Hospitality", "PMS"],
    skillBg: "#dcfce7",
    skillClr: "#166534",
    typeChar: "Hospitality",
    tag: "Hotels & F&B",
  },
  {
    name: "IT & Tech",
    desc: "Dev - QA - IT Support",
    badge: "ATS optimised",
    badgeBg: "#ede9fe",
    badgeColor: "#5b21b6",
    accent: "#7c3aed",
    hdrBg: "linear-gradient(135deg,#4c1d95 0%,#7c3aed 55%,#a78bfa 100%)",
    bodyBg: "#faf5ff",
    bodyAccent: "#c4b5fd",
    person: "Rahul K.",
    role: "Software Engineer",
    loc: "London, UK",
    gender: "male",
    skin: "#c8a882",
    hair: "#111111",
    shirt: "#4c1d95",
    hasLaptop: true,
    skills: ["React", "Python", "AWS"],
    skillBg: "#ede9fe",
    skillClr: "#5b21b6",
    typeChar: "Software",
    tag: "Dev & IT",
  },
  {
    name: "Engineering",
    desc: "Civil - Structural - MEP",
    badge: "GCC & global",
    badgeBg: "#ffedd5",
    badgeColor: "#9a3412",
    accent: "#ea580c",
    hdrBg: "linear-gradient(135deg,#7c2d12 0%,#ea580c 55%,#fb923c 100%)",
    bodyBg: "#fff7ed",
    bodyAccent: "#fdba74",
    person: "Sara L.",
    role: "Civil Engineer",
    loc: "Dubai, UAE",
    gender: "female",
    skin: "#e8c49a",
    hair: "#4a2800",
    shirt: "#9a3412",
    hasHat: true,
    skills: ["AutoCAD", "Revit", "PMP"],
    skillBg: "#ffedd5",
    skillClr: "#9a3412",
    typeChar: "Engineer",
    tag: "Civil & MEP",
  },
  {
    name: "Finance & Banking",
    desc: "Banks - Accounting - CFA",
    badge: "ATS optimised",
    badgeBg: "#dbeafe",
    badgeColor: "#1e40af",
    accent: "#1d4ed8",
    hdrBg: "linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 55%,#60a5fa 100%)",
    bodyBg: "#eff6ff",
    bodyAccent: "#93c5fd",
    person: "Carlos M.",
    role: "Finance Analyst",
    loc: "London, UK",
    gender: "male",
    skin: "#e8b88a",
    hair: "#2d1b00",
    shirt: "#1e3a8a",
    tieColor: "#93c5fd",
    hasTie: true,
    skills: ["CFA", "Excel", "SQL"],
    skillBg: "#dbeafe",
    skillClr: "#1e40af",
    typeChar: "Finance",
    tag: "Finance",
  },
  {
    name: "General / OFW",
    desc: "Any role - Worldwide",
    badge: "Beginner friendly",
    badgeBg: "#dcfce7",
    badgeColor: "#166534",
    accent: "#059669",
    hdrBg: "linear-gradient(135deg,#064e3b 0%,#059669 55%,#6ee7b7 100%)",
    bodyBg: "#f0fdf4",
    bodyAccent: "#86efac",
    person: "Maria S.",
    role: "Admin Supervisor",
    loc: "Manila to Dubai",
    gender: "female",
    skin: "#c8895a",
    hair: "#0d0600",
    shirt: "#065f46",
    skills: ["MS Office", "Admin", "English"],
    skillBg: "#dcfce7",
    skillClr: "#166534",
    typeChar: "General",
    tag: "Any industry",
  },
];

function Avatar({ template, hovered }) {
  const t = template;
  return (
    <svg className={`tsv3-avatar ${hovered ? "is-hovered" : ""}`} width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill={t.accent} />
      <circle cx="24" cy="24" r="24" fill="#ffffff" opacity=".08" />
      {t.gender === "female" ? (
        <>
          <path d="M7 48 Q7 33 16 31 L24 35 L32 31 Q41 33 41 48Z" fill={t.shirt} />
          {t.hasScarf && <path d="M19 31 Q24 35 29 31 L30 36 Q24 38 18 36Z" fill={t.scarfColor} opacity=".85" />}
          <path d="M15 20 Q13 28 15 35" fill="none" stroke={t.hair} strokeWidth="4.4" strokeLinecap="round" />
          <path d="M33 20 Q35 28 33 35" fill="none" stroke={t.hair} strokeWidth="4.4" strokeLinecap="round" />
          {t.hasHat && (
            <>
              <path d="M13 22 Q13 9 24 9 Q35 9 35 22" fill="#fbbf24" opacity=".94" />
              <rect x="11" y="21" width="26" height="3" rx="1.5" fill="#f59e0b" />
            </>
          )}
          <rect x="20" y="28" width="8" height="8" rx="2" fill={t.skin} />
          <ellipse cx="24" cy="22" rx="9" ry="9.7" fill={t.skin} />
          {!t.hasHat && <path d="M15 20 Q14 10 24 10 Q34 10 33 20 Q31 13 24 12 Q17 13 15 20Z" fill={t.hair} />}
          {t.hasHat && <path d="M15 23 Q16 15 24 14 Q32 15 33 23" fill={t.hair} opacity=".45" />}
          <ellipse cx="21" cy="22" rx="1.35" ry="1.5" fill="#ffffff" />
          <ellipse cx="27" cy="22" rx="1.35" ry="1.5" fill="#ffffff" />
          <circle cx="21.4" cy="22.5" r=".85" fill="#1a1a1a" />
          <circle cx="27.4" cy="22.5" r=".85" fill="#1a1a1a" />
          <path d="M19.5 20.8 L20.2 20 M21 20.5 L21 19.5 M22.5 20.8 L22 20" fill="none" stroke="#1a1a1a" strokeWidth=".7" strokeLinecap="round" />
          <path d="M25.5 20.8 L26.2 20 M27 20.5 L27 19.5 M28.5 20.8 L28 20" fill="none" stroke="#1a1a1a" strokeWidth=".7" strokeLinecap="round" />
          <path d="M20.8 26 Q24 28.8 27.2 26" fill="none" stroke="#b06040" strokeWidth="1" strokeLinecap="round" opacity=".75" />
          <ellipse cx="19" cy="25" rx="2.5" ry="1.2" fill="#f87171" opacity=".2" />
          <ellipse cx="29" cy="25" rx="2.5" ry="1.2" fill="#f87171" opacity=".2" />
        </>
      ) : (
        <>
          {t.hasLaptop ? (
            <>
              <path d="M7 48 Q7 33 16 31 L24 35 L32 31 Q41 33 41 48Z" fill="#374151" />
              <path d="M19 31 L24 37 L29 31" fill="#1f2937" />
              <rect x="12" y="39.5" width="24" height="12.5" rx="2" fill="#1f2937" />
              <rect x="14" y="42" width="20" height="8" rx=".5" fill="#0f172a" />
              <rect x="15" y="43" width="6" height="1" rx=".5" fill="#10b981" opacity=".9" />
              <rect x="15" y="45" width="12" height="1" rx=".5" fill="#6366f1" opacity=".55" />
              <rect x="15" y="47" width="9" height="1" rx=".5" fill="#60a5fa" opacity=".45" />
            </>
          ) : (
            <>
              <path d="M7 48 Q7 33 16 31 L24 35 L32 31 Q41 33 41 48Z" fill={t.shirt} />
              <path d="M21.5 31 L24 33 L26.5 31 L26 45 L24 46.5 L22 45Z" fill="#ffffff" opacity=".12" />
              {t.hasTie && <path d="M22 31.5 L24 34 L26 31.5 L25.4 43 L24 44.5 L22.6 43Z" fill={t.tieColor} opacity=".92" />}
            </>
          )}
          <rect x="20" y="28" width="8" height="8" rx="2" fill={t.skin} />
          <ellipse cx="24" cy="22" rx="9" ry="9.5" fill={t.skin} />
          <path d="M15 19 Q15 10 24 10 Q33 10 33 19 Q31.5 12.5 24 12.5 Q16.5 12.5 15 19Z" fill={t.hair} />
          <circle cx="21" cy="22" r="1.35" fill="#ffffff" />
          <circle cx="27" cy="22" r="1.35" fill="#ffffff" />
          <circle cx="21.4" cy="22.4" r=".85" fill="#1a1a1a" />
          <circle cx="27.4" cy="22.4" r=".85" fill="#1a1a1a" />
          <path d="M21 26.5 Q24 29 27 26.5" fill="none" stroke="#a06030" strokeWidth="1" strokeLinecap="round" opacity=".65" />
        </>
      )}
      <ellipse cx="19" cy="14" rx="3" ry="1.8" fill="#ffffff" opacity=".07" />
    </svg>
  );
}

function CVHeader({ template, hovered }) {
  const [typed, setTyped] = useState("");
  const [cursor, setCursor] = useState(true);
  const typingRef = useRef(null);
  const cursorRef = useRef(null);

  useEffect(() => {
    clearInterval(typingRef.current);
    clearInterval(cursorRef.current);
    if (!hovered) {
      setTyped("");
      setCursor(true);
      return undefined;
    }

    let index = 0;
    setTyped("");
    typingRef.current = setInterval(() => {
      index += 1;
      setTyped(template.typeChar.slice(0, index));
      if (index >= template.typeChar.length) {
        clearInterval(typingRef.current);
        cursorRef.current = setInterval(() => setCursor((value) => !value), 530);
      }
    }, 65);

    return () => {
      clearInterval(typingRef.current);
      clearInterval(cursorRef.current);
    };
  }, [hovered, template.typeChar]);

  return (
    <div className="tsv3-card-header" style={{ background: template.hdrBg }}>
      <svg className="tsv3-card-grid-bg" aria-hidden="true">
        <defs>
          <pattern id={`tsv3-grid-${template.name.replace(/\W+/g, "-")}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0 L0 0 0 16" fill="none" stroke="#ffffff" strokeWidth=".5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#tsv3-grid-${template.name.replace(/\W+/g, "-")})`} />
      </svg>
      <div className="tsv3-industry-tag">
        {hovered ? (
          <>
            {typed}
            <span style={{ opacity: cursor ? 1 : 0 }}>|</span>
          </>
        ) : (
          template.tag
        )}
      </div>
      <div className="tsv3-person-row">
        <Avatar template={template} hovered={hovered} />
        <div className="tsv3-person-copy">
          <div className="tsv3-person-name">{template.person}</div>
          <div className="tsv3-person-role">{template.role}</div>
          <div className="tsv3-person-location">{template.loc}</div>
        </div>
        <div className="tsv3-ats-badge">ATS OK</div>
      </div>
    </div>
  );
}

function CVBody({ template }) {
  return (
    <div className="tsv3-card-body" style={{ background: template.bodyBg }}>
      <div className="tsv3-line tsv3-line-accent" style={{ background: template.accent }} />
      <div className="tsv3-line" style={{ background: template.bodyAccent, width: "84%" }} />
      <div className="tsv3-line" style={{ width: "66%" }} />
      <div className="tsv3-line" style={{ width: "74%" }} />
      <div className="tsv3-divider" />
      <div className="tsv3-line" style={{ width: "90%" }} />
      <div className="tsv3-line" style={{ width: "72%" }} />
      <div className="tsv3-skills">
        {template.skills.map((skill) => (
          <span key={skill} style={{ background: template.skillBg, color: template.skillClr }}>{skill}</span>
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ template, onStart }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Start with ${template.name} CV template`}
      className="tsv3-card"
      style={{ "--template-accent": template.accent }}
      onClick={onStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <CVHeader template={template} hovered={hovered} />
      <CVBody template={template} />
      <div className="tsv3-card-footer">
        <div className="tsv3-card-footer-top">
          <div>
            <div className="tsv3-card-name">{template.name}</div>
            <div className="tsv3-card-desc">{template.desc}</div>
          </div>
          <div className="tsv3-dot" style={{ background: template.accent }} />
        </div>
        <span className="tsv3-badge" style={{ background: template.badgeBg, color: template.badgeColor }}>
          {template.badge}
        </span>
      </div>
    </button>
  );
}

export default function TemplatesSectionV3({ onStart }) {
  return (
    <section className="tsv3" id="templates" aria-labelledby="tsv3-heading">
      <div className="tsv3-inner">
        <div className="tsv3-header">
          <div className="tsv3-eyebrow">Templates</div>
          <h2 className="tsv3-heading" id="tsv3-heading">Built for every career, everywhere.</h2>
          <p className="tsv3-subtitle">
            Choose a premium-looking CV template with friendly avatar previews for business, hospitality, IT, engineering, finance, and general roles.
          </p>
        </div>
        <div className="tsv3-grid">
          {templates.map((template) => (
            <TemplateCard key={template.name} template={template} onStart={onStart} />
          ))}
        </div>
        <div className="tsv3-footer">
          <button type="button" className="tsv3-button" onClick={onStart}>
            Browse all templates
            <span aria-hidden="true">-&gt;</span>
          </button>
          <p className="tsv3-note"><strong>6 featured templates</strong> - more inside the free builder.</p>
        </div>
        <div className="tsv3-trust" aria-label="Template benefits">
          {[
            ["OK", "ATS-tested"],
            ["25", "2025 standards"],
            ["PDF", "Instant PDF"],
            ["60+", "Countries"],
          ].map(([icon, label]) => (
            <div key={label} className="tsv3-trust-item">
              <span aria-hidden="true">{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
