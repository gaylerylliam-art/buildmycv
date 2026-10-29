// Remove pasted list markers and surrounding whitespace without changing words,
// dates, or signed numbers such as "-10%".
export const cvTextLines = (value = "") => String(value || "").split(/\r?\n/)
  .map(line => line.trim().replace(/^(?:[•●▪◦*]\s*|-\s+)/u, "").trim())
  .filter(Boolean);
