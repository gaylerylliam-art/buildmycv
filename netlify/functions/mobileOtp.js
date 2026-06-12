import crypto from "node:crypto";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const secret = () => process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "buildmycvnow-local-otp-secret";

const normalizePhone = (value = "") => String(value || "").replace(/[^\d+]/g, "").trim();

const signChallenge = ({ phone, otp, expires }) =>
  crypto.createHmac("sha256", secret()).update(`${phone}|${otp}|${expires}`).digest("hex");

const sendSms = async ({ phone, otp }) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new Error("Mobile OTP is not configured yet. Please use email verification or download-only mode.");
  }

  const params = new URLSearchParams();
  params.set("To", phone);
  params.set("From", from);
  params.set("Body", `Your BuildMyCVNow OTP is ${otp}. It expires in 10 minutes.`);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not send SMS OTP: ${detail || response.statusText}`);
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
  const phone = normalizePhone(payload.phone);
  if (!/^\+\d{8,15}$/.test(phone)) {
    return json(400, { ok: false, message: "Enter mobile number with country code, for example +971501234567." });
  }

  if (action === "send") {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    const challenge = { phone, expires, signature: signChallenge({ phone, otp, expires }) };
    try {
      await sendSms({ phone, otp });
    } catch (error) {
      return json(503, { ok: false, message: error.message || "Mobile OTP is not available." });
    }

    return json(200, {
      ok: true,
      smsSent: true,
      challenge,
      message: "OTP sent to your mobile number.",
    });
  }

  if (action === "verify") {
    const token = String(payload.otp || "").trim();
    const challenge = payload.challenge || {};
    if (!/^\d{6}$/.test(token)) return json(400, { ok: false, message: "Enter the 6-digit OTP." });
    if (challenge.phone !== phone || !challenge.expires || Date.now() > Number(challenge.expires)) {
      return json(400, { ok: false, message: "OTP expired. Please request a new code." });
    }
    const expected = signChallenge({ phone, otp: token, expires: challenge.expires });
    if (expected !== challenge.signature) return json(400, { ok: false, message: "Invalid OTP. Please try again." });
    return json(200, { ok: true, message: "Mobile number verified." });
  }

  return json(400, { ok: false, message: "Unsupported OTP action." });
};
