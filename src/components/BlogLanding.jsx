import React, { useMemo, useState } from "react";
import BrandLogo from "./BrandLogo.jsx";
import { Symbol } from "./HomeLanding.jsx";
import { blogCatalog, blogTopics, formatBlogDate } from "../content/blogCatalog.js";
import { useTheme } from "../hooks/useTheme.js";
import "./blogLanding.css";

const PAGE_SIZE = 9;
function ArticleCard({ article }) {
  return <article className="bl-article">
    <a className="bl-article-image" href={`/blog/${article.slug}`} tabIndex={-1} aria-hidden="true"><img src={article.media.src} alt="" width="900" height="600" loading="lazy" /><span>{article.label}</span></a>
    <div className="bl-article-copy"><div className="bl-meta"><time dateTime={article.date}>{formatBlogDate(article.date)}</time><span>{article.readTime}</span></div>
      <h3><a href={`/blog/${article.slug}`}>{article.title}</a></h3><p>{article.excerpt}</p>
      <a className="bl-read" href={`/blog/${article.slug}`} aria-label={`Read ${article.title}`}>Read the guide <Symbol name="arrow" /></a>
    </div>
  </article>;
}

export default function BlogLanding() {
  const [topic, setTopic] = useState("all"), [query, setQuery] = useState(""), [view, setView] = useState("grid"), [limit, setLimit] = useState(PAGE_SIZE);
  const { resolved, setMode } = useTheme("light");
  const featured = blogCatalog.find(article => article.slug === "cv-format-uae-jobs-2026") || blogCatalog[0];
  const picks = ["ats-friendly-cv", "cv-no-experience-dubai", "visa-status-on-cv-uae"].map(slug => blogCatalog.find(article => article.slug === slug)).filter(Boolean);
  const filtered = useMemo(() => blogCatalog.filter(article => (topic === "all" || article.topic === topic) && `${article.title} ${article.excerpt} ${article.label}`.toLowerCase().includes(query.trim().toLowerCase())), [topic, query]);
  const changeTopic = id => { setTopic(id); setLimit(PAGE_SIZE); };
  const reset = () => { setTopic("all"); setQuery(""); setLimit(PAGE_SIZE); };
  return <div className="blog-hub">
    <a className="bl-skip" href="#blog-content">Skip to content</a>
    <div className="bl-utility"><div className="bl-wrap"><span><Symbol name="check" /> Free CV tools. Practical career advice.</span><a href="/builder?start=upload">Already have a CV? Improve it here <Symbol name="arrow" /></a></div></div>
    <header className="bl-header"><div className="bl-wrap bl-header-inner">
      <a href="/" className="bl-logo-link" aria-label="BuildMyCVNow home"><BrandLogo tone={resolved === "dark" ? "inverse" : "auto"} /></a>
      <nav aria-label="Main navigation"><a href="/#templates">Templates</a><a href="/#how-it-works">How it works</a><a href="/blog" aria-current="page">Career journal</a><a href="/faq">FAQ</a></nav>
      <div className="bl-header-actions"><button type="button" className="bl-icon" onClick={() => setMode(resolved === "dark" ? "light" : "dark")} aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`} title={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}><Symbol name={resolved === "dark" ? "sun" : "moon"} /></button><a className="bl-button" href="/builder"><span className="bl-cta-long">Build my CV</span><span className="bl-cta-short">Build CV</span><Symbol name="arrow" /></a></div>
    </div></header>
    <main id="blog-content" className="bl-wrap">
      <section className="bl-heading"><div><p className="bl-eyebrow">THE CAREER JOURNAL</p><h1>CV writing &amp; career tips</h1><p>Clear advice. Stronger applications. Your next chapter starts here.</p></div><a href="#guides">Explore the guides <Symbol name="arrow" /></a></section>
      <div className="bl-feature-grid">
        <section className="bl-feature" aria-labelledby="bl-feature-title">
          <img src={featured.media.src} alt={featured.media.alt} width="1400" height="900" fetchPriority="high" />
          <div className="bl-feature-copy"><div className="bl-feature-label"><span>START HERE</span><span>{featured.readTime}</span></div><h2 id="bl-feature-title"><a href={`/blog/${featured.slug}`}>{featured.title}</a></h2><p>{featured.excerpt}</p><div className="bl-feature-foot"><span>BuildMyCVNow Team <span aria-hidden="true"> / </span><time dateTime={featured.date}>{formatBlogDate(featured.date)}</time></span><a href={`/blog/${featured.slug}`} aria-label={`Read ${featured.title}`} title="Read the featured guide"><Symbol name="arrow" /></a></div></div>
        </section>
        <aside className="bl-sidebar"><section className="bl-picks" aria-labelledby="bl-picks-title"><div className="bl-sidebar-heading"><h2 id="bl-picks-title">Editor's picks</h2><span>Worth your time</span></div><ol>{picks.map((article, i) => <li key={article.slug}><span className="bl-pick-number">0{i + 1}</span><div><span className="bl-category">{article.label}</span><h3><a href={`/blog/${article.slug}`}>{article.title}</a></h3><span className="bl-pick-time">{article.readTime}</span></div></li>)}</ol></section>
          <section className="bl-builder-prompt"><Symbol name="file" /><h2>Good advice. A better CV.</h2><p>Put it into practice with a free template, live preview, and optional AI writing help.</p><a href="/builder">Create my CV for free <Symbol name="arrow" /></a></section>
        </aside>
      </div>
      <section id="guides" className="bl-guides" aria-labelledby="bl-guides-title">
        <div className="bl-guides-heading"><div><p className="bl-eyebrow">MAKE YOUR NEXT MOVE</p><h2 id="bl-guides-title">Find your next good read</h2></div><div className="bl-view" role="group" aria-label="Article view"><button type="button" className="bl-icon" aria-label="Grid view" title="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Symbol name="grid" /></button><button type="button" className="bl-icon" aria-label="List view" title="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><Symbol name="list" /></button></div></div>
        <div className="bl-toolbar"><nav className="bl-topics" aria-label="Filter articles by topic">{blogTopics.map(item => <button key={item.id} type="button" aria-pressed={item.id === topic} onClick={() => changeTopic(item.id)}>{item.label}</button>)}</nav><label className="bl-search"><Symbol name="search" /><span className="bl-sr-only">Search career guides</span><input type="search" placeholder="Search the journal" value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} /></label></div>
        <p className="bl-results" role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? "guide" : "guides"}{topic !== "all" ? ` in ${blogTopics.find(item => item.id === topic).label}` : " for your career"}{query.trim() ? ` matching "${query.trim()}"` : ""}</p>
        {filtered.length ? <div className={`bl-articles bl-${view}`}>{filtered.slice(0, limit).map(article => <ArticleCard key={article.slug} article={article} />)}</div> : <div className="bl-empty"><Symbol name="search" /><h3>No guides found</h3><p>Try a different topic or search term.</p><button type="button" onClick={reset}>Clear filters</button></div>}
        {filtered.length > limit && <div className="bl-load"><span>Showing {Math.min(limit, filtered.length)} of {filtered.length} guides</span><button type="button" onClick={() => setLimit(value => value + PAGE_SIZE)}>More career guides <Symbol name="plus" /></button></div>}
        <noscript><div className="bl-all-links"><h3>All career guides</h3><ul>{blogCatalog.map(article => <li key={article.slug}><a href={`/blog/${article.slug}`}>{article.title}</a></li>)}</ul></div></noscript>
      </section>
      <section className="bl-bottom"><div><p className="bl-eyebrow">FROM READING TO READY</p><h2>Give your next application a head start.</h2><p>Choose a template, add your experience, and download your CV for free.</p></div><a className="bl-button" href="/builder">Build my CV <Symbol name="arrow" /></a></section>
    </main>
    <footer className="bl-footer"><div className="bl-wrap"><div><a href="/" aria-label="BuildMyCVNow home"><BrandLogo tone="inverse" /></a><p>Free CV tools. More confident next steps.</p></div><nav aria-label="Footer navigation">{[["/about","About"],["/contact","Contact"],["/privacy","Privacy"],["/terms","Terms"],["/faq","FAQ"]].map(([href,label])=><a key={href} href={href}>{label}</a>)}<a href="/blog/rss.xml">RSS feed</a></nav></div></footer>
  </div>;
}
