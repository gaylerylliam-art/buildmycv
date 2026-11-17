import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import templateCatalog, { prepareTemplateDraft } from "./netlify/functions/cv-templates.js";

function localTemplateApi() {
  const mount = (server) => { server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    const sample = path.match(/^\/api\/templates\/([a-z-]+)\/sample$/);
    if (path !== "/api/templates" && path !== "/api/cvs/from-template" && !sample) return next();
    try {
      let body = "";
      if (req.method === "POST") {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 2048) { res.writeHead(413).end(); return; }
        }
      }
      const request = new Request(url, { method: req.method, body: req.method === "POST" ? body : undefined });
      const result = path === "/api/cvs/from-template" ? await prepareTemplateDraft(request)
        : templateCatalog(request, { params: { id: sample?.[1] } });
      res.writeHead(result.status, Object.fromEntries(result.headers)).end(await result.text());
    } catch { res.writeHead(500).end(); }
  }); };
  return { name: "local-template-api", configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig({
  plugins: [react(), localTemplateApi()],
  server: { watch: { ignored: ["**/artifacts/**"] }, proxy: { "/.netlify/functions/cvImport": "http://127.0.0.1:8889" } },
  envPrefix: ["VITE_", "REACT_APP_"],
});
