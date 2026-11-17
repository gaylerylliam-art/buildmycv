import React, { useEffect, useRef, useState } from "react";
import Mascot, { cardMascotArtwork, cardMascotPositions } from "./Mascot.jsx";
import { formatBlogDate } from "../content/blogCatalog.js";
import "./blogGuideCards.css";

const colours = { writing: "#1F3A5F", ats: "#4338CA", search: "#0F766E", industry: "#166534", gulf: "#923A16" };

function GuideSplash({ media }) {
  return <img className="bl-flash-splash" src={media.splash} alt="" loading="lazy" decoding="async" onError={(event) => {
    const image = event.currentTarget;
    if (image.getAttribute("src") !== media.src) image.src = media.src;
  }} />;
}

function GuideCard({ article, index, active, onHover, onLeave, onFlip, onMove }) {
  const href = `/blog/${article.slug}`;
  const flip = useRef(null);
  const button = useRef(null);
  const previous = useRef(active);
  const colour = colours[article.topic] || "#1F3A5F";
  const number = String(index + 1).padStart(2, "0");
  const id = `guide-summary-${article.slug}`;
  const mascotPosition = cardMascotPositions[index % cardMascotPositions.length];
  useEffect(() => {
    if (previous.current === active) return;
    previous.current = active;
    let live = true;
    let tween;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      import("gsap").then(({ gsap }) => {
        if (live && flip.current) tween = gsap.fromTo(flip.current, { rotationY: active ? 0 : 180 },
          { rotationY: active ? 180 : 0, duration: 0.62, ease: "back.out(1.06)", overwrite: true });
      });
    }
    return () => { live = false; tween?.kill(); };
  }, [active]);
  return <article className="bl-flash" data-open={active} data-mascot-position={mascotPosition} style={{ "--guide-colour": colour }}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") onHover(event, article.slug, colour); }}
    onPointerMove={(event) => { if (event.pointerType === "mouse") onMove(event); }}
    onPointerLeave={(event) => onLeave(event, article.slug)}
    onKeyDown={(event) => { if (event.key === "Escape" && active) { onFlip(article.slug, false); button.current.focus(); } }}>
    <div className="bl-flash-tilt"><div ref={flip} className="bl-flash-turn">
      <div className="bl-flash-face bl-flash-front" inert={active || undefined} aria-hidden={active || undefined}>
        <GuideSplash media={article.media} />
        <span className="bl-flash-number" aria-hidden="true">{number}</span>
        <span className="bl-flash-tag">{article.label}</span>
        <div className="bl-flash-heading">
          <h3><a href={href}>{article.title}</a></h3>
          <div className="bl-flash-meta"><time dateTime={article.date}>{formatBlogDate(article.date)}</time><span>{article.readTime}</span></div>
        </div>
      </div>
      <div id={id} className="bl-flash-face bl-flash-back" inert={!active || undefined} aria-hidden={!active || undefined}>
        <GuideSplash media={article.media} />
        <span className="bl-flash-number" aria-hidden="true">{number}</span>
        <span className="bl-flash-tag">In this guide</span>
        <p>{article.excerpt}</p>
        <a href={href} className="bl-flash-read" aria-label={`Read ${article.title}`}>Read the guide <span aria-hidden="true">→</span></a>
      </div>
    </div>
    <div className="bl-flash-tools">
      <Mascot mood="welcoming" size="compact" placement="topic-card" {...cardMascotArtwork[mascotPosition]} spriteDelay={-(index % 5) * 1.3} />
      <button ref={button} type="button" aria-expanded={active} aria-controls={id} aria-label={`${active ? "Flip back" : "Flip"}: ${article.title}`}
        onClick={(event) => {
          onFlip(article.slug, !active);
          if (!active && event.detail === 0) requestAnimationFrame(() => flip.current?.querySelector(".bl-flash-read")?.focus());
        }}><span aria-hidden="true">↻</span> {active ? "Flip back" : "Flip"}</button>
    </div></div>
  </article>;
}

