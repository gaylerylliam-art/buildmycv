import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cities, seoJobs, topCityJobSlugs } from "../src/content/programmaticSeo.js";
import { homepageFaqs } from "../src/content/seoFaq.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const blogDir = path.join(root, "content", "blog");
const baseUrl = "https://buildmycvnow.com";
const buildDate = new Date().toISOString().slice(0, 10);

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const stripMd = (value = "") => value.replace(/[#*_`>\[\]\(\)]/g, "").replace(/\s+/g, " ").trim();
const slugify = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  match[1].split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (!key) return;
    const value = rest.join(":").trim();
    if (/^\[.*\]$/.test(value)) {
      data[key.trim()] = value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
    } else {
      data[key.trim()] = value;
    }
  });
  return { data, body: match[2] };
}

function renderMarkdown(md) {
  const toc = [];
  const lines = md.split("\n");
  let html = "";
  let listOpen = false;
  for (const line of lines) {
    if (!line.trim()) {
      if (listOpen) { html += "</ul>"; listOpen = false; }
      continue;
    }
    if (line.trim() === "<!--cta-->") {
      if (listOpen) { html += "</ul>"; listOpen = false; }
      html += ctaCard();
      continue;
    }
    const h2 = line.match(/^##\s+(.+)/);
    const h1 = line.match(/^#\s+(.+)/);
    if (h1 || h2) {
      if (listOpen) { html += "</ul>"; listOpen = false; }
      const text = h1?.[1] || h2?.[1];
      const id = slugify(text);
      if (h2) toc.push({ id, text });
      html += h1 ? `<h1>${escapeHtml(text)}</h1>` : `<h2 id="${id}">${escapeHtml(text)}</h2>`;
      continue;
    }
    if (/^-\s+/.test(line)) {
      if (!listOpen) { html += "<ul>"; listOpen = true; }
      html += `<li>${inlineMd(line.replace(/^-\s+/, ""))}</li>`;
      continue;
    }
    if (/^\|/.test(line)) continue;
    if (/^`.+`$/.test(line.trim())) {
      if (listOpen) { html += "</ul>"; listOpen = false; }
      html += `<pre><code>${escapeHtml(line.trim().slice(1, -1))}</code></pre>`;
      continue;
    }
    if (listOpen) { html += "</ul>"; listOpen = false; }
    html += `<p>${inlineMd(line)}</p>`;
  }
  if (listOpen) html += "</ul>";
  return { html, toc };
}

function inlineMd(value) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function writePage(route, html) {
  const cleanRoute = route === "/" ? "" : route.replace(/^\/|\/$/g, "");
  const dir = path.join(dist, cleanRoute);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, "index.html"), html);
  routes.add(route);
}

function layout({ title, description, canonical, body, jsonLd = [], type = "website", image = `${baseUrl}/assets/og-image.jpg` }) {
  const schemas = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:site_name" content="BuildMyCVNow" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${image}" />
  <script defer data-domain="buildmycvnow.com" src="https://plausible.io/js/script.js"></script>
  <script>window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}</script>
  <style>${criticalCss()}</style>
  ${schemas.filter(Boolean).map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`).join("\n")}
</head>
<body>
${header()}
${body}
${footer()}
</body>
</html>`;
}

