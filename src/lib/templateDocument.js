import QRCode from "qrcode";
import { getTemplateDesign } from "../data/cvTemplates.js";
import { getTemplateSampleStatus } from "../data/cvTemplateSamples.js";
import { cvTextLines } from "./cvText.js";
import { normalizeQrUrl } from "./validateQrUrl.js";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const clean = (value) => String(value ?? "").trim();
const lines = (value) => cvTextLines(clean(value));
const join = (items) => items.map(clean).filter(Boolean).join(" · ");
const arabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const sectionNames = {
  summary: "Profile", skills: "Skills", experience: "Work experience", education: "Education", educationProjects: "Projects",
  certifications: "Certifications", languages: "Languages", awards: "Awards", volunteerExperience: "Volunteer experience",
  professionalLinks: "Professional links", personal: "Personal details", references: "References",
};
const defaultOrder = Object.keys(sectionNames);
const earlySections = new Set(["summary", "skills", "experience"]);

export const templateFontStack = (font) => font.serif
  ? `"${font.name}", "Noto Naskh Arabic", Georgia, serif`
  : `"${font.name}", "Noto Sans Arabic", Arial, sans-serif`;

const ArabicFonts = [
  ["Noto Sans Arabic", "arabic-sans.woff2", "100 900"],
  ["Noto Naskh Arabic", "arabic-serif.woff2", "400 700"],
];
const fontRules = (font) => [
  ...(font.id === "lato"
    ? [["Lato", "lato-400.woff2", "400"], ["Lato", "lato-700.woff2", "700"]]
    : [[font.name, `${font.id}.woff2`, font.id === "garamond" ? "400 800" : "100 900"]]),
  ...ArabicFonts,
];
const face = ([family, file, weight], url) => `@font-face{font-family:"${family}";src:url("${url ?? "/assets/cv-fonts/" + file}") format("woff2");font-style:normal;font-weight:${weight};font-display:swap;}`;
export const templateFontCss = (font) => fontRules(font).map((rule) => face(rule)).join("\n");
export const isSamplePreview = (cv) => Boolean(cv.sampleTemplateId && getTemplateSampleStatus(cv).sections.includes("summary"));

export async function loadTemplateFonts(font) {
  if (!globalThis.document?.fonts) return;
  await Promise.all([
    document.fonts.load(`400 "${font.name}"`),
    document.fonts.load(`700 "${font.name}"`),
    document.fonts.load(`400 "${font.serif ? "Noto Naskh Arabic" : "Noto Sans Arabic"}"`, "\u0627"),
  ]).catch(() => {});
}