export default function BlogGuideCards({ articles, catalog, view }) {
  const grid = useRef(null);
  const ring = useRef(null);
  const dot = useRef(null);
  const current = useRef(null);
  const motion = useRef(null);
  const [face, setFace] = useState(null);
  const show = (next) => { current.current = next; setFace(next); };
  const canMove = () => window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches;

  useEffect(() => {
    let live = true, animation;
    import("gsap").then(({ gsap }) => {
      if (!live || !grid.current) return;
      motion.current = gsap;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        animation = gsap.fromTo(grid.current.querySelectorAll(".bl-flash-tilt"),
          { y: 19, opacity: 0.55 }, { y: 0, opacity: 1, duration: 0.38, stagger: 0.045, ease: "power2.out", clearProps: "opacity,transform" });
      }
    });
    return () => { live = false; animation?.kill(); if (grid.current) motion.current?.killTweensOf(grid.current.querySelectorAll(".bl-flash,.bl-flash-tilt")); };
  }, [articles, view]);

  const resetMotion = () => {
    const gsap = motion.current;
    if (gsap && grid.current) {
      gsap.to(grid.current.querySelectorAll(".bl-flash"), { x: 0, y: 0, duration: 0.28, overwrite: true, clearProps: "transform" });
      gsap.to(grid.current.querySelectorAll(".bl-flash-tilt"), { rotationX: 0, rotationY: 0, duration: 0.25, overwrite: "auto" });
    }
    if (ring.current) ring.current.dataset.visible = "false";
    if (dot.current) dot.current.dataset.visible = "false";
  };

  const hover = (event, slug, colour) => {
    if (event.currentTarget.matches(":focus-within") && current.current?.source === "manual") return;
    show({ slug, source: "hover" });
    if (!canMove() || !motion.current) return;
    const active = event.currentTarget;
    const box = active.getBoundingClientRect();
    for (const card of grid.current.querySelectorAll(".bl-flash")) {
      const rect = card.getBoundingClientRect();
      const x = rect.x - box.x, y = rect.y - box.y;
      const distance = Math.hypot(x, y);
      const amount = Math.max(0, 1 - distance / 760) * 7;
      motion.current.to(card, { x: distance ? x / distance * amount : 0, y: distance ? y / distance * amount : -2,
        duration: 0.28, ease: "power2.out", overwrite: true });
    }
    ring.current.style.setProperty("--cursor-colour", colour);
    move(event, true);
  };
  const move = (event, first = false) => {
    if (!canMove() || !motion.current) return;
    const { clientX: x, clientY: y, currentTarget: target } = event;
    const control = event.target.closest("a,button");
    ring.current.dataset.visible = String(!control);
    dot.current.dataset.visible = String(!control);
    motion.current.set(dot.current, { x, y });
    motion.current.to(ring.current, { x: x + 22, y: y + 16, duration: first ? 0 : 0.2, overwrite: true });
    const rect = target.getBoundingClientRect();
    const dx = Math.max(0, Math.min(1, (x - rect.left) / rect.width)), dy = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    target.style.setProperty("--shine-x", `${dx * 100}%`);
    target.style.setProperty("--shine-y", `${dy * 100}%`);
    motion.current.to(target.querySelector(".bl-flash-tilt"), { rotationX: (0.5 - dy) * 5, rotationY: (dx - 0.5) * 5,
      duration: 0.25, ease: "power2.out", overwrite: "auto" });
  };
  return <div ref={grid} className={`bl-flash-grid bl-flash-${view}`}>
    {articles.map((article) => <GuideCard key={article.slug} article={article} index={catalog.indexOf(article)}
      active={face?.slug === article.slug && face.open !== false} onHover={hover} onMove={move}
      onLeave={(event, slug) => { resetMotion(); if (current.current?.slug === slug && current.current.source === "hover" && !event.currentTarget.matches(":focus-within")) show(null); }}
      onFlip={(slug, open) => { resetMotion(); show({ slug, open, source: "manual" }); }} />)}
    <div ref={dot} className="bl-guide-cursor bl-guide-dot" aria-hidden="true" />
    <div ref={ring} className="bl-guide-cursor bl-guide-ring" aria-hidden="true">Read</div>
  </div>;
}