function criticalCss() {
  return `body{margin:0;font-family:Inter,Arial,sans-serif;color:#0f172a;background:#fff;line-height:1.65}a{color:#185fa5}img{max-width:100%;height:auto}.nav{position:sticky;top:0;background:#fff;border-bottom:1px solid #e5e7eb;z-index:10}.nav-inner{max-width:1120px;margin:auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{font-weight:900;text-decoration:none;color:#0f172a}.brand span{color:#16a34a}.nav-links{display:flex;gap:18px;align-items:center}.nav-links a{text-decoration:none;color:#334155;font-weight:800;font-size:14px}.cta,.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:#16a34a;color:#fff!important;padding:12px 18px;text-decoration:none;font-weight:900}.btn.secondary{background:#eff6ff;color:#185fa5!important}.hero{padding:72px 20px 44px;background:#f8fafc}.wrap{max-width:1120px;margin:auto}.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:42px;align-items:center}h1{font-size:clamp(36px,5vw,60px);line-height:1.03;margin:0 0 18px}h2{font-size:clamp(26px,3vw,38px);line-height:1.15;margin:0 0 18px}h3{margin:0 0 8px}.lead{font-size:20px;color:#475569}.trust{margin-top:16px;font-weight:900;color:#475569}.section{padding:56px 20px}.grid{display:grid;gap:20px}.grid-3{grid-template-columns:repeat(3,1fr)}.grid-4{grid-template-columns:repeat(4,1fr)}.card{border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:22px}.muted{color:#64748b}.faq details{border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#fff;margin-bottom:12px}.faq summary{font-weight:900;cursor:pointer}.cta-band{background:#185fa5;color:#fff;text-align:center}.cta-band a{background:#fff;color:#185fa5!important}.footer{padding:34px 20px;background:#0f172a;color:#cbd5e1}.footer a{color:#e2e8f0}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1px solid #bfdbfe;background:#eff6ff;color:#185fa5;border-radius:999px;padding:7px 10px;font-weight:800}.article{max-width:720px;margin:auto}.article h1{font-size:42px}.article p,.article li{font-size:18px}.toc{border:1px solid #e2e8f0;border-radius:10px;padding:16px;background:#f8fafc}.cv-snippet{border-left:4px solid #185fa5;background:#f8fafc;padding:18px;border-radius:8px}.template-thumb{min-height:180px;border:1px solid #e2e8f0;border-radius:10px;background:linear-gradient(90deg,#185fa5 0 28%,#fff 28%);padding:18px}.proof{background:#fff;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:16px 20px;text-align:center;font-weight:900;color:#334155}@media(max-width:800px){.hero-grid,.grid-3,.grid-4{grid-template-columns:1fr}.nav-links{display:none}.section{padding:38px 18px}.hero{padding-top:44px}}`;
}

function header() {
  return `<nav class="nav"><div class="nav-inner"><a class="brand" href="/">BuildMyCV<span>Now</span></a><div class="nav-links"><a href="/templates">Templates</a><a href="/cv-examples">CV Examples</a><a href="/for-ofw">For OFWs</a><a href="/blog">Blog</a><a href="/faq">FAQ</a><a class="cta" href="/builder">Build My CV Now</a></div></div></nav>`;
}

function footer() {
  return `<footer class="footer"><div class="wrap"><p><strong>BuildMyCVNow</strong> â€” Free CV Builder for Job Seekers Worldwide</p><p><a href="/about">About</a> Â· <a href="/privacy">Privacy</a> Â· <a href="/terms">Terms</a> Â· <a href="/faq">FAQ</a> Â· <a href="/blog">Blog</a> Â· <a href="/for-ofw">For OFWs</a></p><p>Â© 2026 BuildMyCVNow. All rights reserved.</p></div></footer>`;
}

function ctaCard(text = "Build your free CV") {
  return `<div class="card" style="background:#ecfdf5;border-color:#bbf7d0"><h3>${text}</h3><p>Create an ATS-friendly CV for local, remote, and international jobs in minutes. No sign-up required.</p><a class="cta" href="/builder">Build My CV Now â€” Free</a></div>`;
}

const routes = new Set();
const originalIndex = path.join(dist, "index.html");
if (fs.existsSync(originalIndex)) {
  ensureDir(path.join(dist, "builder"));
  fs.copyFileSync(originalIndex, path.join(dist, "builder", "index.html"));
}

const webAppSchema = { "@context": "https://schema.org", "@type": "WebApplication", name: "BuildMyCVNow", applicationCategory: "BusinessApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, url: baseUrl };
const orgSchema = { "@context": "https://schema.org", "@type": "Organization", name: "BuildMyCVNow", url: baseUrl, logo: `${baseUrl}/assets/og-image.jpg`, sameAs: ["https://www.facebook.com/", "https://www.linkedin.com/"] };
const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: homepageFaqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) };

