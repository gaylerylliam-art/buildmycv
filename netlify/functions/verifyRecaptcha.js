const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Use POST." });
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return json(503, {
      success: false,
      error: "reCAPTCHA is enabled in the app but RECAPTCHA_SECRET_KEY is missing in Netlify.",
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { success: false, error: "Invalid JSON." });
  }

  if (!body.token) {
    return json(400, { success: false, error: "Missing reCAPTCHA token." });
  }

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", body.token);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const result = await response.json();
  const scoreOk = typeof result.score === "number" ? result.score >= 0.5 : true;
  const actionOk = body.action && result.action ? result.action === body.action : true;

  return json(200, {
    success: Boolean(result.success && scoreOk && actionOk),
    message: result.success && scoreOk && actionOk ? "reCAPTCHA verified." : "reCAPTCHA verification failed.",
    score: result.score,
    action: result.action,
    challenge_ts: result.challenge_ts,
    hostname: result.hostname,
  });
};
