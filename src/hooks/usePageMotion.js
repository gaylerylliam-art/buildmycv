import { useEffect, useRef } from 'react';

let motionLibrary;
export function loadMotion() {
  motionLibrary ||= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([core, plugin]) => {
    const gsap = core.gsap || core.default;
    const ScrollTrigger = plugin.ScrollTrigger || plugin.default;
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  }).catch(() => null);
  return motionLibrary;
}

export function useHomeMotion(paused = false) {
  const root = useRef(null);
  useEffect(() => {
    if (paused) return;
    let cancelled = false, media;
    loadMotion().then(library => {
      if (cancelled || !library || !root.current) return;
      const { gsap, ScrollTrigger } = library;
      media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        const host = root.current;
        const q = selector => [...host.querySelectorAll(selector)];
        let observer, rotation, contextSetup;
        const word = host.querySelector(".hm-rotating-word");
        const context = gsap.context(() => {
          const hero = gsap.timeline({ defaults: { duration: .65, ease: 'power3.out' } });
          hero.from(q('.hm-nav a'), { y: -14, opacity: 0, stagger: .035 })
            .from(q('.hm-hero-copy h1 .hm-word-inner'), { yPercent: 115, stagger: .08 }, '-=.3')
            .from(q('.hm-hero-copy mark'), { scaleX: 0, transformOrigin: 'left center' }, '-=.4')
            .from(q('.hm-hero-copy > p, .hm-hero-actions .hm-button, .hm-download-explainer'), { y: 18, opacity: 0, stagger: .1 }, '-=.35')
            .from(q('.hm-hero-photo img'), { opacity: 0, duration: .8 }, .2);
          const words = ['job-ready', 'interview-ready', 'recruiter-ready', 'stand out'];
          let index = 0;
          if (word) {
            rotation = gsap.timeline({ repeat: -1, delay: 2.6, repeatDelay: 2.1 });
            rotation.to(word, { yPercent: -115, opacity: 0, duration: .35 })
              .call(() => { index = (index + 1) % words.length; word.textContent = words[index]; })
              .fromTo(word, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .5, ease: 'power3.out', immediateRender: false });
          }
          // Elements remain visible until their entrance starts; fast scrolling cannot strand them hidden.
          const seen = new WeakSet();
          const reveal = (items, vars = {}) => items.forEach((item, index) => {
            if (seen.has(item)) return;
            seen.add(item);
            ScrollTrigger.create({ trigger: item, start: 'top 92%', once: true,
              onEnter: () => context.add(() => {
                if (item.isConnected) gsap.fromTo(item, { y: 32, opacity: 0, ...vars }, { y: 0, x: 0, scale: 1, opacity: 1, duration: .65, delay: Math.min(index % 3, 2) * .07, ease: 'power3.out', clearProps: 'opacity,transform' });
              })
            });
          });
          // Run after context assignment, so callback-created tweens belong to this React mount.
          contextSetup = () => {
            reveal(q('.hm-section h2 .hm-word-inner'));
            reveal(q('.hm-improve-card, .hm-quick-steps .hm-wrap > div, .hm-faq details, .hm-final-actions a'));
            reveal(q('.hm-global-languages li'), { scale: .65 });
            q('.hm-access-grid article').forEach((item, i) => reveal([item], { x: i ? 45 : -45, y: 0 }));
            reveal(q('.hm-template'));
          };
          const tracks = q('.hm-marquee-track').map((track, index) => gsap.fromTo(track,
            { xPercent: index % 2 ? -50 : 0 },
            { xPercent: index % 2 ? 0 : -50, duration: 38, repeat: -1, ease: 'none' }));
          ScrollTrigger.create({ start: 0, end: 'max', onUpdate: self => {
            const speed = Math.min(6, 1 + Math.abs(self.getVelocity()) / 400) * self.direction;
            tracks.forEach(tween => {
              gsap.to(tween, { timeScale: speed, duration: .2, overwrite: true });
              gsap.to(tween, { timeScale: self.direction, duration: 1.2, delay: .25, overwrite: 'auto' });
            });
          }});
          q('.hm-big-line').forEach((line, i) => gsap.fromTo(line, { xPercent: i ? -25 : 0 }, { xPercent: i ? 0 : -25, ease: 'none', scrollTrigger: { trigger: host.querySelector('.hm-big-band'), start: 'top bottom', end: 'bottom top', scrub: 1 } }));
        }, host);
        context.add(() => contextSetup());
        observer = new MutationObserver(() => context.add(() => { contextSetup(); ScrollTrigger.refresh(); }));
        const grid = host.querySelector('.hm-template-grid');
        if (grid) observer.observe(grid, { childList: true });
        ScrollTrigger.refresh();
        return () => { observer?.disconnect(); rotation?.kill(); context.revert(); if (word) word.textContent = 'job-ready'; };
      });
    });
    return () => { cancelled = true; media?.revert(); };
  }, [paused]);
  return root;
}

export function useBuilderMotion(step, enabled) {
  const root = useRef(null), opened = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false, media;
    loadMotion().then(library => {
      if (cancelled || !library || !root.current) return;
      const { gsap } = library;
      media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        const context = gsap.context(() => {
          if (!opened.current) {
            gsap.from(root.current.children, { y: 22, opacity: 0, duration: .65, stagger: .12, ease: 'power3.out', clearProps: 'opacity,transform' });
            opened.current = true;
          } else {
            gsap.from(root.current.querySelector('.builder-form-inner'), { y: 10, opacity: .25, duration: .35, ease: 'power2.out', clearProps: 'opacity,transform' });
          }
        }, root.current);
        return () => context.revert();
      });
    });
    return () => { cancelled = true; media?.revert(); };
  }, [step, enabled]);
  return root;
}
