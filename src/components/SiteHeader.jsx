import React from "react";
import BrandLogo from "./BrandLogo.jsx";

const links = [
  ["/#improve", "Improve my CV"],
  ["/templates", "Templates"],
  ["/#free-download", "Free download"],
  ["/faq", "FAQ"],
  ["/blog", "Career tips"],
];

function HeaderLinks({ path }) {
  return links.map(([href, label]) => <a key={href} href={href} onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
    aria-current={path === href || (href === "/blog" && path.startsWith("/blog/")) ? "page" : undefined}>{label}</a>);
}

export default function SiteHeader({ path = "/", onStart, actions }) {
  const current = path.replace(/\/$/, "") || "/";
  return <header className="site-header site-glass"><div className="site-header-inner">
    <a className="site-logo-badge" href="/" aria-label="BuildMyCVNow home" aria-current={current === "/" ? "page" : undefined}><BrandLogo /></a>
    <nav className="site-header-nav" aria-label="Main navigation"><HeaderLinks path={current} /></nav>
    <div className="site-header-actions">
      {actions}
      <a className="site-build-cta" href="/builder" onClick={(event) => {
        if (!onStart || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onStart("/builder");
      }}><span className="site-build-full">Build my CV &mdash; free</span><span className="site-build-short">Build free CV</span></a>
      <details className="site-header-menu" onKeyDown={(event) => {
        if (event.key !== "Escape" || !event.currentTarget.open) return;
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary").focus();
      }}>
        <summary aria-label="Menu"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></summary>
        <nav className="site-header-dropdown" aria-label="Main navigation"><HeaderLinks path={current} /></nav>
      </details>
    </div>
  </div></header>;
}
