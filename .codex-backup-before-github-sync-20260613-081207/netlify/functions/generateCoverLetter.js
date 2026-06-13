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

  const candidateSnapshot = {
    fullName: body.cv.fullName || "",
    jobTitle: body.cv.jobTitle || body.position || "",
    country: body.cv.country || "",
    nationality: body.cv.nationality || "",
    visaStatus: body.cv.visaStatus || "",
    linkedIn: body.cv.linkedIn || "",
  };

  if (!process.env.OPENAI_API_KEY) {
    return json(200, {
      mode: "mock",
      opening: `I am applying for the ${body.position} position at ${body.companyName}. I am interested in this role and ready to contribute with a positive attitude.`,
      body: "My experience and skills match this job category. I can follow instructions, work with a team, and complete daily duties responsibly. I will use my real experience honestly and learn the company systems required for the role.",
      qualifications: `I understand the requirements of the ${body.position} role and can support the work with practical experience, ATS-friendly skills, and a professional attitude.`,
      value: "I can add value by being dependable, learning quickly, following company standards, and helping the team complete daily work with care.",
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
            "You write ATS-friendly professional cover letters for job seekers, workers, technicians, domestic workers, teachers, and office professionals. Keep the letter concise, honest, and simple. Do not paste or summarize the full CV, skills list, or work history. Use only the candidate basics, selected role, employer name, experience level, region, and job description. Return JSON only with opening, body, qualifications, value, and closing strings.",
        },
        {
          role: "user",
          content: `Create a short cover letter for ${candidateSnapshot.fullName || "the applicant"} applying for ${body.position} at ${body.companyName}. Category: ${body.category || body.position || "general"}. Experience level: ${body.experienceLevel || "not provided"}. Years of experience: ${body.yearsExperience || "not provided"}. Region: ${body.region || "International Standard Format"}. Job description: ${body.jobDescription || "not provided"}. Candidate basics: ${JSON.stringify(candidateSnapshot)}.`,
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
