import { createClient } from "@supabase/supabase-js";

const hits = new Map();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false });
  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  const now = Date.now();
  const bucket = hits.get(ip)?.filter((time) => now - time < 60000) || [];
  if (bucket.length >= 5) return json(429, { ok: false });
  hits.set(ip, [...bucket, now]);

  const payload = JSON.parse(event.body || "{}");
  if (payload.website) return json(200, { ok: true, downloadUrl: "/downloads/uae-job-hunt-checklist.pdf" });
  const email = String(payload.email || "").trim().toLowerCase();
  if (!emailPattern.test(email)) return json(400, { ok: false, message: "Enter a valid email address." });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(200, { ok: true, downloadUrl: "/downloads/uae-job-hunt-checklist.pdf" });

  const supabase = createClient(url, key);
  await supabase.from("email_subscribers").upsert({
    email,
    source: payload.source || "download",
    role_interest: payload.roleInterest || null,
  }, { onConflict: "email" });

  // Seam for Resend or SendGrid delivery later. v1 returns a direct download link.
  return json(200, { ok: true, downloadUrl: "/downloads/uae-job-hunt-checklist.pdf" });
};
