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
  if (!body?.cv) {
    return json(400, { error: "cv is required." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(200, {
      mode: "mock",
      score: 78,
      strengths: ["Clear contact details", "Relevant skills included"],
      improvements: ["Add more measurable work achievements", "Include job keywords from the vacancy"],
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
            "You are an ATS CV reviewer. Return JSON only with score from 0-100, strengths array, improvements array, and missingKeywords array. Use simple English.",
        },
        {
          role: "user",
          content: `Review this CV for category ${body.category || "general"} and target job ${body.targetJob || body.cv.jobTitle || "not provided"}: ${JSON.stringify(body.cv)}`,
        },
      ],
      temperature: 0.2,
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
    return json(200, { score: 0, strengths: [], improvements: [content], missingKeywords: [] });
  }
};
