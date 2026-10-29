import { blogArticles } from "../data/blogArticles.js";
import { parseBlogFrontmatter } from "../lib/blogFrontmatter.js";

export const blogTopics = [
  { id: "all", label: "All guides" },
  { id: "writing", label: "CV writing" },
  { id: "ats", label: "ATS & AI" },
  { id: "search", label: "Job search" },
  { id: "industry", label: "By industry" },
  { id: "gulf", label: "UAE & GCC" },
];
const photos = {
  dubai: { src: "/assets/blog/dubai.jpg", alt: "Dubai skyline and waterfront" },
  documents: { src: "/assets/blog/documents.jpg", alt: "Professional reviewing documents at a desk" },
  workspace: { src: "/assets/blog/workspace.jpg", alt: "Bright modern workplace with shared desks" },
  team: { src: "/assets/blog/team.jpg", alt: "Colleagues working together around a table" },
  search: { src: "/assets/blog/job-search.jpg", alt: "Job seeker working on a laptop" },
};
function decorate(article) {
  const subject = `${article.category} ${article.slug}`;
  const topic = /ats|ai-|artificial/i.test(subject) ? "ats"
    : /job-search|interview|salary|how-to-get|apply|recruit/i.test(subject) ? "search"
    : /hospitality|engineering|finance|logistic|driver|nanny|housemaid|skilled|worker|teacher|electrician|accountant/i.test(subject) ? "industry"
    : /uae|gcc|dubai|ofw|visa/i.test(subject) ? "gulf" : "writing";
  const label = blogTopics.find(item => item.id === topic).label;
  const media = article.slug === "cv-format-uae-jobs-2026" ? photos.dubai
    : topic === "ats" || topic === "writing" ? photos.documents
    : topic === "search" ? photos.search : topic === "industry" ? photos.team : photos.workspace;
  return { ...article, topic, label, media };
}
const markdown = Object.values(import.meta.glob("../../content/blog/*.md", { eager: true, query: "?raw", import: "default" })).map(raw => {
  const { data, body } = parseBlogFrontmatter(raw);
  return { ...data, excerpt: data.description, readTime: `${Math.max(1, Math.ceil(body.split(/\s+/).length / 200))} min read` };
});
const bySlug = new Map([...blogArticles, ...markdown].map(article => [article.slug, decorate(article)]));
export const blogCatalog = [...bySlug.values()].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
export const formatBlogDate = date => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
