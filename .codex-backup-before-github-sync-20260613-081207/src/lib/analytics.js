export function logEvent(name, props = {}) {
  if (typeof window === "undefined") return;
  if (window.plausible) window.plausible(name, { props });
  if (window.gtag) window.gtag("event", name, props);
  if (!window.plausible && !window.gtag) console.log(name, props);
}
