import React, { useEffect, useRef } from "react";
import "./homeLiquidMotion.css";

const restWave = "M0 29 C160 10 320 10 480 29 S800 48 960 29 S1280 10 1440 29 V60 H0 Z";
const speeds = [0.15, 0.32, 0.22];
const drops = [27, 23, 19, 16, 13, 10];

export function LiquidWave({ tone }) {
  return <svg className="hm-liquid-wave" data-tone={tone} viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path d={restWave} /></svg>;
}

export function LiquidShapes({ variant }) {
  return <div className="hm-liquid-shapes" data-variant={variant} aria-hidden="true">
    {speeds.map((speed) => <i key={speed} data-speed={speed} />)}
  </div>;
}

export function LiquidCursor() {
  return <svg className="hm-liquid-cursor" viewBox="0 0 320 320" width="320" height="320" aria-hidden="true">
    <defs><filter id="hm-drop-merge" x="0" y="0" width="320" height="320" filterUnits="userSpaceOnUse">
      <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="soft" />
      <feColorMatrix in="soft" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 21 -8" result="merged" />
      <feBlend in="SourceGraphic" in2="merged" />
    </filter></defs>
    <g filter="url(#hm-drop-merge)">{drops.map((size) => <circle key={size} r={size} cx="160" cy="160" />)}</g>
  </svg>;
}

function wavePath(phase, amplitude) {
  const height = (x) => 28 + amplitude * (0.72 * Math.sin(x / 210 + phase) + 0.28 * Math.sin(x / 99 - phase * 0.7));
  const slope = (x) => amplitude * (0.72 * Math.cos(x / 210 + phase) / 210 + 0.28 * Math.cos(x / 99 - phase * 0.7) / 99);
  let path = `M0 ${height(0).toFixed(1)}`;
  for (let x = 0; x < 1440; x += 180) {
    const end = x + 180;
    path += ` C${x + 60} ${(height(x) + slope(x) * 60).toFixed(1)} ${end - 60} ${(height(end) - slope(end) * 60).toFixed(1)} ${end} ${height(end).toFixed(1)}`;
  }
  return path + " V60 H0 Z";
}

