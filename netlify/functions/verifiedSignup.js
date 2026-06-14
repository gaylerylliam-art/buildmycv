import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const secret = () => process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "buildmycvnow-local-email-otp-secret";
const signChallenge = ({ email, otp, expires }) =>
  crypto.createHmac("sha256", secret()).update(`${email}|${otp}|${expires}`).digest("hex");

const verifyChallenge = ({ email, otp, challenge }) => {
  if (!/^\d{6}$/.test(String(otp || "").trim())) return "Enter the 6-digit OTP.";
  if (!challenge || challenge.email !== email || !challenge.expires || Date.now() > Number(challenge.expires)) {
    return "OTP expired. Please request a new code.";
  }
  const expected = signChallenge({ email, otp: String(otp).trim(), expires: challenge.expires });
  if (expected !== challenge.signature) return "Invalid OTP. Please try again.";
  return "";
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Use POST." });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, {
      ok: false,
      message: "Server signup is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify.",
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, message: "Invalid JSON." });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const name = String(payload.name || "").trim();
  if (!emailPattern.test(email)) return json(400, { ok: false, message: "Enter a valid email address." });
  if (password.length < 6) return json(400, { ok: false, message: "Password must be at least 6 characters." });

  const challengeError = verifyChallenge({ email, otp: payload.otp, challenge: payload.challenge });
  if (challengeError) return json(400, { ok: false, message: challengeError });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error) {
    const alreadyExists = /already|registered|exists/i.test(error.message || "");
    return json(alreadyExists ? 409 : 400, {
      ok: false,
      message: alreadyExists ? "This email already has an account. Please use Login instead." : error.message || "Could not create account.",
    });
  }

  return json(200, { ok: true, userId: data?.user?.id, message: "Email verified. Account created." });
};
