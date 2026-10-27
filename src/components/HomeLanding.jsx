import React, { useEffect, useRef, useState } from "react";
import { homeCvExamples as designs } from "../data/homeCvExamples.js";
import { homepageFaqs } from "../content/seoFaq.js";
import { HOME_SUBHEAD, HOME_HOW_IT_WORKS_STEPS, HOME_VIDEO } from "../content/homepage.js";
import "./homeLanding.css";
import { useHomeMotion } from "../hooks/usePageMotion.js";



function MotionHeading({ children, ...props }) {
  return <h2 {...props}>{typeof children === "string" ? children.split(" ").map((word, index) => <React.Fragment key={index}><span className="hm-word-mask"><span className="hm-word-inner">{word}</span></span>{" "}</React.Fragment>) : children}</h2>;
}

function MovingBands() {
  const rows = [designs.map(design => design.category), ["Free PDF & Word", "AI writing help", "No download paywall", "No account needed", "Live CV preview"]];
  return <div className="hm-marquees" aria-label="Job categories and free CV features">{rows.map((items, row) => <div className="hm-marquee" key={row}><div className={"hm-marquee-track " + (row ? "hm-outline" : "")}>{[0, 1].map(copy => <div className="hm-marquee-copy" key={copy} aria-hidden={copy === 1 ? true : undefined}>{items.map(item => <span key={item}>{item}<b aria-hidden="true">✦</b></span>)}</div>)}</div></div>)}</div>;
}

function Symbol({ name, ...props }) {
  const paths = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    play: <path d="m9 5 10 7-10 7Z" />,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    sparkle: <><path d="m12 3 2 6 6 3-6 2-2 7-2-7-6-2 6-3Z" /></>,
    save: <><path d="M5 3h12l4 4v14H3V3Zm2 0v6h10V3M7 21v-8h10v8" /></>,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.file}</svg>;
}

function BuilderLink({ onStart, query = "", children, className }) {
  const href = `/builder${query ? `?${query}` : ""}`;
  return <a className={className} href={href} onClick={(event) => {
    if (!onStart || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onStart(href);
  }}>{children}</a>;
}

function MiniCv({ design }) {
  return <img className="hm-builder-example" src={design.image} alt={`${design.role} sample CV using ${design.name}`} width="794" height="1123" loading="lazy" />;
}

function TemplatesGallery({ onStart }) {
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState(null);
  const closeRef = useRef(null);
  const openerRef = useRef(null);
  useEffect(() => {
    if (!preview) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") setPreview(null);
      if (event.key === "Tab") {
        const focusable = closeRef.current?.closest('[role="dialog"]')?.querySelectorAll('button, a[href]');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKey);
      openerRef.current?.focus();
    };
  }, [preview]);
  const matching = designs.filter((design) => filter === "all" || design.id === filter);
  const visible = showAll || filter !== "all" ? matching : matching.slice(0, 6);
  return <section className="hm-section hm-templates" id="templates" aria-labelledby="hm-templates-title">
    <div className="hm-wrap">
      <div className="hm-section-heading"><div><span className="hm-eyebrow">Free templates</span><MotionHeading id="hm-templates-title">Pick a template made for your job.</MotionHeading><p>Choose your industry, explore the layout, and make it your own.</p></div>
        <span className="hm-count" aria-live="polite">{matching.length} templates</span>
      </div>
      <div className="hm-category-tabs" role="group" aria-label="Filter templates by job category"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>{designs.map((design) => <button type="button" key={design.id} aria-pressed={filter === design.id} onClick={() => setFilter(design.id)}>{design.category}</button>)}</div><div className={`hm-template-grid ${showAll || filter !== "all" ? "hm-template-grid-expanded" : ""}`}>
        {visible.map((design) => <article className="hm-template" key={design.id}>
          <button type="button" className="hm-template-preview" aria-label={`Preview ${design.category} CV`} onClick={(event) => { openerRef.current = event.currentTarget; setPreview(design); }}><MiniCv design={design} /><span className="hm-preview-label">Preview template <Symbol name="arrow" /></span></button>
          <div className="hm-template-info"><span className="hm-industry">{design.category}</span><h3>{design.name}</h3><p>{design.role}</p><BuilderLink onStart={onStart} query={`category=${design.id}&theme=${design.theme}&layout=${design.layout}`} className="hm-template-use">Use this template <Symbol name="arrow" /></BuilderLink></div>
        </article>)}
      </div>
      {filter === "all" && <button type="button" className="hm-text-button hm-show-all" onClick={() => setShowAll(!showAll)}>{showAll ? "Show featured templates" : `Explore all ${designs.length} job categories`} <Symbol name="arrow" /></button>}
      <p className="hm-small-note">Sample details are illustrative. You can edit every field and switch designs in the builder.</p>
    </div>
    {preview && <div className="hm-modal-backdrop" onClick={() => setPreview(null)}><section className="hm-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="hm-preview-title" onClick={(event) => event.stopPropagation()}>
      <div className="hm-dialog-heading"><div><h2 id="hm-preview-title">{preview.category}</h2><p>{preview.name}</p></div><button type="button" ref={closeRef} onClick={() => setPreview(null)} className="hm-icon-button" aria-label="Close template preview"><Symbol name="close" /></button></div>
      <div className="hm-dialog-document"><MiniCv design={preview} /></div>
      <BuilderLink className="hm-button hm-primary" onStart={onStart} query={`category=${preview.id}&theme=${preview.theme}&layout=${preview.layout}`}>Use this template <Symbol name="arrow" /></BuilderLink>
    </section></div>}
  </section>;
}

