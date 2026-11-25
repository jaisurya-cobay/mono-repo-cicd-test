// Stand-in for `vite build`. Built ONCE; nothing environment-specific is baked in.
// Each deploy uploads these same files plus that environment's config.json (see _deploy-web.yml).
import { mkdirSync, writeFileSync } from "node:fs";
import { title, apiPath } from "./src/main.js";

mkdirSync("dist/assets", { recursive: true });
writeFileSync("dist/assets/app.js", `fetch("/config.json").then((r) => r.json()).then((c) => (document.body.dataset.api = c.apiBaseUrl + "${apiPath}"));\n`);
writeFileSync("dist/index.html", `<!doctype html><title>${title}</title><script src="/assets/app.js" defer></script><p>${title}</p>\n`);
console.log(`built ${title}`);