writePage("/", layout({
  title: "Free CV Builder for Global Jobs | BuildMyCVNow",
  description: "Build a professional, ATS-friendly CV in 5 minutes. Free templates for local, remote, and international jobs. No sign-up needed.",
  canonical: baseUrl,
  jsonLd: [webAppSchema, faqSchema, orgSchema],
  body: `<main><section class="hero"><div class="wrap hero-grid"><div><h1>Free CV Builder for Job Seekers Worldwide - ATS-Friendly, No Sign-Up</h1><p class="lead">Build a professional CV in 5 minutes. Templates designed for local jobs, overseas applications, remote roles, and global hiring markets. 100% free â€” no hidden paywall, no watermark.</p><p><a class="cta" href="/builder">Build My CV Now â€” Free</a> <a class="btn secondary" href="/cv-examples">See CV examples</a></p><p class="trust">No sign-up required Â· ATS-friendly Â· Free PDF download</p></div><div class="template-thumb"><h3>Finished global CV preview</h3><p class="muted">Professional Summary</p><p>Reliable applicant with ATS-friendly format, clear skills, work experience, and contact details for international recruiters.</p></div></div></section><div class="proof">Trusted by job seekers worldwide | Useful for local, overseas, and remote applications | 12,000+ CVs started</div>${howItWorks()}${gulfDepthSection()}${whySection()}${templatesPreview()}${comparisonSection()}${faqSection()}${ofwHomeSection()}<section class="section cta-band"><div class="wrap"><h2>Ready to build your CV?</h2><p>Free forever, no sign-up, and built for job applications anywhere.</p><a class="cta" href="/builder">Start free now</a></div></section></main>`,
}));

function howItWorks() {
  return `<section class="section"><div class="wrap"><h2>How it works</h2><div class="grid grid-3"><div class="card"><h3>1. Choose a template</h3><p>Pick a layout built for your industry. Hospitality, engineering, logistics, sales, finance, and skilled-worker formats are ready.</p></div><div class="card"><h3>2. Fill in your details</h3><p>Add your work history, languages, education, certifications, and country-specific details when they matter for your target job.</p></div><div class="card"><h3>3. Download your CV</h3><p>Check the live preview and ATS score, then download an ATS-ready PDF for free.</p></div></div></div></section>`;
}

function whySection() {
  const cards = [
    ["Built for global applications", "Create a clean CV for local jobs, overseas opportunities, remote roles, and region-specific hiring requirements."],
    ["Passes ATS screening", "ATS software scans CV text before a recruiter reads it. BuildMyCVNow keeps headings, keywords, and formatting easy for systems to read."],
    ["Actually free", "No surprise paywall at download. You can create and download your CV without a credit card."],
    ["Works on your phone", "Most users build on mobile. The builder is designed with large fields, live preview, and simple download flow."],
  ];
  return `<section class="section"><div class="wrap"><h2>Why job seekers worldwide choose BuildMyCVNow</h2><div class="grid grid-4">${cards.map(([h, p]) => `<div class="card"><h3>${h}</h3><p>${p}</p></div>`).join("")}</div></div></section>`;
}

function gulfDepthSection() {
  const cards = [
    ["Visa status, done right", "Write phrases like Residence visa - transferable or Visit visa - available immediately in the clear style recruiters expect.", "/blog/visa-status-on-cv-uae", "Read visa guide"],
    ["The GCC details block", "Country, nationality, visa status, driving license, languages, expected salary, and references are built into the CV form as optional fields.", "/builder", "Open builder"],
    ["Job-title corrections", "The AI writing assistant and role templates help turn rough wording into cleaner recruiter-friendly job titles and responsibilities.", "/builder", "Try AI help"],
    ["Salary-realistic examples", "Programmatic CV example pages include practical AED ranges for each role, so examples feel grounded instead of generic.", "/cv-examples", "Browse examples"],
  ];
  return `<section class="section"><div class="wrap"><h2>Made for Gulf hiring - not adapted to it</h2><p class="lead">BuildMyCVNow is global, but it also understands Gulf recruitment details that many general CV builders miss.</p><div class="grid grid-4">${cards.map(([title, text, href, link]) => `<article class="card"><div class="cv-snippet" style="min-height:92px"><strong>${title}</strong><p>${text}</p></div><p><a href="${href}">${link}</a></p></article>`).join("")}</div></div></section>`;
}