export function useLiquidMotion(root, paused, viscosity, waveStrength) {
  const settings = useRef({ viscosity, waveStrength });
  useEffect(() => { settings.current = { viscosity, waveStrength }; }, [viscosity, waveStrength]);
  useEffect(() => {
    const host = root.current;
    if (!host || paused) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const waves = [...host.querySelectorAll(".hm-liquid-wave")];
    const shapes = [...host.querySelectorAll(".hm-liquid-shapes")];
    const cursor = host.querySelector(".hm-liquid-cursor");
    const dots = [...cursor.querySelectorAll("circle")];
    let dispose;

    function start() {
      dispose?.();
      dispose = null;
      if (reduce.matches) return;
      const visible = new Map();
      const mouse = { x: 0, y: 0, on: false };
      const points = dots.map(() => ({ x: 0, y: 0 }));
      let opacity = 0, frame = 0, previous = 0, phase = 0, impulse = 0, energy = 0;
      let scroll = window.scrollY, lastScroll = scroll;
      const attachCursor = fine.matches;
      function wake() {
        if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
      }
      function tick(now) {
        frame = 0;
        const dt = previous ? Math.min(40, now - previous) / 16.67 : 1;
        previous = now;
        impulse = Math.max(-40, Math.min(40, impulse * 0.84 ** dt + (scroll - lastScroll) * 0.42));
        lastScroll = scroll;
        energy += (Math.abs(impulse) - energy) * (1 - 0.89 ** dt);
        phase += (0.013 + energy * 0.0013) * dt;
        const amplitude = Math.min(24, (6 + energy * 0.37) * settings.current.waveStrength);
        waves.forEach((wave, index) => {
          if (visible.has(wave)) wave.firstElementChild.setAttribute("d", wavePath(phase + index * 1.35, amplitude));
        });
        for (const layer of shapes) {
          if (!visible.has(layer)) continue;
          const localScroll = (innerHeight / 2 + scroll - visible.get(layer)) * 0.21;
          [...layer.children].forEach((shape, index) => {
            const y = Math.max(-100, Math.min(112, localScroll * Number(shape.dataset.speed) * 2));
            shape.style.transform = `translateY(${y.toFixed(1)}px) rotate(${(impulse * (index % 2 ? -0.22 : 0.22)).toFixed(1)}deg) scale(${1 - energy * 0.003}, ${1 + energy * 0.006})`;
          });
        }
        if (attachCursor && (mouse.on || opacity > 0.008)) {
          opacity += ((mouse.on ? 1 : 0) - opacity) * (1 - 0.78 ** dt);
          cursor.style.opacity = String(opacity);
          const v = settings.current.viscosity;
          points.forEach((point, index) => {
            const target = index ? points[index - 1] : mouse;
            const blend = 1 - (1 - (index ? v : Math.min(0.8, v + 0.20))) ** dt;
            point.x += (target.x - point.x) * blend;
            point.y += (target.y - point.y) * blend;
          });
          const head = points[0];
          const dx = mouse.x - head.x, dy = mouse.y - head.y;
          const stretch = Math.min(Math.hypot(dx, dy) / 160, 0.52);
          cursor.style.transform = `translate3d(${head.x - 160}px,${head.y - 160}px,0)`;
          points.forEach((point, index) => {
            // Keep the SVG filter bounded even when the pointer jumps.
            const x = Math.max(-108, Math.min(108, point.x - head.x));
            const y = Math.max(-108, Math.min(108, point.y - head.y));
            dots[index].setAttribute("transform", index ? `translate(${x} ${y})`
              : `translate(160 160) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}) scale(${1 + stretch} ${1 - stretch * 0.45}) translate(-160 -160)`);
          });
        }
        if (visible.size || mouse.on || opacity > 0.008) wake();
        else previous = 0;
      }
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target, entry.boundingClientRect.top + window.scrollY);
          else visible.delete(entry.target);
        }
        wake();
      });
      [...waves, ...shapes].forEach((item) => observer.observe(item));
      const onScroll = () => { scroll = window.scrollY; if (visible.size) wake(); };
      const leave = () => { mouse.on = false; wake(); };
      const onPointer = (event) => {
        if (event.pointerType !== "mouse" || !event.target.closest?.(".hm-home main") ||
          event.target.closest("a,button,input,select,textarea,summary,video,[role=dialog]")) { leave(); return; }
        mouse.x = event.clientX;
        mouse.y = event.clientY;
        if (!mouse.on) points.forEach((point) => { point.x = mouse.x; point.y = mouse.y; });
        mouse.on = true;
        wake();
      };
      const onVisibility = () => {
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0; mouse.on = false; }
        else { scroll = lastScroll = window.scrollY; wake(); }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      if (attachCursor) {
        document.addEventListener("pointermove", onPointer, { passive: true });
        document.documentElement.addEventListener("pointerleave", leave);
        window.addEventListener("blur", leave);
      }
      dispose = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("visibilitychange", onVisibility);
        document.removeEventListener("pointermove", onPointer);
        document.documentElement.removeEventListener("pointerleave", leave);
        window.removeEventListener("blur", leave);
        waves.forEach((wave) => wave.firstElementChild.setAttribute("d", restWave));
        shapes.forEach((layer) => [...layer.children].forEach((shape) => shape.style.removeProperty("transform")));
        cursor.removeAttribute("style");
      };
    }
    start();
    reduce.addEventListener("change", start);
    fine.addEventListener("change", start);
    return () => { dispose?.(); reduce.removeEventListener("change", start); fine.removeEventListener("change", start); };
  }, [root, paused]);
}
