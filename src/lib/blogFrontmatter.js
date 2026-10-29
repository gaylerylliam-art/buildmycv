export function parseBlogFrontmatter(raw) {
  raw = raw.replace(/\r\n/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  match[1].split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (!key) return;
    const value = rest.join(":").trim();
    data[key.trim()] = /^\[.*\]$/.test(value)
      ? value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean)
      : value;
  });
  return { data, body: match[2] };
}