function comparisonSection() {
  const rows = [
    ["Price at download", "Free", "Free trial, then often paid"],
    ["Sign-up required", "No for download-only use", "Usually required"],
    ["Watermark", "Optional credit, removable", "Often on free tier"],
    ["GCC details block", "Included as optional fields", "Often missing"],
    ["Visa-status guidance", "Available in tips and articles", "Usually generic"],
    ["Job-title corrections", "AI writing help in the builder", "Not always included"],
    ["ATS checker", "Live CV strength and ATS guidance", "Varies by product"],
    ["Works offline after load", "Local draft mode available in browser", "Usually cloud-only"],
  ];
  return `<section class="section"><div class="wrap"><h2>How BuildMyCVNow compares</h2><div class="card"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:10px">Feature</th><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:10px">BuildMyCVNow</th><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:10px">Typical CV builders</th></tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="border-bottom:1px solid #e2e8f0;padding:10px">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="muted">Comparison based on common practices of popular CV builders as of ${new Date().getFullYear()}.</p></div></div></section>`;
}

function ofwHomeSection() {
  return `<section class="section"><div class="wrap"><h2>Para sa mga kababayan - built with OFWs in mind</h2><p class="lead">Libre talaga. Walang hidden fees, walang sign-up.</p><p>The Filipino community is a major part of the Gulf workforce, and many applicants are building a CV for overseas work for the first time. BuildMyCVNow gives simple guidance for first-time OFW applicants and reminds job seekers to be careful with job-offer scams: legit employers never ask you to pay for a job offer.</p><div class="grid grid-3"><a class="card" data-ofw-link="no-experience" href="/blog/cv-no-experience-dubai"><h3>CV for first-timers</h3><p>No experience yet? Learn what to write first.</p></a><a class="card" data-ofw-link="scam-warning" href="/for-ofw#scam-warning"><h3>Job scam warning signs</h3><p>Check red flags before trusting an offer.</p></a><a class="card" data-ofw-link="ofw-roles" href="/for-ofw#ofw-roles"><h3>CV examples for OFW roles</h3><p>Hospitality, retail, healthcare, driver, and household roles.</p></a></div></div></section>`;
}

function templatesPreview() {
  return `<section class="section"><div class="wrap"><h2>CV templates for every industry</h2><div class="grid grid-4">${["Hospitality", "Engineering", "Finance", "Logistics"].map((item) => `<a class="card" href="/templates"><h3>${item}</h3><p class="muted">ATS-friendly format with role-specific guidance.</p></a>`).join("")}</div></div></section>`;
}

function faqSection() {
  return `<section class="section faq"><div class="wrap"><h2>Frequently asked questions</h2>${homepageFaqs.map((faq) => `<details><summary>${escapeHtml(faq.question)}</summary><p>${escapeHtml(faq.answer)}</p></details>`).join("")}</div></section>`;
}

