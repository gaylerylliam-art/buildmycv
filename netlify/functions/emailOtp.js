import crypto from "node:crypto";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const secret = () => process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "buildmycvnow-local-email-otp-secret";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signChallenge = ({ email, otp, expires }) =>
  crypto.createHmac("sha256", secret()).update(`${email}|${otp}|${expires}`).digest("hex");

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
        reply_to: process.env.CONTACT_TO_EMAIL || "gaylerylliam@gmail.com",
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
  if (!emailPattern.test(email)) return json(400, { ok: false, message: "Enter a valid email address." });

  if (action === "send") {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    const challenge = { email, expires, signature: signChallenge({ email, otp, expires }) };
    try {
      const emailSent = await sendEmailOtp({ email, otp, name: payload.name });
      return json(200, {
        ok: true,
        emailSent,
        challenge,
        mockOtp: emailSent ? undefined : otp,
        message: emailSent ? "OTP sent to your email address." : "OTP generated. Configure EmailJS OTP variables in Netlify to send it by email.",
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
    if (challenge.email !== email || !challenge.expires || Date.now() > Number(challenge.expires)) {
      return json(400, { ok: false, message: "OTP expired. Please request a new code." });
    }
    const expected = signChallenge({ email, otp: token, expires: challenge.expires });
    if (expected !== challenge.signature) return json(400, { ok: false, message: "Invalid OTP. Please try again." });
    return json(200, { ok: true, message: "Email verified." });
  }

  return json(400, { ok: false, message: "Unsupported OTP action." });
};
