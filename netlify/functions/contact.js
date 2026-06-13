import { createClient } from "@supabase/supabase-js";

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "info@buildmycvnow.com";
const hits = new Map();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const env = (...keys) => keys.map((key) => process.env[key]).find(Boolean);

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const html = (statusCode, { ok, title, message }) => ({
  statusCode,
  headers: { "Content-Type": "text/html; charset=utf-8" },
  body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${ok ? "Message sent" : "Message not sent"} | BuildMyCVNow</title>
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a}
    main{min-height:100vh;display:grid;place-items:center;padding:24px}
    section{max-width:560px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:28px;box-shadow:0 18px 48px rgba(15,23,42,.08)}
    h1{margin:0 0 10px;font-size:28px}
    p{line-height:1.65;color:#475569}
    a{display:inline-flex;margin-top:14px;border-radius:8px;background:#16a34a;color:#fff;text-decoration:none;font-weight:800;padding:12px 16px}
  </style>
</head>
<body>
  <main>
    <section>
      <h1>${title}</h1>
      <p>${message}</p>
      <p>You can also email us directly at <strong>${CONTACT_TO_EMAIL}</strong>.</p>
      <a href="/contact/">Back to Contact</a>
    </section>
  </main>
</body>
</html>`,
});

const parseBody = (event) => {
  const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
  if (contentType.includes("application/json")) return JSON.parse(event.body || "{}");
  const params = new URLSearchParams(event.body || "");
  return Object.fromEntries(params.entries());
};

const wantsJson = (event) => {
  const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
  const accept = event.headers.accept || event.headers.Accept || "";
  return contentType.includes("application/json") || (accept.includes("application/json") && !accept.includes("text/html"));
};

const respond = (event, statusCode, body) => {
  if (wantsJson(event)) return json(statusCode, body);
  return html(statusCode, {
    ok: body.ok,
    title: body.ok ? "Thank you. Your message was received." : "Please check your message.",
    message: body.message || (body.ok ? "We received your message." : "Something went wrong."),
  });
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
  const serviceId = env("EMAILJS_SERVICE_ID", "VITE_EMAILJS_SERVICE_ID", "REACT_APP_EMAILJS_SERVICE_ID");
  const templateId = env("EMAILJS_CONTACT_TEMPLATE_ID", "EMAILJS_TEMPLATE_ID", "VITE_EMAILJS_TEMPLATE_ID", "REACT_APP_EMAILJS_TEMPLATE_ID");
  const publicKey = env("EMAILJS_PUBLIC_KEY", "VITE_EMAILJS_PUBLIC_KEY", "REACT_APP_EMAILJS_PUBLIC_KEY");
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
  if (event.httpMethod !== "POST") return respond(event, 405, { ok: false, message: "Please submit the contact form from the Contact page." });

  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  const now = Date.now();
  const bucket = hits.get(ip)?.filter((time) => now - time < 60000) || [];
  if (bucket.length >= 5) return respond(event, 429, { ok: false, message: "Too many messages. Please try again in a minute." });
  hits.set(ip, [...bucket, now]);

  let payload;
  try {
    payload = parseBody(event);
  } catch {
    return respond(event, 400, { ok: false, message: "Invalid form data." });
  }

  if (payload.website) return respond(event, 200, { ok: true, message: "Message received." });

  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const message = String(payload.message || "").trim();

  if (name.length < 2) return respond(event, 400, { ok: false, message: "Please enter your name." });
  if (!emailPattern.test(email)) return respond(event, 400, { ok: false, message: "Please enter a valid email address." });
  if (message.length < 10) return respond(event, 400, { ok: false, message: "Please enter a message with at least 10 characters." });

  try {
    const stored = await storeMessage({ name, email, message });
    const forwarded = await sendEmail({ name, email, message });

    return respond(event, 200, {
      ok: true,
      forwarded,
      stored,
      to: forwarded ? CONTACT_TO_EMAIL : undefined,
      message: forwarded
        ? `Message sent successfully to ${CONTACT_TO_EMAIL}.`
        : stored
          ? `Message saved. Email forwarding needs EmailJS environment variables. Please also email ${CONTACT_TO_EMAIL} if urgent.`
          : `Message received locally. Email forwarding needs EmailJS environment variables. Please also email ${CONTACT_TO_EMAIL} if urgent.`,
    });
  } catch (error) {
    console.error("Contact form failed", error);
    return respond(event, 500, { ok: false, message: error.message || "Could not send message. Please try again later." });
  }
};
