import { createClient } from "@supabase/supabase-js";

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "info@buildmycvnow.com";
const hits = new Map();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const parseBody = (event) => {
  const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
  if (contentType.includes("application/json")) return JSON.parse(event.body || "{}");
  const params = new URLSearchParams(event.body || "");
  return Object.fromEntries(params.entries());
};

const storeMessage = async ({ name, email, message }) => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const supabase = createClient(url, key);
  const { error } = await supabase.from("contact_messages").insert({ name, email, message });
  if (error) {
    console.warn("Contact Supabase storage skipped", error.message || error);
    return false;
  }
  return true;
};

const sendEmail = async ({ name, email, message }) => {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  if (!serviceId || !templateId || !publicKey) return false;

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_email: CONTACT_TO_EMAIL,
        from_name: name,
        from_email: email,
        reply_to: email,
        message,
        subject: `BuildMyCVNow contact form - ${name}`,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email forwarding failed: ${detail || response.statusText}`);
  }
  return true;
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Use POST." });

  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  const now = Date.now();
  const bucket = hits.get(ip)?.filter((time) => now - time < 60000) || [];
  if (bucket.length >= 5) return json(429, { ok: false, message: "Too many messages. Please try again in a minute." });
  hits.set(ip, [...bucket, now]);

  let payload;
  try {
    payload = parseBody(event);
  } catch {
    return json(400, { ok: false, message: "Invalid form data." });
  }

  if (payload.website) return json(200, { ok: true, message: "Message received." });

  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const message = String(payload.message || "").trim();

  if (name.length < 2) return json(400, { ok: false, message: "Please enter your name." });
  if (!emailPattern.test(email)) return json(400, { ok: false, message: "Please enter a valid email address." });
  if (message.length < 10) return json(400, { ok: false, message: "Please enter a message with at least 10 characters." });

  try {
    const stored = await storeMessage({ name, email, message });
    const forwarded = await sendEmail({ name, email, message });

    return json(200, {
      ok: true,
      forwarded,
      stored,
      to: forwarded ? CONTACT_TO_EMAIL : undefined,
      message: forwarded
        ? "Message sent successfully."
        : stored
          ? "Message saved. Email forwarding needs EmailJS environment variables."
          : "Message received locally. Email forwarding needs EmailJS environment variables.",
    });
  } catch (error) {
    console.error("Contact form failed", error);
    return json(500, { ok: false, message: error.message || "Could not send message. Please try again later." });
  }
};
