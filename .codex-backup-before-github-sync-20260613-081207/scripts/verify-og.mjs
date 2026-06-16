import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const baseUrl = "https://buildmycvnow.com";
const failures = [];

const htmlFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    if (entry.isFile() && entry.name === "index.html") htmlFiles.push(full);
  }
};
walk(dist);

const routeForFile = (file) => {
  const rel = path.relative(dist, path.dirname(file)).replaceAll(path.sep, "/");
  return rel === "" ? "/" : `/${rel}`;
};

const getMeta = (html, property) => {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"))?.[1]?.trim() || "";
};

const getCanonicalCount = (html) => [...html.matchAll(/<link[^>]+rel=["']canonical["'][^>]*>/gi)].length;

for (const file of htmlFiles) {
  const route = routeForFile(file);
  if (route === "/builder") continue;
  const html = fs.readFileSync(file, "utf8");
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
  const ogTitle = getMeta(html, "og:title");
  const ogDescription = getMeta(html, "og:description");
  const ogImage = getMeta(html, "og:image");
  const twitterImage = getMeta(html, "twitter:image");

  if (!ogTitle) failures.push(`${route}: missing og:title`);
  if (!ogDescription) failures.push(`${route}: missing og:description`);
  if (!ogImage) failures.push(`${route}: missing og:image`);
  if (ogImage && !ogImage.startsWith("https://")) failures.push(`${route}: og:image must be absolute https URL`);
  if (twitterImage && !twitterImage.startsWith("https://")) failures.push(`${route}: twitter:image must be absolute https URL`);
  if (title && ogTitle && !title.startsWith(ogTitle.replace(/ \| BuildMyCVNow$/, ""))) failures.push(`${route}: og:title does not match title leading phrase`);
  if (getCanonicalCount(html) !== 1) failures.push(`${route}: expected exactly one canonical link`);
  if (/^\/cv\//.test(route) && /Free CV Builder for Global Jobs/i.test(ogTitle)) failures.push(`${route}: cv page og:title is default`);
  if (/^\/blog\//.test(route) && /Free CV Builder for Global Jobs/i.test(ogTitle)) failures.push(`${route}: blog page og:title is default`);
  if (ogImage?.startsWith(baseUrl)) {
    const localPath = path.join(dist, ogImage.slice(baseUrl.length).replace(/^\//, ""));
    if (!fs.existsSync(localPath)) {
      failures.push(`${route}: og:image file missing in build output: ${ogImage}`);
    } else if (fs.statSync(localPath).size > 300_000) {
      failures.push(`${route}: og:image exceeds 300KB: ${ogImage}`);
    }
  }
}

if (failures.length) {
  console.error("OG verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

fs.writeFileSync(path.join(root, "OG-CHECKLIST.md"), `# OG Checklist

- Paste https://buildmycvnow.com/?v=2 into a WhatsApp chat with yourself. Confirm preview image, title, and description.
- Open Facebook Sharing Debugger, enter https://buildmycvnow.com/, then click Scrape Again after deploys.
- Open LinkedIn Post Inspector and test https://buildmycvnow.com/ plus one /cv/ page.
- Test one job page such as https://buildmycvnow.com/cv/waiter-dubai?v=2.
- Test one blog page such as https://buildmycvnow.com/blog/cv-format-uae-jobs-2026?v=2.
- WhatsApp caches aggressively for around seven days, so append ?v=2 when checking a fresh preview.
`);

console.log(`OG verification passed for ${htmlFiles.length - 1} static pages.`);
