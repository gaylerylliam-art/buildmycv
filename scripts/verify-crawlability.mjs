import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const baseUrl = "https://buildmycvnow.com";
const criticalRoutes = ["/", "/templates", "/faq", "/blog", "/cv-examples", "/for-ofw"];
const failures = [];

const stripTags = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const routeFile = (route) => path.join(dist, route === "/" ? "index.html" : route.replace(/^\//, ""), route === "/" ? "" : "index.html");
const readBuiltHtml = (route) => fs.existsSync(routeFile(route)) ? fs.readFileSync(routeFile(route), "utf8") : "";
const attr = (html, pattern) => html.match(pattern)?.[1]?.trim() || "";
const canonicalFor = (route) => `${baseUrl.replace(/\/$/, "")}${route === "/" ? "" : route}`;

const titles = new Map();
for (const route of criticalRoutes) {
  const html = readBuiltHtml(route);
  if (!html) {
    failures.push(`${route}: missing built HTML`);
    continue;
  }
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (h1Matches.length !== 1) failures.push(`${route}: expected exactly one h1, found ${h1Matches.length}`);
  const h1Text = stripTags(h1Matches[0]?.[1] || "");
  if (!h1Text) failures.push(`${route}: h1 is empty`);
  const visibleLength = stripTags(html).length;
  if (visibleLength < 1500) failures.push(`${route}: visible text length ${visibleLength} is below 1500 characters`);
  const title = attr(html, /<title>([\s\S]*?)<\/title>/i);
  if (!title) failures.push(`${route}: missing title`);
  if (titles.has(title)) failures.push(`${route}: duplicate title also used by ${titles.get(title)}`);
  titles.set(title, route);
  const canonical = attr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  if (!canonical) failures.push(`${route}: missing canonical link`);
  if (canonical && canonical !== canonicalFor(route)) failures.push(`${route}: canonical ${canonical} does not match ${canonicalFor(route)}`);
}

const builder = readBuiltHtml("/builder");
if (!builder) {
  failures.push("/builder: missing SPA shell");
} else {
  const builderTextLength = stripTags(builder).length;
  if (builderTextLength > 1200 || /Live CV preview|Free CV Builder for Job Seekers Worldwide/i.test(builder)) {
    failures.push("/builder: appears prerendered with content; it should remain the SPA app shell");
  }
}

if (failures.length) {
  console.error("Crawlability verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Crawlability verification passed for ${criticalRoutes.length} static routes and /builder.`);