function ImprovementDemo({ onStart }) {
  const [view, setView] = useState("after");
  const [accepted, setAccepted] = useState(false);
  return <section className="hm-section hm-improve" id="improve" aria-labelledby="hm-improve-title"><div className="hm-wrap"><div className="hm-section-heading"><div><span className="hm-eyebrow">Already have a CV?</span><h2 id="hm-improve-title">Don’t start over. Make the one you have better.</h2><p>Upload your current CV and bring your experience with you. Then polish it in three easy moves.</p></div></div><div className="hm-improve-grid">
  <article className="hm-improve-card"><span className="hm-eyebrow">Step 1</span><h3>Upload your CV</h3><div className="hm-upload-box"><Symbol name="upload"/><strong>Your experience starts here</strong><p>Import a PDF or Word file in the builder.</p><BuilderLink onStart={onStart} query="start=upload" className="hm-button hm-primary">Choose file <Symbol name="arrow"/></BuilderLink></div><p className="hm-small-note">Review your imported details before using them.</p></article>
  <article className="hm-improve-card"><span className="hm-eyebrow">Step 2 · Interactive example</span><h3>Improve wording with AI</h3><div className="hm-demo-tabs" role="group" aria-label="Compare example wording"><button type="button" aria-pressed={view === "before"} onClick={() => setView("before")}>Your version</button><button type="button" aria-pressed={view === "after"} onClick={() => setView("after")}>AI suggestion</button></div><blockquote>{view === "before" ? "“Did check in for guests and answered phone.”" : "“Welcomed guests, handled check-in and check-out, and answered phone enquiries quickly and politely.”"}</blockquote><div className="hm-demo-actions"><button type="button" className="hm-button hm-primary" disabled={accepted} onClick={() => { setAccepted(true); setView("after"); }}>{accepted ? "Accepted" : "Accept change"}</button><button type="button" className="hm-text-button" onClick={() => { setAccepted(false); setView("before"); }}>Keep mine</button></div><p className="hm-small-note" role="status">{accepted ? "Example suggestion accepted. Your real CV is unchanged." : "Nothing changes until you say yes. Try this example."}</p></article>
  <article className="hm-improve-card"><span className="hm-eyebrow">Step 3</span><h3>Check your CV strength</h3><div className="hm-strength-heading"><span>Example CV strength</span><strong>{accepted ? "Strong" : "Good"}</strong></div><div className="hm-strength-track"><span style={{ width: accepted ? "86%" : "68%" }}/></div><ul className="hm-check-list"><li><Symbol name="check"/> Contact details complete</li><li><Symbol name="check"/> Work history added</li><li><Symbol name="check"/> {accepted ? "Clear, action-led wording" : "Wording could be clearer"}</li><li><Symbol name="sparkle"/> Add 1–2 more skills</li></ul><BuilderLink onStart={onStart} className="hm-text-button">Build and check my CV <Symbol name="arrow"/></BuilderLink><p className="hm-small-note">Illustrative guidance, not a guarantee of interviews.</p></article>
  </div></div></section>;
}