const embeddedFonts = new Map();
async function embedFont(rule) {
  const file = rule[1];
  if (!embeddedFonts.has(file)) {
    embeddedFonts.set(file, (async () => {
      const response = await fetch("/assets/cv-fonts/" + file);
      if (!response.ok) throw new Error("Could not load the selected CV font. Please try again.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (String.fromCharCode(...bytes.slice(0, 4)) !== "wOF2") throw new Error("Invalid CV font file.");
      return "data:font/woff2;base64," + btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
    })().catch((error) => { embeddedFonts.delete(file); throw error; }));
  }
  return face(rule, await embeddedFonts.get(file));
}

export function templateDocumentModel(cv, style) {
  const design = getTemplateDesign(style);
  const languageFlag = /arabic|\u0639\u0631\u0628\u064a/i.test(cv.outputLanguage || "");
  const rtl = cv.languageDirection === "rtl" || languageFlag ||
    [cv.fullName, cv.jobTitle, cv.summary, cv.education, ...((cv.workExperiences || []).map((item) => item.jobTitle))].some((text) => arabic.test(text || ""));
  const contacts = [cv.location || cv.country, cv.phone, cv.email, cv.linkedIn, cv.portfolioUrl].map(clean).filter(Boolean);
  const references = cv.references?.mode === "on-request" || (typeof cv.references === "string" && /available upon request/i.test(cv.references)) ? "References available upon request." :
    cv.references?.mode === "listed" ? (cv.references.entries || []).filter((entry) => entry.consentGiven && entry.name && entry.company)
      .map((entry) => join([entry.name, entry.jobTitle, entry.company, entry.relationship, join([entry.phoneCode, entry.phone]), entry.email])).join("\n") : "";
  const values = {
    summary: cv.summary, skills: cv.skills, education: cv.education, educationProjects: cv.projects,
    certifications: cv.certifications, languages: cv.languages, awards: cv.awards, volunteerExperience: cv.volunteerExperience,
    professionalLinks: cv.professionalLinks, references,
    personal: [
      cv.nationality && `Nationality: ${cv.nationality}`, cv.visaStatus && `Visa status: ${cv.visaStatus}`,
      cv.drivingLicense && `Driving license: ${cv.drivingLicense}`, cv.expectedSalaryEnabled && cv.expectedSalary && `Expected salary: ${cv.expectedSalary}`,
    ].filter(Boolean).join("\n"),
  };
  const order = [...new Set([...(Array.isArray(cv.sectionOrder) ? cv.sectionOrder : []), ...defaultOrder])].filter((id) =>
    Object.hasOwn(sectionNames, id) && !(cv.hiddenSections || []).includes(id));
  const blocks = order.flatMap((id) => {
    if (id === "experience") {
      const experience = cv.workExperiences?.length ? cv.workExperiences : cv.experience ? [{ responsibilities: cv.experience }] : [];
      return experience.filter((entry) => [entry.jobTitle, entry.employer, entry.companyLocation, entry.responsibilities, entry.achievements].some(clean)).map((entry) => ({
        id, heading: sectionNames[id], title: clean(entry.jobTitle), meta: join([entry.employer, entry.companyLocation]),
        dates: [clean(entry.fromDate), entry.isCurrent ? "Present" : clean(entry.toDate)].filter(Boolean).join(" – "),
        bullets: [...lines(entry.responsibilities), ...lines(entry.achievements)],
      }));
    }
    const paragraphs = lines(values[id]);
    return paragraphs.length ? (id === "education" ? paragraphs.map((text) => ({ id, heading: sectionNames[id], paragraphs: [text] })) :
      [{ id, heading: sectionNames[id], paragraphs }]) : [];
  });
  return { cv, design, rtl, contacts, blocks, qr: qrHtml(cv), name: clean(cv.fullName), job: clean(cv.jobTitle),
    initials: clean(cv.fullName).split(/\s+/).filter(Boolean).map((part) => Array.from(part)[0]).filter(Boolean).filter((_, i, a) => i === 0 || i === a.length - 1).join("").toUpperCase() };
}

function qrHtml(cv) {
  if (!cv.qrCode?.enabled) return "";
  const { ok, url } = normalizeQrUrl(cv.qrCode.url || cv.linkedIn || cv.portfolioUrl);
  if (!ok) return "";
  try {
    const { size, data } = QRCode.create(url, { errorCorrectionLevel: "M" }).modules;
    const path = Array.from(data, (on, i) => on ? `M${i % size + 4} ${Math.floor(i / size) + 4}h1v1h-1z` : "").join("");
    return `<figure class="tcv-qr"><svg viewBox="0 0 ${size + 8} ${size + 8}" aria-hidden="true"><path fill="#FFFFFF" d="M0 0h${size + 8}v${size + 8}H0z"/><path fill="#111827" d="${path}"/></svg><figcaption>${escape(cv.qrCode.label || "Scan for LinkedIn")}</figcaption></figure>`;
  } catch { return ""; }
}

export const templatePaperCss = `
.tcv-paper,.tcv-paper *{box-sizing:border-box}
.tcv-paper{position:relative;display:flex;flex-direction:column;width:794px;min-height:1122px;padding:48px 56px 34px;color:#1f2937;background:#fff;font-family:var(--tcv-font);font-size:12.5px;line-height:1.5;letter-spacing:0;overflow-wrap:anywhere;text-align:start;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.tcv-paper h2,.tcv-paper h3,.tcv-paper p,.tcv-paper ul{margin:0}
.tcv-paper ul{padding-inline:16px 0;list-style:disc}
.tcv-paper li+li{margin-top:3px}
.tcv-header{padding-bottom:15px;margin-bottom:18px;border-bottom:1px solid var(--tcv-accent)}
.tcv-header h2{font-size:32px;font-weight:750;line-height:1.15;color:#131e30}
.tcv-header p{margin-top:5px;color:var(--tcv-ink);font-weight:700;font-size:14px}
.tcv-contact{display:flex;gap:3px 14px;flex-wrap:wrap;margin-top:10px;color:#475569;font-size:11.5px}
.tcv-paper[data-layout="single_column"] .tcv-header{text-align:center}
.tcv-paper[data-layout="single_column"] .tcv-contact{justify-content:center}
.tcv-header.tcv-cont{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding-bottom:9px}
.tcv-header.tcv-cont h2{font-size:18px}
.tcv-header.tcv-cont p{font-size:12px;text-align:end;margin:0}
.tcv-body{display:grid;grid-template-columns:minmax(0,1fr);align-items:start;gap:24px;flex:1}
.tcv-body.tcv-two-cols{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}
.tcv-paper[data-layout="sidebar"]{padding-inline-start:0}
.tcv-paper[data-layout="sidebar"] .tcv-body{grid-template-columns:262px minmax(0,1fr);gap:30px}
.tcv-paper[data-layout="sidebar"]::before{content:"";position:absolute;inset-block:0;inset-inline-start:0;width:262px;background:var(--tcv-accent)}
.tcv-paper[data-layout="sidebar"] .tcv-side{position:relative;color:var(--tcv-on);padding:0 25px}
.tcv-paper[data-layout="sidebar"] .tcv-side h3,.tcv-paper[data-layout="sidebar"] .tcv-contact{color:inherit}
.tcv-paper[data-layout="sidebar"] .tcv-contact{display:grid;margin-bottom:13px}
.tcv-paper[data-layout="sidebar"] .tcv-footer{margin-inline-start:292px}
.tcv-paper[data-layout="header_band_two_col"] .tcv-side{background:var(--tcv-tint);padding:16px;border-radius:5px}
.tcv-paper[data-layout="header_band_two_col"]{padding-top:0}
.tcv-paper[data-layout="header_band_two_col"] .tcv-header{margin:0 -56px 22px;background:var(--tcv-accent);padding:28px 56px;color:var(--tcv-on)}
.tcv-paper[data-layout="header_band_two_col"] .tcv-header.tcv-cont{padding-block:14px}
.tcv-paper[data-layout="header_band_two_col"] .tcv-header :is(h2,p,.tcv-contact){color:inherit}
.tcv-paper[data-layout="timeline"] .tcv-header{background:var(--tcv-tint);border:0;border-radius:5px;padding:16px}
.tcv-header.tcv-with-photo{display:flex;align-items:center;gap:18px}
.tcv-portrait{display:grid;place-items:center;flex:none;width:86px;height:86px;border:2px solid currentColor;border-radius:50%;object-fit:cover;font-size:24px;font-weight:700}
.tcv-side>.tcv-portrait{margin:0 auto 20px}
.tcv-block{margin-bottom:14px;break-inside:avoid}
.tcv-block h3,.tcv-side-title{font-size:12px;font-weight:750;color:var(--tcv-ink);text-transform:uppercase;border-bottom:1px solid var(--tcv-tint2);padding-bottom:3px;margin-bottom:5px}
.tcv-block.tcv-related{margin-top:-5px}
.tcv-block p+p{margin-top:4px}
.tcv-position{display:flex;justify-content:space-between;gap:12px}
.tcv-position>span{flex:none;max-width:35%;font-size:11.5px;color:#475569;text-align:end}
.tcv-entry ul{margin-top:5px}
.tcv-entry .tcv-meta{color:#475569;margin-top:2px}
.tcv-paper[data-layout="timeline"] .tcv-timeline-entry{display:grid;grid-template-columns:100px minmax(0,1fr);gap:12px}
.tcv-paper[data-layout="timeline"] .tcv-timeline-entry>.tcv-dates{color:var(--tcv-ink);font-weight:700}
.tcv-paper[data-layout="timeline"] .tcv-entry{position:relative;padding-inline-start:13px;border-inline-start:2px solid var(--tcv-tint2)}
.tcv-paper[data-layout="timeline"] .tcv-entry::before{content:"";position:absolute;inset-inline-start:-5px;top:5px;width:8px;height:8px;border-radius:50%;background:var(--tcv-accent)}
.tcv-paper[data-layout="label_column"]{border-top:7px solid var(--tcv-accent)}
.tcv-paper[data-layout="label_column"] .tcv-block{display:grid;grid-template-columns:132px minmax(0,1fr);gap:12px}
.tcv-paper[data-layout="label_column"] .tcv-block h3{border:0}
.tcv-paper[data-layout="label_column"] .tcv-block.tcv-related>div{grid-column:2}
.tcv-footer{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #d8e0e8;padding-top:7px;margin-top:12px;font-size:10.5px;color:#475569}
.tcv-footer span:last-child{flex-shrink:0}
.tcv-credit{font-size:10px;margin-top:3px!important;text-align:end;color:#475569}
.tcv-paper .tcv-side:empty{padding:0}
.tcv-qr{margin:8px 0 0;text-align:center;font-size:10.5px}
.tcv-qr svg{display:block;width:64px;height:64px;margin:0 auto}
.tcv-header .tcv-qr{margin-inline-start:auto}
`;

function portrait(model) {
  if (!model.design.showPhoto) return "";
  const source = clean(model.cv.profilePhoto);
  return /^data:image\/(?:png|jpe?g|webp);base64,[a-z\d+/=\s]+$/i.test(source) || /^https:\/\//i.test(source)
    ? `<img class="tcv-portrait" src="${escape(source)}" alt="Profile photo" referrerpolicy="no-referrer">`
    : model.initials ? `<span aria-hidden="true" class="tcv-portrait">${escape(model.initials)}</span>` : "";
}

function blockHtml(block, previous, model) {
  const timeline = block.id === "experience" && model.design.template.layout === "timeline";
  const related = previous?.id === block.id;
  const body = block.bullets
    ? `<div class="${timeline ? "tcv-timeline-entry" : ""}">${timeline ? `<span class="tcv-dates">${escape(block.dates)}</span>` : ""}<div class="tcv-entry">
      <div class="tcv-position"><strong>${escape(block.title)}</strong>${!timeline && block.dates ? `<span>${escape(block.dates)}</span>` : ""}</div>
      ${block.meta ? `<p class="tcv-meta">${escape(block.meta)}</p>` : ""}
      ${block.bullets.length ? `<ul>${block.bullets.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}</div></div>`
    : `<div>${block.paragraphs.map((item) => `<p>${escape(item)}</p>`).join("")}</div>`;
  return `<section class="tcv-block${related ? " tcv-related" : ""}">${related ? "" : `<h3>${escape(block.heading)}</h3>`}${body}</section>`;
}

export function templatePageHtml(model, page, index, count) {
  const { design, name, job, contacts, rtl } = model;
  const { template, font, accent, ink, tint, tint2, onAccent } = design;
  const layout = template.layout;
  const sidebar = layout === "sidebar";
  const side = Boolean(template.side);
  const list = (blocks) => blocks.map((block, i) => blockHtml(block, blocks[i - 1], model)).join("");
  const contact = contacts.length ? `<div class="tcv-contact">${contacts.map((text) => `<bdi>${escape(text)}</bdi>`).join("")}</div>` : "";
  const photo = index === 0 ? portrait(model) : "";
  const sidebarQr = sidebar && model.cv.qrCode?.position === "sidebar";
  const headerQr = !index && !sidebarQr && model.cv.qrCode?.position !== "footer" ? model.qr : "";
  const header = `<header class="tcv-header${index ? " tcv-cont" : ""}${photo && !sidebar ? " tcv-with-photo" : ""}">
    ${!sidebar ? photo : ""}<div><h2>${escape(name)}</h2><p>${escape(job)}</p>${!index && !sidebar ? contact : ""}</div>${headerQr}</header>`;
  const footer = `<footer class="tcv-footer"><span>${escape(name)} — CV</span><span>Page ${index + 1} of ${count}</span></footer>`;
  return `<article class="tcv-paper" dir="${rtl ? "rtl" : "ltr"}" data-layout="${layout}"
    style="--tcv-accent:${accent};--tcv-ink:${ink};--tcv-on:${onAccent};--tcv-tint:${tint};--tcv-tint2:${tint2};--tcv-font:${escape(templateFontStack(font))}">
    ${sidebar ? "" : header}
    <div class="tcv-body${side ? " tcv-two-cols" : ""}">
      ${sidebar ? `<aside class="tcv-side">${photo}${!index && contact ? `<h3 class="tcv-side-title">Contact</h3>${contact}` : ""}${list(page.side)}${!index && sidebarQr ? model.qr : ""}</aside>` : ""}
      <div class="tcv-main">${sidebar ? header : ""}${list(page.main)}</div>
      ${side && !sidebar ? `<aside class="tcv-side">${list(page.side)}</aside>` : ""}
    </div>${model.cv.qrCode?.position === "footer" && index === count - 1 ? model.qr : ""}${footer}
    ${model.cv.showCredit !== false && index === count - 1 ? '<p class="tcv-credit">CV created free at buildmycvnow.com</p>' : ""}</article>`;
}

export function paginateTemplate(model, measure = () => true, demo = false) {
  const pages = [{ main: [], side: [] }];
  const { template } = model.design;
  let oversized = false;
  const pendingSide = [];
  const isSide = (block) => template.side?.some((ids) => ids.includes(block.id));
  const main = model.blocks.filter((block) => {
    if (!isSide(block)) return true;
    pendingSide.push(block);
    return false;
  });
  const addPage = () => pages.push({ main: [], side: [] });
  for (const block of main) {
    let page = pages.at(-1);
    if (demo && pages.length === 1 && page.main.length && !earlySections.has(block.id)) {
      addPage();
      page = pages.at(-1);
    }
    page.main.push(block);
    if (!measure(page, pages.length - 1)) {
      if (page.main.length > 1) {
        page.main.pop();
        addPage();
        page = pages.at(-1);
        page.main.push(block);
      }
      if (!measure(page, pages.length - 1)) oversized = true;
    }
  }
  if (demo && pages.length === 1) addPage();
  for (const block of pendingSide) {
    const desired = template.side[1].includes(block.id) ? 1 : 0;
    let placed = false;
    for (let i = Math.min(desired, pages.length - 1); i < Math.min(pages.length, 2); i += 1) {
      pages[i].side.push(block);
      if (measure(pages[i], i)) { placed = true; break; }
      pages[i].side.pop();
    }
    if (!placed) {
      let page = pages.at(-1);
      page.main.push(block);
      if (!measure(page, pages.length - 1)) {
        page.main.pop();
        addPage();
        page = pages.at(-1);
        page.main.push(block);
        if (!measure(page, pages.length - 1)) oversized = true;
      }
    }
  }
  return { pages, oversized };
}

export function renderTemplateDocument(model, demo = false) {
  const probe = globalThis.document?.createElement("div");
  if (probe) {
    probe.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none";
    probe.setAttribute("aria-hidden", "true");
    const root = probe.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = templatePaperCss;
    const body = document.createElement("div");
    root.append(style, body);
    document.body.append(probe);
    try {
      const result = paginateTemplate(model, (page, index) => {
        body.innerHTML = templatePageHtml(model, page, index, index + 1);
        return body.firstElementChild.getBoundingClientRect().height <= 1122.1;
      }, demo);
      return { ...result, html: result.pages.map((page, i) => templatePageHtml(model, page, i, result.pages.length)) };
    } finally { probe.remove(); }
  }
  const result = paginateTemplate(model, undefined, demo);
  return { ...result, html: result.pages.map((page, i) => templatePageHtml(model, page, i, result.pages.length)) };
}

export async function buildTemplatePrintHtml(cv) {
  const model = templateDocumentModel(cv, cv.templateStyle);
  await loadTemplateFonts(model.design.font);
  const result = renderTemplateDocument(model, isSamplePreview(cv));
  if (result.oversized || result.pages.length > model.design.template.maxPages) {
    throw new Error("This template fits up to 4 pages. Shorten long sections or switch to a standard layout before downloading.");
  }
  const fonts = globalThis.document ? (await Promise.all(fontRules(model.design.font).map(embedFont))).join("\n") : templateFontCss(model.design.font);
  return { pageCount: result.pages.length, html: `<!doctype html><html><head><meta charset="UTF-8"><style>
    ${fonts}\n${templatePaperCss}
    @page { size: A4; margin: 0; }
    html,body{margin:0;padding:0}
    .tcv-paper{width:210mm;min-height:0;height:297mm;break-inside:avoid}
    .tcv-paper:not(:last-child){break-after:page}
    </style></head><body>${result.html.join("")}</body></html>` };
}
