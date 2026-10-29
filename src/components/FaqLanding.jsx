import React, { useMemo, useState } from "react";
import BrandLogo from "./BrandLogo.jsx";
import { Symbol } from "./HomeLanding.jsx";
import { faqGroups, faqQuestions } from "../content/faqContent.js";
import "./faqLanding.css";

export default function FaqLanding() {
  const [topic, setTopic] = useState("all"), [query, setQuery] = useState(""), [menuOpen, setMenuOpen] = useState(false);
  const filtered = useMemo(() => faqGroups.map(group => ({ ...group, questions: group.questions.filter(item => (topic === "all" || topic === group.id) && `${item.question} ${item.paragraphs.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())) })).filter(group => group.questions.length), [topic, query]);
  const count = filtered.reduce((total, group) => total + group.questions.length, 0);
  const reset = () => { setQuery(""); setTopic("all"); };
  return <div className="faq-page">
    <a className="fq-skip" href="#faq-main">Skip to content</a>
    <header className="fq-header"><div className="fq-wrap fq-nav">
      <a href="/" aria-label="BuildMyCVNow home"><BrandLogo /></a>
      <button className="fq-menu" type="button" aria-expanded={menuOpen} aria-controls="fq-navigation" onClick={() => setMenuOpen(value => !value)}>Menu</button>
      <nav id="fq-navigation" className={menuOpen ? "fq-links open" : "fq-links"} aria-label="Main navigation"><a href="/#improve">Improve my CV</a><a href="/#templates">Templates</a><a href="/#free-download">Free download</a><a href="/faq" aria-current="page">FAQ</a><a href="/blog">Career tips</a></nav>
      <a className="fq-button fq-primary fq-header-cta" href="/builder">Build my CV — free</a>
    </div></header>
    <section className="fq-hero"><div className="fq-wrap">
      <nav className="fq-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>FAQ</span></nav>
      <div className="fq-hero-grid"><div>
      <span className="fq-eyebrow">Help centre</span><h1>Frequently asked questions</h1>
      <p className="fq-lead">Everything you need to know about building, improving and downloading your CV for free — for jobs in the UAE, the GCC and around the world.</p>
      <label className="fq-search"><Symbol name="search" /><span className="fq-sr-only">Search the FAQ</span><input type="search" placeholder="Search questions, e.g. photo, Arabic, Word" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="fq-chips"><span>✦ Free PDF &amp; Word</span><span>✦ No account needed</span><span>✦ AI help you control</span></div>
      </div><figure className="fq-hero-photo"><img src="/assets/faq/cv-review.jpg" alt="Professionals reviewing a printed CV during a recruitment meeting" width="1100" height="800" fetchPriority="high" /><figcaption><span>Small questions. A stronger next step.</span><a href="https://www.pexels.com/photo/woman-holding-a-clipboard-with-resume-5989941/" target="_blank" rel="noopener noreferrer">Photo: cottonbro studio / Pexels</a></figcaption></figure></div>
    </div></section>
    <main id="faq-main" className="fq-wrap">
      <div className="fq-layout"><aside className="fq-topics"><h2>Topics</h2>
        <nav aria-label="FAQ topics"><button type="button" aria-pressed={topic === "all"} onClick={() => setTopic("all")}>All questions <span>{faqQuestions.length}</span></button>{faqGroups.map(group => <button key={group.id} type="button" aria-pressed={topic === group.id} onClick={() => setTopic(group.id)}>{group.title}<span>{group.questions.length}</span></button>)}</nav>
        <div className="fq-help"><strong>Can’t find it?</strong><p>Get in touch with your question. We’re here to help.</p><a className="fq-button fq-secondary" href="/contact">Contact us</a></div>
      </aside>
      <div className="fq-results"><p role="status" aria-live="polite">{count} {count === 1 ? "answer" : "answers"}{query.trim() ? ` matching “${query.trim()}”` : " to your questions"}</p>
        {filtered.map(group => <section className="fq-group" key={group.id} aria-labelledby={`fq-${group.id}`}><h2 id={`fq-${group.id}`}><span aria-hidden="true"><Symbol name={group.id === "pricing" ? "download" : group.id === "global" ? "globe" : "file"} /></span>{group.title}</h2>
          {group.questions.map(item => <details className="fq-question" key={item.id}><summary>{item.question}<span aria-hidden="true">+</span></summary><div className="fq-answer">{item.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{item.links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</div></details>)}
        </section>)}
        {!count && <div className="fq-empty"><h2>No matching questions</h2><p>Try another word, choose a different topic, or contact us.</p><button type="button" className="fq-button fq-secondary" onClick={reset}>Clear search and filters</button></div>}
      </div></div>
      <section className="fq-guide-section" aria-labelledby="fq-guides-title"><span className="fq-eyebrow">Put it into practice</span><h2 id="fq-guides-title">A little guidance for your next step.</h2><div className="fq-guide-grid">
        <article className="fq-guide"><a className="fq-guide-image" href="/blog/how-to-write-a-cv-for-uae-jobs-in-2025" aria-hidden="true" tabIndex={-1}><img src="/assets/blog/cv-writing.jpg" alt="" width="1200" height="800" loading="lazy" decoding="async" /></a><div><span>CV writing</span><h3><a href="/blog/how-to-write-a-cv-for-uae-jobs-in-2025">Make every section of your CV count.</a></h3><p>A practical guide to your details, experience, skills and qualifications.</p><a className="fq-guide-link" href="/blog/how-to-write-a-cv-for-uae-jobs-in-2025">Read the CV writing guide <Symbol name="arrow" /></a><small><a href="https://www.pexels.com/photo/two-white-printer-papers-near-macbook-on-brown-surface-590016/" target="_blank" rel="noopener noreferrer">Lukas Blazek / Pexels</a></small></div></article>
        <article className="fq-guide"><a className="fq-guide-image" href="/blog/first-interview-tips-for-uae-job-seekers" aria-hidden="true" tabIndex={-1}><img src="/assets/blog/job-interview.jpg" alt="" width="1200" height="800" loading="lazy" decoding="async" /></a><div><span>Interview preparation</span><h3><a href="/blog/first-interview-tips-for-uae-job-seekers">Feel more prepared for the conversation.</a></h3><p>Plan your introduction, organise your documents, and prepare your questions.</p><a className="fq-guide-link" href="/blog/first-interview-tips-for-uae-job-seekers">Read the interview guide <Symbol name="arrow" /></a><small><a href="https://www.pexels.com/photo/candidate-having-an-interview-5439143/" target="_blank" rel="noopener noreferrer">Tima Miroshnichenko / Pexels</a></small></div></article>
      </div></section>
      <section className="fq-bottom"><div><span className="fq-eyebrow">Ready for your next step?</span><h2>Your next application starts here.</h2><p>Choose a template, add your experience, and download your CV for free.</p></div><div><a className="fq-button fq-white" href="/builder">Build my CV — free <Symbol name="arrow" /></a><a className="fq-button fq-outline" href="/contact">Still have a question?</a></div></section>
    </main>
    <footer className="fq-footer"><div className="fq-wrap"><div className="fq-footer-top"><div><a href="/" aria-label="BuildMyCVNow home"><BrandLogo tone="inverse" /></a><p>Free CV builder for job seekers worldwide.</p><a href="mailto:info@buildmycvnow.com">info@buildmycvnow.com</a></div><nav aria-label="Footer navigation">{[["/about", "About"], ["/contact", "Contact"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/faq", "FAQ"], ["/blog", "Career tips"]].map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav></div><p className="fq-copyright">© {new Date().getFullYear()} BuildMyCVNow. All rights reserved.</p></div></footer>
  </div>;
}
