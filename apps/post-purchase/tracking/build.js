// Stand-in for `vite build --mode <MODE>`: env-specific values are baked into the output,
// which is why static apps are rebuilt per environment.
import { mkdirSync, writeFileSync } from "node:fs";
import { title, apiPath } from "./src/main.js";

const mode = process.env.MODE ?? "development";
const sha = process.env.GIT_SHA ?? "dev";
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", `<!doctype html><title>${title}</title><p>${title} · ${mode} · api ${apiPath}</p>\n`);
writeFileSync("dist/version.json", JSON.stringify({ mode, sha }) + "\n");
console.log(`built ${title} for ${mode} @ ${sha}`);
