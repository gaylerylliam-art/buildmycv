import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blogArticles } from "../src/data/blogArticles.js";
import { seoJobs } from "../src/content/programmaticSeo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const blogDir = path.join(root, "content", "blog");
const source = path.join(dist, "assets", "og-image.jpg");
const targetDir = path.join(dist, "assets", "og");

if (!fs.existsSync(source)) {
  throw new Error("Missing default OG image at dist/assets/og-image.jpg. Add public/assets/og-image.jpg before building.");
}

fs.mkdirSync(targetDir, { recursive: true });

const copyOg = (filename) => {
  fs.copyFileSync(source, path.join(targetDir, filename));
};

for (const job of seoJobs) copyOg(`cv-${job.slug}.jpg`);
const markdownBlogSlugs = fs.existsSync(blogDir)
  ? fs.readdirSync(blogDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => fs.readFileSync(path.join(blogDir, file), "utf8").match(/^slug:\s*(.+)$/m)?.[1]?.trim())
      .filter(Boolean)
  : [];

for (const slug of new Set([...blogArticles.map((article) => article.slug), ...markdownBlogSlugs])) {
  copyOg(`blog-${slug}.jpg`);
}
copyOg("for-ofw.jpg");

console.log(`Generated OG image assets for ${seoJobs.length} jobs, ${new Set([...blogArticles.map((article) => article.slug), ...markdownBlogSlugs]).size} blog posts, and /for-ofw.`);