export default function HomeLanding({ onStart }) {
  const [motionPaused, setMotionPaused] = useState(false);
  const motionRoot = useHomeMotion(motionPaused);
  const [example, setExample] = useState("hospitality");
  const selected = designs.find((design) => design.id === example);
  return <div className="hm-home" ref={motionRoot}><a className="hm-skip" href="#top">Skip to content</a>
    <header className="hm-nav"><div className="hm-wrap hm-nav-inner"><a className="hm-logo" href="/" aria-label="BuildMyCVNow home"><span><Symbol name="file" /></span>BuildMyCV<span className="hm-logo-now">Now</span></a><nav aria-label="Main navigation"><a href="#improve">Improve my CV</a><a href="#templates">Templates</a><a href="#free-download">Free download</a><a href="#faq">FAQ</a><a href="/blog">Career tips</a></nav><BuilderLink onStart={onStart} className="hm-button hm-primary hm-nav-start">Build my CV — free <Symbol name="arrow" /></BuilderLink></div></header>
    <main id="top">
      <section className="hm-hero"><div className="hm-wrap hm-hero-grid">
        <div className="hm-hero-copy"><span className="hm-eyebrow"><Symbol name="globe" /> 100% free · No account needed · PDF & Word</span><h1 aria-label="Make your CV job-ready today."><span className="hm-headline-line" aria-hidden="true">{["Make", "your", "CV"].map(word => <React.Fragment key={word}><span className="hm-word-mask"><span className="hm-word-inner">{word}</span></span>{" "}</React.Fragment>)}</span><span className="hm-rotating-line" aria-hidden="true"><mark><span className="hm-rotating-word">job-ready</span></mark></span>{" "}<span className="hm-word-mask" aria-hidden="true"><span className="hm-word-inner">today.</span></span></h1><p>{HOME_SUBHEAD}</p>
          <div className="hm-intent"><h2>What would you like to do?</h2><div className="hm-actions"><BuilderLink onStart={onStart} query="start=upload" className="hm-intent-card hm-intent-primary"><Symbol name="upload"/><span><strong>Improve my existing CV</strong><small>Upload it — keep your experience and polish it</small></span><span className="hm-popular">Most popular</span></BuilderLink><a href="#templates" className="hm-intent-card"><Symbol name="file"/><span><strong>Start from a template</strong><small>Pick one made for your job — 10 categories</small></span><Symbol name="arrow"/></a></div></div><a className="hm-download-explainer" href="#free-download">How do free downloads work? <Symbol name="arrow"/></a>
          <div className="hm-trust"><span><Symbol name="check" /> Free PDF & Word</span><span><Symbol name="check" /> No account required</span><span><Symbol name="check" /> AI writing help</span></div>
          <p className="hm-otp-note">Free downloads unlock with a quick email verification.</p>
        </div>
        <figure className="hm-hero-illustration" aria-label="Illustrative CV with AI wording and strength guidance"><div className="hm-illustration-cv"><aside aria-hidden="true"><span className="hm-avatar-placeholder"/>{[80,60,90,70,85,50].map((width,i) => <span key={i} className="hm-skeleton-line" style={{width:width+"%"}}/>)}</aside><div className="hm-illustration-body"><strong>Maria Santos</strong><p>Hotel Receptionist · Dubai</p><h3>Experience</h3><p className="hm-highlighted-duty">Welcomed guests, handled check-in and check-out, and resolved room requests quickly and politely.</p>{[95,80,88].map(width => <span key={width} className="hm-skeleton-line" style={{width:width+"%"}}/>)}<h3>Skills</h3><div className="hm-sample-skills"><span>Front desk</span><span>Opera PMS</span><span>English · Filipino</span></div>{[70,60].map(width => <span key={width} className="hm-skeleton-line" style={{width:width+"%"}}/>)}</div></div><div className="hm-ai-chip"><Symbol name="sparkle"/> AI rewrote 1 line — you approve it</div><div className="hm-strength-chip"><div><strong>CV strength</strong><strong>Strong</strong></div><div className="hm-strength-track"><span style={{width:"82%"}}/></div><small>Tip: add one more skill</small></div><figcaption>Illustrative CV and AI suggestion</figcaption></figure>
      </div></section>
      <div className="hm-quick-steps"><div className="hm-wrap">{[["Upload or pick a template", "Your old CV or a fresh start"], ["Improve with AI", "Clearer wording, your approval"], ["Download free", "PDF or Word, ready to send"]].map(([title, text], index) => <div key={title}><span className="hm-step-number">{index + 1}</span><span><strong>{title}</strong><small>{text}</small></span></div>)}<a href="#how-it-works"><Symbol name="play"/> Watch the walkthrough</a></div></div>
      <div className="hm-motion-control hm-wrap"><button type="button" aria-pressed={motionPaused} onClick={() => setMotionPaused(value => !value)}>{motionPaused ? "Play animations" : "Pause animations"}</button></div><MovingBands/><ImprovementDemo onStart={onStart} /><TemplatesGallery onStart={onStart} />
      <section className="hm-section hm-access" id="free-download" aria-labelledby="hm-access-title"><div className="hm-wrap"><div className="hm-section-heading"><div><span className="hm-eyebrow">Free, whichever way you work</span><h2 id="hm-access-title">Your CV, downloaded free. No paywall.</h2></div></div><div className="hm-access-grid"><article><Symbol name="download" /><h3>Just need a CV?</h3><p>Build and edit without an account. Verify your email with an OTP, then download PDF or Word. Your CV is not saved online.</p><ul className="hm-check-list"><li><Symbol name="check"/>PDF and Word files</li><li><Symbol name="check"/>No sign-up, no payment</li><li><Symbol name="check"/>Quick email verification</li></ul><BuilderLink onStart={onStart} className="hm-button hm-primary">Build my CV to download <Symbol name="download"/></BuilderLink></article><article><Symbol name="save" /><h3>Want to keep your versions?</h3><p>Create a free account to save up to 10 CVs online. Online copies are stored for 15 days, so download your files for your own records.</p><ul className="hm-check-list"><li><Symbol name="check"/>Store up to 10 CVs</li><li><Symbol name="check"/>Kept online for 15 days</li><li><Symbol name="check"/>A different CV for each job</li></ul><BuilderLink onStart={onStart} query="access=save" className="hm-button hm-secondary">Create free account <Symbol name="arrow" /></BuilderLink></article></div></div></section>
      <section className="hm-translate"><div className="hm-wrap"><div><span className="hm-eyebrow">Applying abroad?</span><h2>Translate your CV.</h2><p>Upload once, choose another language, then review the result.</p><ul className="hm-global-languages" aria-label="Example translation languages">{["English", "العربية", "Français", "Deutsch", "Nederlands"].map((language) => <li key={language}>{language}</li>)}</ul></div><BuilderLink className="hm-button hm-primary" onStart={onStart} query="start=upload">Upload &amp; translate <Symbol name="arrow"/></BuilderLink></div></section>
      <section className="hm-section hm-how" id="how-it-works" aria-labelledby="hm-how-title"><div className="hm-wrap"><div className="hm-section-heading"><div><span className="hm-eyebrow">How it works</span><h2 id="hm-how-title">Build a professional CV in minutes</h2><p>A guided path from your first detail to your next application.</p></div></div><div className="hm-how-grid">
        <div className="hm-walkthrough"><div className="hm-video-frame"><video controls playsInline preload="none" poster={HOME_VIDEO.poster.replace("https://buildmycvnow.com", "")} aria-label={HOME_VIDEO.name}><source src={HOME_VIDEO.url} type="video/mp4" />Your browser cannot play this video. <a href={HOME_VIDEO.url}>Watch the walkthrough</a>.</video></div><h3>Watch the walkthrough</h3><p>Choose a template, add your details, improve your CV with AI, and download your PDF.</p><BuilderLink className="hm-button hm-primary" onStart={onStart}>Start my free CV <Symbol name="arrow" /></BuilderLink></div>
        <ol className="hm-timeline">{HOME_HOW_IT_WORKS_STEPS.map((step, index) => <li key={step.title}><span className="hm-step-number">{index + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>
      </div></div></section>
      <section className="hm-section hm-faq" id="faq"><div className="hm-wrap hm-faq-grid"><div><span className="hm-eyebrow">Good to know</span><h2>Quick answers.</h2><p>More questions? <a href="/faq">See all questions</a> or <a href="/contact">get in touch</a>.</p></div><div>{homepageFaqs.slice(0, 10).map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></div></section>
      <div className="hm-big-band" aria-hidden="true"><div className="hm-big-line">Free CV builder • Free templates • Free download</div><div className="hm-big-line hm-outline">Upload • Improve • Download</div></div><section className="hm-final"><div className="hm-wrap"><div><span className="hm-eyebrow">Ready when you are</span><h2>Your next job starts with a better CV.</h2><p>Free templates. AI help you control. Free PDF & Word download.</p></div><div className="hm-final-actions"><BuilderLink onStart={onStart} query="start=upload" className="hm-button hm-primary">Improve my existing CV <Symbol name="arrow" /></BuilderLink><a href="#templates" className="hm-button hm-secondary">Browse templates</a></div></div></section>
    </main>
    <footer className="hm-footer"><div className="hm-wrap"><div><a className="hm-logo" href="/">BuildMyCV<span className="hm-logo-now">Now</span></a><p>Free CV builder for job seekers worldwide.</p><a href="mailto:info@buildmycvnow.com">info@buildmycvnow.com</a></div><nav aria-label="Footer navigation">{[["/about", "About"], ["/contact", "Contact"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/faq", "FAQ"], ["/blog", "Career tips"]].map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav><p className="hm-copyright">Copyright {new Date().getFullYear()} BuildMyCVNow. All rights reserved.</p></div></footer>
  </div>;
}
