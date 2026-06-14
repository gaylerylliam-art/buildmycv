import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const secret = () => process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "buildmycvnow-local-email-otp-secret";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

const normalizePurpose = (purpose) => {
  const value = String(purpose || "download").trim().toLowerCase();
  return /^[a-z0-9_-]{2,40}$/.test(value) ? value : "download";
};

const otpHash = ({ email, otp, purpose }) =>
  crypto.createHmac("sha256", secret()).update(`${email}|${normalizePurpose(purpose)}|${String(otp).trim()}`).digest("hex");

const timingSafeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getAdminClient = () => {
  const url = supabaseUrl();
  const key = serviceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

const signChallenge = ({ email, otp, expires }) =>
  crypto.createHmac("sha256", secret()).update(`${email}|${otp}|${expires}`).digest("hex");

const storeOtp = async ({ email, otp, purpose, expiresAt }) => {
  const admin = getAdminClient();
  if (!admin) return false;
  const { error } = await admin.from("email_otp_challenges").insert({
    email,
    purpose: normalizePurpose(purpose),
    otp_hash: otpHash({ email, otp, purpose }),
    expires_at: expiresAt,
  });
  if (error) {
    console.warn("Could not store OTP challenge:", error.message);
    return false;
  }
  return true;
};

const verifyStoredOtp = async ({ email, otp, purpose }) => {
  const admin = getAdminClient();
  if (!admin) return { checked: false };
  const normalizedPurpose = normalizePurpose(purpose);
  const { data, error } = await admin
    .from("email_otp_challenges")
    .select("id, otp_hash, expires_at, consumed_at")
    .eq("email", email)
    .eq("purpose", normalizedPurpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.warn("Could not verify stored OTP:", error.message);
    return { checked: false };
  }

  const activeRows = (data || []).filter((row) => new Date(row.expires_at).getTime() > Date.now());
  if (!activeRows.length) return { checked: true, ok: false, message: "OTP expired. Please request a new code." };

  const expectedHash = otpHash({ email, otp, purpose: normalizedPurpose });
  const matched = activeRows.find((row) => timingSafeEqual(row.otp_hash, expectedHash));
  if (!matched) return { checked: true, ok: false, message: "Invalid OTP. Please use the newest code from your email." };

  const { error: consumeError } = await admin
    .from("email_otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", matched.id);
  if (consumeError) {
    console.warn("Could not mark OTP consumed:", consumeError.message);
  }
  return { checked: true, ok: true };
};

const sendEmailOtp = async ({ email, otp, name }) => {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_OTP_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID;
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
        to_email: email,
        from_name: "BuildMyCVNow",
        reply_to: process.env.CONTACT_TO_EMAIL || "info@buildmycvnow.com",
        subject: "Your BuildMyCVNow download OTP",
        name: name || "Job seeker",
        otp,
        message: `Your BuildMyCVNow OTP is ${otp}. It expires in 10 minutes.`,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const isServerApiBlocked = detail.includes("non-browser environments");
    const error = new Error(
      isServerApiBlocked
        ? "EmailJS is blocking server-side email sending. Enable API access from non-browser environments in EmailJS Account Security."
        : detail || response.statusText
    );
    error.providerCode = isServerApiBlocked ? "EMAILJS_NON_BROWSER_DISABLED" : undefined;
    throw error;
  }
  return true;
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Use POST." });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, message: "Invalid JSON." });
  }

  const action = payload.action || "send";
  const email = String(payload.email || "").trim().toLowerCase();
  const purpose = normalizePurpose(payload.purpose);
  if (!emailPattern.test(email)) return json(400, { ok: false, message: "Enter a valid email address." });

  if (action === "send") {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    const expiresAt = new Date(expires).toISOString();
    const challenge = { email, expires, purpose, signature: signChallenge({ email, otp, expires }) };
    try {
      const stored = await storeOtp({ email, otp, purpose, expiresAt });
      const emailSent = await sendEmailOtp({ email, otp, name: payload.name });
      if (!emailSent) {
        return json(503, {
          ok: false,
          emailSent: false,
          message: "Email OTP delivery is not configured yet. Add EMAILJS_SERVICE_ID, EMAILJS_OTP_TEMPLATE_ID, and EMAILJS_PUBLIC_KEY in Netlify, or use account Sign In / Sign Up.",
        });
      }
      return json(200, {
        ok: true,
        emailSent,
        challenge,
        stored,
        message: "OTP sent to your email address.",
      });
    } catch (error) {
      return json(502, {
        ok: false,
        emailSent: false,
        providerCode: error.providerCode,
        message: error.message || "Could not send email OTP. Please try again or contact support.",
      });
    }
  }

  if (action === "verify") {
    const token = String(payload.otp || "").trim();
    const challenge = payload.challenge || {};
    if (!/^\d{6}$/.test(token)) return json(400, { ok: false, message: "Enter the 6-digit OTP." });

    const storedResult = await verifyStoredOtp({ email, otp: token, purpose });
    if (storedResult.checked) {
      if (!storedResult.ok) return json(400, { ok: false, message: storedResult.message || "Invalid OTP. Please try again." });
      return json(200, { ok: true, message: "Email verified." });
    }

    if (challenge.email !== email || !challenge.expires || Date.now() > Number(challenge.expires)) {
      return json(400, { ok: false, message: "OTP expired. Please request a new code." });
    }
    const expected = signChallenge({ email, otp: token, expires: challenge.expires });
    if (expected !== challenge.signature) return json(400, { ok: false, message: "Invalid OTP. Please try again." });
    return json(200, { ok: true, message: "Email verified." });
  }

  return json(400, { ok: false, message: "Unsupported OTP action." });
};
