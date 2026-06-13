const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

export function initAnalytics() {
  if (!measurementId || window.gtag) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true });
}

export function trackEvent(action, params = {}) {
  if (!window.gtag) return;
  window.gtag("event", action, params);
}