writePage("/templates", layout({ title: "CV Templates for Global and Gulf Jobs | BuildMyCVNow", description: "Browse free ATS-friendly CV templates for hospitality, finance, engineering, logistics, sales, admin and skilled worker jobs.", canonical: `${baseUrl}/templates`, body: `<main class="section"><div class="wrap"><h1>CV templates for global and Gulf jobs</h1><p class="lead">Choose a template built for your industry, then customize it in the free builder. Each template keeps the layout simple, readable, and friendly for ATS screening.</p><p>Use these templates for local jobs, overseas applications, remote work, and Gulf-market applications where employers may ask for details such as visa status, languages, nationality, driving license, or availability. You can switch templates without losing your current CV data.</p><div class="grid grid-4">${seoJobs.slice(0, 16).map((job) => `<a class="card" href="/cv/${job.slug}-dubai"><h3>${job.title}</h3><p>${job.skills.slice(0, 5).join(", ")}</p><p class="muted">Includes role-specific wording ideas, skills, example duties, and salary guidance where available.</p></a>`).join("")}</div></div></main>` }));
writePage("/about", layout({ title: "About BuildMyCVNow | Free Global CV Builder", description: "BuildMyCVNow helps job seekers worldwide create professional CVs for free.", canonical: `${baseUrl}/about`, body: `<main class="section"><div class="wrap"><h1>About BuildMyCVNow</h1><p class="lead">BuildMyCVNow was created to help job seekers build better CVs without paying before download.</p><p>We support applicants worldwide, including people applying locally, overseas, remotely, or across competitive international job markets. The mission is simple: make professional CV creation easy, mobile-friendly, and free.</p></div></main>` }));
const ofwFaqs = [
  ["Is this really free?", "Yes. You can create, preview, and download your CV for free. No credit card is required."],
  ["Can I use my phone?", "Yes. The builder is mobile-friendly, with large fields, live preview, and PDF download support."],
  ["Do I need a UAE number on my CV?", "A UAE number helps if you are already in the UAE, but you can also use your current country code until you arrive."],
  ["Should I include my passport number?", "No. Do not put your passport number on a public CV. Share sensitive documents only with trusted employers or licensed agencies."],
  ["Can I make a CV before arriving in the UAE?", "Yes. You can prepare your CV before arrival and update your location, visa status, and phone number later."],
];
const ofwSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: ofwFaqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
writePage("/for-ofw", layout({
  title: "Free CV Builder for OFWs in UAE & the Gulf | BuildMyCVNow",
  description: "Free, ATS-friendly CV builder made for Filipino workers applying to jobs in the UAE and Gulf. No sign-up, no fees, mobile-friendly. Tips for visa status, photos and more.",
  canonical: `${baseUrl}/for-ofw`,
  image: `${baseUrl}/assets/og/for-ofw.jpg`,
  jsonLd: ofwSchema,
  body: `<main><section class="hero"><div class="wrap"><h1>Free CV Builder for OFWs - UAE, Saudi, Qatar & beyond</h1><p class="lead">Para sa mga kababayan. Build a clean, professional CV before applying for overseas work. BuildMyCVNow is free, mobile-friendly, and made to help you explain your real experience clearly.</p><p><a class="cta" href="/builder">Build my CV free</a></p></div></section><section class="section"><div class="wrap"><h2>What Gulf recruiters look for in an OFW CV</h2><div class="grid grid-3"><div class="card"><h3>Clear visa status</h3><p>Use simple phrases such as Visit visa - available immediately, Residence visa - transferable, or Outside UAE - ready to relocate.</p></div><div class="card"><h3>Professional photo norms</h3><p>A neat head-and-shoulders photo is common for hospitality, retail, customer service, and household roles.</p></div><div class="card"><h3>Languages as an asset</h3><p>List English, Tagalog, Arabic, Hindi, or other languages you can use at work, with honest levels.</p></div><div class="card"><h3>Attested documents</h3><p>If true, mention attested certificates, training, licenses, or eligibility documents in certifications.</p></div><div class="card"><h3>Country-code contact number</h3><p>Write your phone with country code, such as +63 or +971, so recruiters can contact you correctly.</p></div></div></div></section><section id="ofw-roles" class="section"><div class="wrap"><h2>In-demand OFW CV examples</h2><div class="grid grid-4">${[
    ["housekeeping-attendant", "Housekeeping"],
    ["waiter", "Waiter / Waitress"],
    ["barista", "Barista"],
    ["cashier", "Cashier"],
    ["retail-sales-associate", "Retail Sales"],
    ["nurse", "Nurse"],
    ["security-guard", "Security Guard"],
    ["driver-light-vehicle", "Driver"],
    ["beautician", "Beautician"],
    ["office-administrator", "Office Assistant"],
  ].map(([slug, label]) => `<a class="card" href="/cv/${slug}-dubai"><h3>${label}</h3><p>Open the free CV example and customize it in the builder.</p></a>`).join("")}</div></div></section><section id="scam-warning" class="section"><div class="wrap"><div class="card" style="border-color:#fca5a5;background:#fff7ed"><h2>Job scam warning signs</h2><p><strong>Legit employers never ask you to pay for a job offer.</strong></p><ul><li>They ask for payment before interview, offer letter, or visa processing.</li><li>They refuse to give company details, license information, or a verifiable email address.</li><li>They pressure you to send passport copies or money urgently through personal accounts.</li></ul></div></div></section><section class="section faq"><div class="wrap"><h2>OFW CV questions</h2>${ofwFaqs.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div></section><section class="section cta-band"><div class="wrap"><h2>Start your free OFW CV now</h2><p>No hidden fees. No sign-up required for download.</p><a class="cta" href="/builder">Build my CV</a></div></section></main>`,
}));
writePage("/privacy", layout({ title: "Privacy Policy | BuildMyCVNow", description: "Read how BuildMyCVNow handles CV data, analytics, email subscribers, Supabase storage and user deletion requests.", canonical: `${baseUrl}/privacy`, body: `<main class="section"><div class="wrap"><h1>Privacy Policy</h1><p>We collect only the details you enter to create your CV, such as name, email, phone, work history, skills and optional photo. Download-only mode keeps your CV local in your browser.</p><h2>Analytics and email</h2><p>We use privacy-respecting analytics to understand visits and downloads. If you subscribe for the UAE Job Hunt Checklist, your email is stored in Supabase so we can send useful CV and job-search tips. You can request deletion by contacting us.</p><h2>Advertising</h2><p>Google AdSense may use cookies or similar technologies when ads are enabled.</p></div></main>` }));
writePage("/terms", layout({ title: "Terms of Use | BuildMyCVNow", description: "Read the terms for using BuildMyCVNow, including user responsibilities, CV ownership and employment disclaimer.", canonical: `${baseUrl}/terms`, body: `<main class="section"><div class="wrap"><h1>Terms of Use</h1><p>You own the CV content you enter. You are responsible for ensuring all information is true and accurate.</p><p>BuildMyCVNow helps with formatting and writing support, but it does not guarantee interviews, job offers, visa approval, or employment.</p></div></main>` }));
writePage("/faq", layout({ title: "FAQ | Free Global CV Builder", description: "Answers to common questions about free CV downloads, ATS-friendly CVs, CV photos, local requirements and mobile CV building.", canonical: `${baseUrl}/faq`, jsonLd: faqSchema, body: `<main><section class="section faq"><div class="wrap"><h1>BuildMyCVNow FAQ</h1><p class="lead">Answers to common questions about free CV downloads, ATS-friendly formatting, optional regional details, mobile use, cover letters, and data privacy.</p>${homepageFaqs.map((faq) => `<details><summary>${escapeHtml(faq.question)}</summary><p>${escapeHtml(faq.answer)}</p></details>`).join("")}</div></section></main>` }));

