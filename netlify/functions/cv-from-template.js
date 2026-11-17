export { prepareTemplateDraft as default } from "./cv-templates.js";

export const config = {
  path: "/api/cvs/from-template",
  rateLimit: { action: "rate_limit", windowLimit: 20, windowSize: 180, aggregateBy: ["ip"] },
};
