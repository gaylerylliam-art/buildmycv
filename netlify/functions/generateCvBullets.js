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
  if (!body?.jobTitle || !body?.category) {
    return json(400, { error: "jobTitle and category are required." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(200, {
      mode: "mock",
      suggestions: [
        "Handled daily tasks with good time management and a positive attitude.",
        "Supported team members and followed company standards carefully.",
        "Communicated clearly with customers, supervisors, and co-workers.",
      ],
    });
  }

  const prompt = `You are a CV writing assistant for entry-level and worker job seekers. Write 5 short, honest, ATS-friendly bullet points using simple English. Do not exaggerate experience. Return JSON only with a "suggestions" array. Category: ${body.category}. Job title: ${body.jobTitle}. Skills: ${body.skills || "not provided"}. Experience: ${body.experience || "not provided"}.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return concise, beginner-friendly CV writing suggestions as valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
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
    return json(200, { suggestions: [content] });
  }
};