const launchCombos = [];
for (const job of seoJobs) {
  launchCombos.push([job, cities.find((city) => city.slug === "dubai")]);
  launchCombos.push([job, cities.find((city) => city.slug === "uae")]);
  if (topCityJobSlugs.includes(job.slug)) {
    cities.filter((city) => !["dubai", "uae"].includes(city.slug)).forEach((city) => launchCombos.push([job, city]));
  }
}

const jobsByIndustry = seoJobs.reduce((groups, job) => {
  if (!groups[job.industry]) groups[job.industry] = [];
  groups[job.industry].push(job);
  return groups;
}, {});

writePage("/cv-examples", layout({ title: "CV Examples for UAE Jobs | BuildMyCVNow", description: "Browse free CV examples for Dubai, Abu Dhabi, Sharjah, UAE, Riyadh and Doha job applications.", canonical: `${baseUrl}/cv-examples`, body: `<main class="section"><div class="wrap"><h1>CV examples for UAE and Gulf jobs</h1><p class="lead">Choose your job title and city to see a tailored CV example, skills list, salary guide and free template.</p>${Object.entries(jobsByIndustry).map(([industry, jobs]) => `<h2>${industry.replace("-", " ")}</h2><div class="grid grid-4">${jobs.map((job) => `<a class="card" href="/cv/${job.slug}-dubai"><h3>${job.title}</h3><p>${job.salaryRange}</p></a>`).join("")}</div>`).join("")}</div></main>` }));

