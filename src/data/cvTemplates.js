export const templateColors = [
  ["Navy", "#1F3A5F"], ["Teal", "#0F766E"], ["Green", "#166534"],
  ["Slate", "#334155"], ["Burgundy", "#8B1E3F"], ["Royal blue", "#1D4ED8"],
].map(([name, value]) => ({ name, value }));

export const templateFonts = [
  ["inter", "Inter", "Arial", false],
  ["lato", "Lato", "Calibri", false],
  ["sourcesans", "Source Sans 3", "Calibri", false],
  ["merriweather", "Merriweather", "Georgia", true],
  ["garamond", "EB Garamond", "Garamond", true],
].map(([id, name, word, serif]) => ({ id, name, word, serif }));

export const cvTemplates = [
  { id: "classic", name: "Classic", description: "Centered header and a clean single column.", categories: ["finance", "helper"], layout: "single_column", defaultAccent: "#1F3A5F", defaultFont: "inter" },
  { id: "sidebar", name: "Modern Sidebar", description: "Colored side panel for contact, skills and languages.", categories: ["it", "marketing"], layout: "sidebar", defaultAccent: "#0F766E", defaultFont: "inter", photo: true, side: [["skills", "languages"], ["certifications", "personal"]] },
  { id: "executive", name: "Executive", description: "A bold name band and a two-column body.", categories: ["engineering", "finance"], layout: "header_band_two_col", defaultAccent: "#334155", defaultFont: "sourcesans", side: [["skills", "education"], ["certifications", "languages", "personal"]] },
  { id: "timeline", name: "Timeline", description: "A dated career timeline with clear milestones.", categories: ["hospitality", "education", "domestic"], layout: "timeline", defaultAccent: "#8B1E3F", defaultFont: "lato", photo: true },
  { id: "compact", name: "Compact (ATS)", description: "A narrow label column and straightforward typography.", categories: ["supply-chain-logistics", "skilled"], layout: "label_column", defaultAccent: "#166534", defaultFont: "merriweather" },
].map((template, sortOrder) => ({ pages: 2, maxPages: 4, version: 1, active: true, sortOrder, ...template }));

export function normalizeTemplateColor(value) {
  if (typeof value !== "string" || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return null;
  return (value.length === 4 ? "#" + [...value.slice(1)].map((char) => char.repeat(2)).join("") : value).toUpperCase();
}

export function resolveTemplateStyle(input = {}) {
  const template = cvTemplates.find(({ id }) => id === input.templateId && (input.templateVersion ?? 1) === 1);
  if (!template?.active) throw new Error("INVALID_TEMPLATE");
  const accentColor = normalizeTemplateColor(input.accentColor === undefined ? template.defaultAccent : input.accentColor);
  if (!accentColor) throw new Error("INVALID_COLOR");
  const font = templateFonts.find(({ id }) => id === (input.fontId === undefined ? template.defaultFont : input.fontId));
  if (!font) throw new Error("INVALID_FONT");
  if (input.showPhoto !== undefined && typeof input.showPhoto !== "boolean") throw new Error("INVALID_PHOTO_SETTING");
  return { templateId: template.id, templateVersion: template.version, accentColor, fontId: font.id, showPhoto: input.showPhoto ?? Boolean(template.photo) };
}

export function getTemplateDesign(style) {
  const settings = resolveTemplateStyle(style);
  const template = cvTemplates.find(({ id }) => id === settings.templateId);
  const font = templateFonts.find(({ id }) => id === settings.fontId);
  const accent = settings.accentColor;
  const channels = accent.slice(1).match(/../g).map((hex) => parseInt(hex, 16));
  const luminance = channels.reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0) / 255;
  const ink = luminance > 0.55 ? "#" + channels.map((x) => Math.floor(x / 2).toString(16).padStart(2, "0")).join("") : accent;
  return { template, font, accent, ink, onAccent: luminance > 0.6 ? "#111827" : "#FFFFFF", tint: accent + "17", tint2: accent + "50", warning: luminance > 0.6, showPhoto: template.photo && settings.showPhoto };
}

export function readTemplateDesign(style) {
  if (!style) return null;
  try { return getTemplateDesign(style); } catch { return null; }
}
