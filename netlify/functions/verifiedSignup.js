import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const secret = () => process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "buildmycvnow-local-email-otp-secret";
const normalizePurpose = (purpose) => {
  const value = String(purpose || "signup").trim().toLowerCase();
  return /^[a-z0-9_-]{2,40}$/.test(value) ? value : "signup";
};
const otpHash = ({ email, otp, purpose }) =>
  crypto.createHmac("sha256", secret()).update(`${email}|${normalizePurpose(purpose)}|${String(otp).trim()}`).digest("hex");
const timingSafeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};
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

const verifyStoredOtp = async ({ admin, email, otp, purpose }) => {
  if (!/^\d{6}$/.test(String(otp || "").trim())) return { checked: true, ok: false, message: "Enter the 6-digit OTP." };

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
    console.warn("Could not verify stored signup OTP:", error.message);
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
  if (consumeError) console.warn("Could not mark signup OTP consumed:", consumeError.message);

  return { checked: true, ok: true };
};

const findUserByEmail = async (admin, email) => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data?.users?.find((item) => String(item.email || "").toLowerCase() === email);
    if (user) return user;
    if (!data?.users || data.users.length < 1000) break;
  }
  return null;
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const storedOtpResult = await verifyStoredOtp({ admin, email, otp: payload.otp, purpose: payload.purpose || "signup" });
  if (storedOtpResult.checked) {
    if (!storedOtpResult.ok) return json(400, { ok: false, message: storedOtpResult.message || "Invalid OTP. Please try again." });
  } else {
    const challengeError = verifyChallenge({ email, otp: payload.otp, challenge: payload.challenge });
    if (challengeError) return json(400, { ok: false, message: challengeError });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error) {
    const alreadyExists = /already|registered|exists/i.test(error.message || "");
    if (alreadyExists) {
      try {
        const existingUser = await findUserByEmail(admin, email);
        if (!existingUser?.id) {
          return json(409, {
            ok: false,
            message: "This email already has an account. Please use Login or Google sign in.",
          });
        }

        const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
          password,
          user_metadata: { ...(existingUser.user_metadata || {}), full_name: name || existingUser.user_metadata?.full_name || "" },
        });

        if (updateError) throw updateError;

        return json(200, {
          ok: true,
          userId: existingUser.id,
          existing: true,
          message: "Email verified. Password updated for your existing account.",
        });
      } catch (updateError) {
        return json(400, {
          ok: false,
          message: updateError.message || "This email already has an account, but the password could not be updated.",
        });
      }
    }
    return json(alreadyExists ? 409 : 400, {
      ok: false,
      message: alreadyExists ? "This email already has an account. Please use Login instead." : error.message || "Could not create account.",
    });
  }

  return json(200, { ok: true, userId: data?.user?.id, message: "Email verified. Account created." });
};
