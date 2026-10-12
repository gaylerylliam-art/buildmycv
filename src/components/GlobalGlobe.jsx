import React, { useEffect, useRef, useState } from "react";

export default function GlobalGlobe() {
  const hostRef = useRef(null), sceneRef = useRef(null), pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const host = hostRef.current, media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const abort = new AbortController();
    let cancelled = false, loading = false, visible = false;
    const motion = () => { setReduced(media.matches); sceneRef.current?.setPaused(pausedRef.current || media.matches); };
    const unavailable = () => setReady(false);
    motion(); media.addEventListener("change", motion); host.addEventListener("globeunavailable", unavailable);
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [module, response] = await Promise.all([import("./globeScene.js"), fetch("/assets/globe-land-points.json", { signal: abort.signal })]);
        if (!response.ok) throw new Error("Globe asset unavailable");
        const points = await response.json();
        if (cancelled) return;
        sceneRef.current = module.createGlobe(host, points);
        sceneRef.current.setPaused(pausedRef.current || media.matches);
        sceneRef.current.setVisible(visible);
        setReady(true);
      } catch {
        // The local still image remains visible if WebGL or the asset is unavailable.
        if (!cancelled) setReady(false);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sceneRef.current?.setVisible(visible);
      if (visible) load();
    }, { threshold: 0.05 });
    observer.observe(host);
    return () => {
      cancelled = true; abort.abort(); observer.disconnect(); media.removeEventListener("change", motion);
      host.removeEventListener("globeunavailable", unavailable); sceneRef.current?.dispose(); sceneRef.current = null;
    };
  }, []);
  useEffect(() => {
    pausedRef.current = paused;
    sceneRef.current?.setPaused(paused || reduced);
  }, [paused, reduced]);
  return <div className="hm-globe-visual">
    <div className="hm-globe-stage" ref={hostRef} role="img" aria-label="Globe connecting international career destinations">
      <img className={ready ? "hm-globe-fallback hm-globe-fallback-hidden" : "hm-globe-fallback"} src="/assets/globe-static.png" alt="" width="600" height="600" loading="lazy" />
    </div>
    {ready && !reduced && <button className="hm-globe-pause" type="button" aria-label={paused ? "Play globe animation" : "Pause globe animation"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{paused ? <path d="M8 5v14l11-7Z" /> : <path d="M7 5h4v14H7Zm6 0h4v14h-4Z" />}</svg>
    </button>}
  </div>;
}