for (const [job, city] of launchCombos) writeCvPage(job, city);

function writeCvPage(job, city) {
  const year = new Date().getFullYear();
  const url = `/cv/${job.slug}-${city.slug}`;
  const related = seoJobs.filter((item) => item.industry === job.industry && item.slug !== job.slug).slice(0, 6);
  const faqs = [
    [`What should a ${job.title} CV include?`, `A ${job.title} CV should include a clear summary, work experience, skills such as ${job.skills.slice(0, 3).join(", ")}, education, certifications, languages, and contact details with country code.`],
    [`How long should a ${job.title} CV be?`, `Most ${job.title} CVs for ${city.name} should be one to two pages. Keep it focused on relevant duties, achievements, tools, and measurable results.`],
    [`Do I need a photo on my CV in ${city.name}?`, `A professional photo is common for many UAE and Gulf roles, especially customer-facing work. For ATS-heavy corporate roles it is optional, but the rest of the CV must be readable text.`],
  ];
  const schema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  writePage(url, layout({
    title: `${job.title} CV Example ${city.name} ${year} â€” Free Template`,
    description: `Free ${job.title} CV example for ${city.name}. Includes ${job.skills[0]} and ${job.skills[1]} skills, salary guide, bullets and ATS-friendly template.`,
    canonical: `${baseUrl}${url}`,
    image: `${baseUrl}/assets/og/cv-${job.slug}.jpg`,
    jsonLd: [schema, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: baseUrl }, { "@type": "ListItem", position: 2, name: "CV Examples", item: `${baseUrl}/cv-examples` }, { "@type": "ListItem", position: 3, name: `${job.title} CV ${city.name}`, item: `${baseUrl}${url}` }] }],
    body: `<main class="section"><div class="wrap"><h1>${job.title} CV Example for ${city.name} Jobs (${year} Guide)</h1><p class="lead">${job.intro.replace("Gulf", `${city.name} and Gulf`)}</p>${ctaCard(`Build your ${job.title} CV free in 5 minutes`)}<h2>Example CV summary for a ${job.title}</h2><div class="cv-snippet">${job.sampleSummary}</div><h2>Key skills for ${job.title} jobs in ${city.name}</h2><div class="chips">${job.skills.map((skill) => `<span class="chip">${skill}</span>`).join("")}</div><h2>What to include</h2><ul>${job.duties.map((duty) => `<li>${duty}</li>`).join("")}</ul><h2>Example achievement bullets</h2><ul>${job.sampleBullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul><h2>${job.title} salary in ${city.name}</h2><p>Typical monthly salary range: <strong>${job.salaryRange}</strong>. Salaries vary by company, experience, language ability, certifications, commission, accommodation, transport, and visa package.</p><h2>CV tips for ${job.title} applications</h2><ul>${job.tips.map((tip) => `<li>${tip}</li>`).join("")}</ul><h2>FAQ</h2>${faqs.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}<h2>Related roles</h2><p>${related.map((item) => `<a href="/cv/${item.slug}-${city.slug}">${item.title}</a>`).join(" Â· ")} Â· <a href="/blog">Career tips blog</a></p><section class="cta-band card"><h2>Build your ${job.title} CV now</h2><a class="cta" href="/builder?role=${job.slug}&city=${city.slug}">Use this free template</a></section></div></main>`,
  }));
}

const articles = fs.readdirSync(blogDir).filter((file) => file.endsWith(".md")).map((file) => {
  const parsed = parseFrontmatter(fs.readFileSync(path.join(blogDir, file), "utf8"));
  const rendered = renderMarkdown(parsed.body);
  return { ...parsed.data, body: parsed.body, html: rendered.html, toc: rendered.toc };
});

