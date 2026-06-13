const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export const isRecaptchaConfigured = Boolean(siteKey);

let loadingPromise;

function loadRecaptchaScript() {
  if (!siteKey) return Promise.resolve(false);
  if (window.grecaptcha?.execute) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Google reCAPTCHA."));
    document.head.appendChild(script);
  });
  return loadingPromise;
}

export async function getRecaptchaToken(action) {
  if (!siteKey) return "";
  await loadRecaptchaScript();
  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha.execute(siteKey, { action }).then(resolve).catch(reject);
    });
  });
}
