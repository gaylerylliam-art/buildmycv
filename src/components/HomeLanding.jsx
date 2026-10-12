import React, { useEffect, useRef, useState } from "react";
import { categories } from "../data/categories.js";
import { homepageFaqs } from "../content/seoFaq.js";
import { HOME_H1, HOME_SUBHEAD, HOME_HOW_IT_WORKS_STEPS, HOME_VIDEO } from "../content/homepage.js";
import "./homeLanding.css";

const designs = [
  ["hospitality", "Guest-ready", "green", "sidebar", "Modern sidebar", "Amina Williams", "Hotel Receptionist", "Guest service", "Welcomed guests and coordinated check-in with the front desk team.", "/assets/hotel-receptionist-cv.png"],
  ["it", "Clear & technical", "blue", "classic", "Classic single column", "Rahul Kumar", "IT Support Specialist", "Technical support", "Resolved support tickets and documented solutions for colleagues."],
  ["engineering", "Precision", "teal", "header", "Focused header", "Daniel Harris", "Mechanical Engineer", "Equipment maintenance", "Coordinated preventive maintenance and reviewed equipment performance.", "/assets/mechanical-engineer-cv.png"],
  ["finance", "Professional", "slate", "classic", "Classic single column", "Carlos Martin", "Accounts Assistant", "Financial reporting", "Reconciled invoices and maintained accurate transaction records."],
  ["marketing", "Creative clarity", "red", "header", "Focused header", "Sara Lewis", "Marketing Assistant", "Campaign planning", "Prepared campaign content and tracked social media engagement."],
  ["supply-chain-logistics", "Organised", "teal", "compact", "Compact layout", "James Morgan", "Logistics Coordinator", "Shipment coordination", "Coordinated dispatch schedules and maintained shipment records."],
  ["education", "Learning first", "blue", "header", "Focused header", "Maria Santos", "Teaching Assistant", "Student support", "Prepared learning materials and supported classroom activities."],
  ["domestic", "Simple & personal", "green", "classic", "Classic single column", "Anna Reyes", "Nanny", "Child care", "Supported daily routines and maintained a safe home environment."],
  ["skilled", "Practical", "slate", "compact", "Compact layout", "Ravi Singh", "Electrician", "Electrical maintenance", "Inspected installations and carried out repairs following safety procedures."],
  ["helper", "A strong start", "blue", "classic", "Classic single column", "John Davis", "General Helper", "Team support", "Organised materials and supported daily warehouse operations."],
].map(([id, name, theme, layout, style, person, role, skill, duty, image]) => ({
  id, name, theme, layout, style, person, role, skill, duty, image,
  category: categories.find((category) => category.id === id)?.name || id,
  color: { green: "#167855", blue: "#2563a8", teal: "#157d82", slate: "#374151", red: "#b94848" }[theme],
}));

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
  return <div className={`hm-mini-cv hm-mini-${design.layout}`} style={{ "--cv-accent": design.color }}>
    <header><strong>{design.person}</strong><span>{design.role}</span><small>name@example.com | +1 202 555 0142</small></header>
    <div className="hm-mini-content">
      <section><h4>Professional summary</h4><p>Dependable {design.role.toLowerCase()} with a practical approach to supporting teams and delivering quality work.</p></section>
      <section><h4>Work experience</h4><b>{design.role}</b><small>Example employer | 2023 - Present</small><p>{design.duty}</p></section>
      <section><h4>Skills</h4><p>{design.skill} | Communication | Organisation</p></section>
      <section><h4>Education</h4><p>Relevant qualification<br />College / training provider</p></section>
    </div>
  </div>;
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
      <div className="hm-section-heading"><div><span className="hm-eyebrow">A place to start</span><h2 id="hm-templates-title">Your experience. A better first impression.</h2><p>Choose your industry, explore the layout, and make it your own.</p></div>
        <label className="hm-filter">Job category<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All job categories</option>{designs.map((design) => <option key={design.id} value={design.id}>{design.category}</option>)}</select></label>
      </div>
      <div className={`hm-template-grid ${showAll || filter !== "all" ? "hm-template-grid-expanded" : ""}`}>
        {visible.map((design) => <article className="hm-template" key={design.id}>
          <button type="button" className="hm-template-preview" aria-label={`Preview ${design.category} CV`} onClick={(event) => { openerRef.current = event.currentTarget; setPreview(design); }}><MiniCv design={design} /><span className="hm-preview-label">Preview template <Symbol name="arrow" /></span></button>
          <div className="hm-template-info"><span className="hm-industry">{design.category}</span><h3>{design.name}</h3><p>{design.style}</p><BuilderLink onStart={onStart} query={`category=${design.id}&theme=${design.theme}&layout=${design.layout}`} className="hm-template-use">Use this template <Symbol name="arrow" /></BuilderLink></div>
        </article>)}
      </div>
      {filter === "all" && <button type="button" className="hm-text-button hm-show-all" onClick={() => setShowAll(!showAll)}>{showAll ? "Show featured templates" : `Explore all ${designs.length} job categories`} <Symbol name="arrow" /></button>}
      <p className="hm-small-note">Sample details are illustrative. You can edit every field and switch designs in the builder.</p>
    </div>
    {preview && <div className="hm-modal-backdrop" onClick={() => setPreview(null)}><section className="hm-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="hm-preview-title" onClick={(event) => event.stopPropagation()}>
      <div className="hm-dialog-heading"><div><h2 id="hm-preview-title">{preview.category}</h2><p>{preview.style}</p></div><button type="button" ref={closeRef} onClick={() => setPreview(null)} className="hm-icon-button" aria-label="Close template preview"><Symbol name="close" /></button></div>
      <div className="hm-dialog-document"><MiniCv design={preview} /></div>
      <BuilderLink className="hm-button hm-primary" onStart={onStart} query={`category=${preview.id}&theme=${preview.theme}&layout=${preview.layout}`}>Use this template <Symbol name="arrow" /></BuilderLink>
    </section></div>}
  </section>;
}