writePage("/blog", layout({ title: "CV Writing and Career Tips Blog | BuildMyCVNow", description: "Read practical CV writing and job search tips about ATS, visa status, CV photos, no-experience CVs and international job preparation.", canonical: `${baseUrl}/blog`, body: `<main class="section"><div class="wrap"><h1>CV writing and career tips</h1><p class="lead">Read practical guides for writing a stronger CV, preparing for job applications, avoiding common mistakes, and tailoring your profile for local, remote, overseas, and Gulf-market roles.</p><p>These articles are written for first-time CV creators, fresh graduates, hospitality workers, skilled workers, drivers, finance assistants, IT applicants, domestic workers, OFWs, and job seekers who want simple language instead of confusing career jargon.</p><div class="grid grid-3">${articles.map((article) => `<a class="card" href="/blog/${article.slug}"><h2>${article.title}</h2><p>${article.description}</p><p class="muted">${article.date}</p></a>`).join("")}</div></div></main>` }));

for (const article of articles) {
  const relatedRoles = (article.relatedRoles || []).slice(0, 3);
  const articleSchema = { "@context": "https://schema.org", "@type": "Article", headline: article.title, datePublished: article.date, dateModified: article.updated, author: { "@type": "Organization", name: "BuildMyCVNow Team" } };
  writePage(`/blog/${article.slug}`, layout({ title: `${article.title} | BuildMyCVNow`, description: article.description, canonical: `${baseUrl}/blog/${article.slug}`, type: "article", image: `${baseUrl}/assets/og/blog-${article.slug}.jpg`, jsonLd: articleSchema, body: `<main class="section"><article class="article"><p class="muted">BuildMyCVNow Team Â· Published ${article.date} Â· Updated ${article.updated}</p>${article.toc.length ? `<nav class="toc"><strong>In this article</strong>${article.toc.map((item) => `<p><a href="#${item.id}">${item.text}</a></p>`).join("")}</nav>` : ""}${article.html}${ctaCard()}<h2>Related CV examples</h2><p>${relatedRoles.map((role) => `<a href="/cv/${role}-dubai">${role.replaceAll("-", " ")}</a>`).join(" Â· ")}</p></article></main>` }));
}

const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>BuildMyCVNow Blog</title><link>${baseUrl}/blog</link><description>UAE CV and job search tips</description>${articles.map((article) => `<item><title>${escapeHtml(article.title)}</title><link>${baseUrl}/blog/${article.slug}</link><description>${escapeHtml(article.description)}</description><pubDate>${new Date(article.date).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`;
ensureDir(path.join(dist, "blog"));
fs.writeFileSync(path.join(dist, "blog", "rss.xml"), rss);

writePage("/404", layout({ title: "Page Not Found | BuildMyCVNow", description: "This BuildMyCVNow page was not found. Go back to the free CV builder or browse CV examples.", canonical: `${baseUrl}/404`, body: `<main class="section"><div class="wrap"><h1>Page not found</h1><p>The page may have moved. You can go back to the homepage, browse CV examples, or build your CV now.</p><p><a class="cta" href="/builder">Build My CV Now</a></p></div></main>` }));

fs.writeFileSync(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /builder\nSitemap: ${baseUrl}/sitemap.xml\n`);
const sitemapRoutes = [...routes].filter((route) => route !== "/404").sort();
fs.writeFileSync(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapRoutes.map((route) => `  <url><loc>${baseUrl}${route === "/" ? "" : route}</loc><lastmod>${buildDate}</lastmod></url>`).join("\n")}\n</urlset>\n`);

fs.writeFileSync(path.join(root, "SEO-CHECKLIST.md"), `# SEO Checklist\n\n- Run: curl https://buildmycvnow.com | grep '<h1'\n- Confirm view-source shows homepage content with JavaScript disabled.\n- Open https://buildmycvnow.com/sitemap.xml and validate XML.\n- Open https://buildmycvnow.com/robots.txt and confirm /builder is disallowed.\n- Register Google Search Console domain property via DNS TXT.\n- Submit sitemap: https://buildmycvnow.com/sitemap.xml\n- Request indexing for /, /templates, /cv-examples, and top /cv/ pages.\n- Repeat in Bing Webmaster Tools.\n`);

console.log(`Generated ${sitemapRoutes.length} SEO routes.`);

