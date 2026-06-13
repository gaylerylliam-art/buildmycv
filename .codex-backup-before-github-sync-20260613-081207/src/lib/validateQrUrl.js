const blockedSchemes = /^(javascript|data|file):/i;
const allowedHosts = /(^|\.)linkedin\.com$|(^|\.)github\.com$/i;

export function normalizeQrUrl(input = "") {
  const raw = String(input || "").trim();
  if (!raw) return { ok: false, url: "", message: "Add a LinkedIn, GitHub, or portfolio URL." };
  if (blockedSchemes.test(raw)) return { ok: false, url: "", message: "This URL type is not allowed." };

  const value = !raw.includes(".") && !raw.includes("/")
    ? `https://www.linkedin.com/in/${encodeURIComponent(raw)}`
    : /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false, url: "", message: "Use a safe http or https link." };
    }
    const isRecognized = allowedHosts.test(url.hostname) || /\./.test(url.hostname);
    if (!isRecognized) return { ok: false, url: "", message: "Enter a valid LinkedIn, GitHub, or portfolio URL." };
    return { ok: true, url: url.toString(), message: "QR link is ready." };
  } catch {
    return { ok: false, url: "", message: "Enter a valid URL." };
  }
}