export default function HomeLanding({ onStart }) {
  const [example, setExample] = useState("hospitality");
  const selected = designs.find((design) => design.id === example);
  return <div className="hm-home">
    <header className="hm-nav"><div className="hm-wrap hm-nav-inner"><a className="hm-logo" href="/" aria-label="BuildMyCVNow home"><span><Symbol name="file" /></span>BuildMyCV<span className="hm-logo-now">Now</span></a><nav aria-label="Main navigation"><a href="#templates">Templates</a><a href="#how-it-works">How it works</a><a href="/blog">Career tips</a></nav><BuilderLink onStart={onStart} className="hm-button hm-primary hm-nav-start">Build my CV <Symbol name="arrow" /></BuilderLink></div></header>
    <main id="top">
      <section className="hm-hero"><div className="hm-wrap hm-hero-grid">
        <div className="hm-hero-copy"><span className="hm-eyebrow"><Symbol name="globe" /> Your next chapter starts here</span><h1>{HOME_H1}</h1><p>{HOME_SUBHEAD}</p>
          <div className="hm-actions"><BuilderLink onStart={onStart} className="hm-button hm-primary">Create my CV <Symbol name="arrow" /></BuilderLink><BuilderLink onStart={onStart} query="start=upload" className="hm-button hm-secondary"><Symbol name="upload" /> Upload my existing CV</BuilderLink></div>
          <div className="hm-trust"><span><Symbol name="check" /> Free PDF & Word</span><span><Symbol name="check" /> No account required</span><span><Symbol name="check" /> AI writing help</span></div>
          <p className="hm-otp-note">Free downloads unlock with a quick email verification.</p>
        </div>
        <div className="hm-hero-example"><div className="hm-example-tabs" role="group" aria-label="Choose CV example">{[designs[0], designs[2]].map((design) => <button key={design.id} type="button" aria-pressed={example === design.id} onClick={() => setExample(design.id)}>{design.role}</button>)}</div>
          <figure className="hm-example-paper"><img src={selected.image} alt={`${selected.role} sample CV`} width="794" height="1123" fetchPriority="high" /><figcaption><span><Symbol name="check" /> A clear, professional layout</span><BuilderLink onStart={onStart} query={`category=${selected.id}&theme=${selected.theme}&layout=${selected.layout}`}>Try this design <Symbol name="arrow" /></BuilderLink></figcaption></figure>
        </div>
      </div></section>
      <div className="hm-benefit-strip"><div className="hm-wrap"><span><Symbol name="file" /> Job-specific templates</span><span><Symbol name="globe" /> Apply anywhere</span><span><Symbol name="sparkle" /> Review every AI change</span><span><Symbol name="download" /> No download paywall</span></div></div>
      <TemplatesGallery onStart={onStart} />
      <section className="hm-section hm-how" id="how-it-works" aria-labelledby="hm-how-title"><div className="hm-wrap"><div className="hm-section-heading"><div><span className="hm-eyebrow">How it works</span><h2 id="hm-how-title">Build a professional CV in minutes</h2><p>A guided path from your first detail to your next application.</p></div></div><div className="hm-how-grid">
        <div className="hm-walkthrough"><div className="hm-video-frame"><video controls playsInline preload="none" poster={HOME_VIDEO.poster.replace("https://buildmycvnow.com", "")} aria-label={HOME_VIDEO.name}><source src={HOME_VIDEO.url} type="video/mp4" />Your browser cannot play this video. <a href={HOME_VIDEO.url}>Watch the walkthrough</a>.</video></div><h3>Watch the 2-minute walkthrough</h3><p>Choose a template, add your details, improve your CV with AI, and download your PDF.</p><BuilderLink className="hm-button hm-primary" onStart={onStart}>Start my free CV <Symbol name="arrow" /></BuilderLink></div>
        <ol className="hm-timeline">{HOME_HOW_IT_WORKS_STEPS.map((step, index) => <li key={step.title}><span className="hm-step-number">{index + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>
      </div></div></section>
      <section className="hm-section hm-tools"><div className="hm-wrap"><div className="hm-section-heading"><div><span className="hm-eyebrow">A little help goes a long way</span><h2>Make your experience easier to understand.</h2><p>You bring the experience. Get help putting it into words.</p></div></div><div className="hm-tools-grid">
        <article className="hm-writing"><span className="hm-tool-icon"><Symbol name="sparkle" /></span><h3>Clearer writing, with your approval.</h3><p>Check spelling, fix grammar, and make your work descriptions more professional.</p><div className="hm-writing-example"><span>Before</span><p>Help guest check in and answer question.</p><span className="hm-after-label">Suggested wording</span><p>Assisted guests with check-in and answered enquiries clearly and professionally.</p><small>Illustrative rewrite. You approve changes before they enter your CV.</small></div></article>
        <div className="hm-secondary-tools"><article><span className="hm-tool-icon"><Symbol name="globe" /></span><div><h3>Your CV, in another language.</h3><p>Upload, translate, and edit. Choose English, French, German, Arabic, Dutch, or another language.</p><BuilderLink onStart={onStart} query="start=upload" className="hm-text-button">Upload & translate <Symbol name="arrow" /></BuilderLink></div></article><article><span className="hm-tool-icon"><Symbol name="check" /></span><div><h3>See what still needs attention.</h3><p>Follow the live preview and CV strength guidance as you add details. Designed for ATS readability; no score guarantees an interview.</p></div></article></div>
      </div></div></section>
      <section className="hm-section hm-access" aria-labelledby="hm-access-title"><div className="hm-wrap"><div className="hm-section-heading"><div><span className="hm-eyebrow">Free, whichever way you work</span><h2 id="hm-access-title">Download today. Or save for later.</h2></div></div><div className="hm-access-grid"><article><Symbol name="download" /><h3>Just need a CV?</h3><p>Build and edit without an account. Verify your email with an OTP, then download PDF or Word. Your CV is not saved online.</p><BuilderLink onStart={onStart} className="hm-text-button">Create my CV <Symbol name="arrow" /></BuilderLink></article><article><Symbol name="save" /><h3>Want to keep your versions?</h3><p>Create a free account to save up to 10 CVs online. Online copies are stored for 15 days, so download your files for your own records.</p><BuilderLink onStart={onStart} query="access=save" className="hm-text-button">Build and save online <Symbol name="arrow" /></BuilderLink></article></div></div></section>
      <section className="hm-section hm-faq" id="faq"><div className="hm-wrap hm-faq-grid"><div><span className="hm-eyebrow">Good to know</span><h2>A few answers before you start.</h2><p>More questions? <a href="/contact">Get in touch</a>.</p></div><div>{homepageFaqs.slice(0, 10).map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></div></section>
      <section className="hm-final"><div className="hm-wrap"><div><span className="hm-eyebrow">Ready when you are</span><h2>Your next opportunity starts with your CV.</h2><p>Create it, check it, and download it for free.</p></div><BuilderLink onStart={onStart} className="hm-button hm-primary">Create my free CV <Symbol name="arrow" /></BuilderLink></div></section>
    </main>
    <footer className="hm-footer"><div className="hm-wrap"><div><a className="hm-logo" href="/">BuildMyCV<span className="hm-logo-now">Now</span></a><p>Free CV builder for job seekers worldwide.</p><a href="mailto:info@buildmycvnow.com">info@buildmycvnow.com</a></div><nav aria-label="Footer navigation">{[["/about", "About"], ["/contact", "Contact"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/faq", "FAQ"], ["/blog", "Career tips"]].map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav><p className="hm-copyright">Copyright {new Date().getFullYear()} BuildMyCVNow. All rights reserved.</p></div></footer>
  </div>;
}
