// One consent-aware runtime serves the React app and static articles.
export function initAnalytics() { if (typeof window !== 'undefined') window.BuildMyCVAnalytics?.init(); }
export function trackEvent(action, params = {}) { return typeof window !== 'undefined' && window.BuildMyCVAnalytics?.track(action, params); }
export function trackEventOnce(action, params = {}) { return typeof window !== 'undefined' && window.BuildMyCVAnalytics?.trackOnce(action, params); }
export function trackPageView() { if (typeof window !== 'undefined') window.BuildMyCVAnalytics?.page(); }
