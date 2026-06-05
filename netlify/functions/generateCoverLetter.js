const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const parseBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Use POST." });
  }

  const body = parseBody(event);
  if (!body?.cv || !body?.companyName || !body?.position) {
    return json(400, { error: "cv, companyName, and position are required." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(200, {
      mode: "mock",
      opening: `I am applying for the ${body.position} position at ${body.companyName}. I am interested in this role and ready to contribute with a positive attitude.`,
      body: `My experience and skills match this job category. I can follow instructions, work with a team, and complete daily duties responsibly.`,
      closing: "Thank you for considering my application. I would welcome the opportunity to discuss how I can support your team.",
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You write simple, professional cover letters for entry-level job seekers and workers. Return JSON only with opening, body, and closing strings. Keep it honest and beginner-friendly.",
        },
        {
          role: "user",
          content: `Create a cover letter for ${body.cv.fullName || "the applicant"} applying for ${body.position} at ${body.companyName}. Category: ${body.category || "general"}. CV: ${JSON.stringify(body.cv)}.`,
        },
      ],
      temperature: 0.45,
    }),
  });

  if (!response.ok) {
    return json(response.status, { error: "OpenAI request failed." });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  try {
    return json(200, JSON.parse(content));
  } catch {
    return json(200, { opening: content, body: "", closing: "" });
  }
};
