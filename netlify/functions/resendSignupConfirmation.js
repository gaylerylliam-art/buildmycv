const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Use POST." });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const redirectTo = process.env.VITE_AUTH_REDIRECT_URL || "https://buildmycvforfree.netlify.app/#builder";

  if (!supabaseUrl || !apiKey) {
    return json(500, { error: "Supabase URL or API key is not configured on the server." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON." });
  }

  if (!body.email) {
    return json(400, { error: "Email is required." });
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/resend`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "signup",
      email: body.email,
      options: { email_redirect_to: redirectTo },
    }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    return json(response.status, { error: payload.msg || payload.message || "Could not resend confirmation email." });
  }

  return json(200, { ok: true });
};
