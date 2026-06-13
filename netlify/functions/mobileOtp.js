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
  if (!sid || !token || !from) return false;

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
    let providerError = {};
    try {
      providerError = JSON.parse(detail || "{}");
    } catch {
      providerError = {};
    }
    const code = providerError.code ? ` Twilio code: ${providerError.code}.` : "";
    const message = providerError.code === 21612
      ? "Twilio cannot send SMS to this mobile number from the configured sender. Enable the destination country in Twilio geo permissions or use a Twilio sender that supports this route."
      : providerError.message || detail || response.statusText;
    const error = new Error(`${message}${code}`);
    error.providerCode = providerError.code;
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
  const phone = normalizePhone(payload.phone);
  if (!/^\+\d{8,15}$/.test(phone)) {
    return json(400, { ok: false, message: "Enter mobile number with country code, for example +971501234567." });
  }

  if (action === "send") {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    const challenge = { phone, expires, signature: signChallenge({ phone, otp, expires }) };
    let smsSent = false;
    try {
      smsSent = await sendSms({ phone, otp });
    } catch (error) {
      return json(502, {
        ok: false,
        smsSent: false,
        providerCode: error.providerCode,
        message: error.message || "Could not send SMS OTP. Please try email sign-in or contact support.",
      });
    }

    return json(200, {
      ok: true,
      smsSent,
      challenge,
      mockOtp: smsSent ? undefined : otp,
      message: smsSent ? "OTP sent to your mobile number." : "OTP generated. Configure Twilio in Netlify to send it by SMS.",
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
