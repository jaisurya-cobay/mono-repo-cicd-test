// Writes one environment's config.json from the WEB_CONFIG_JSON variable and checks it against the
// app's config.schema.json (required keys + types). Never put private secrets here: it is public.
// Usage: node web-config.mjs <out>. Env: WEB_CONFIG_JSON, SCHEMA, VERSION_SHA.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const out = process.argv[2];
let config;
try {
  config = JSON.parse(process.env.WEB_CONFIG_JSON || "{}");
} catch {
  console.log("::error::WEB_CONFIG_JSON on this environment is not valid JSON");
  process.exit(1);
}
const schema = existsSync(process.env.SCHEMA ?? "") ? JSON.parse(readFileSync(process.env.SCHEMA, "utf8")) : {};
const problems = Object.entries(schema)
  .filter(([k, type]) => typeof config[k] !== type)
  .map(([k, type]) => `${k} must be a ${type} (got ${config[k] === undefined ? "nothing" : typeof config[k]})`);
if (problems.length) {
  for (const p of problems) console.log(`::error title=config.json::${p}. Set it in this environment's WEB_CONFIG_JSON variable.`);
  process.exit(1);
}
writeFileSync(out, JSON.stringify({ ...config, version: process.env.VERSION_SHA ?? "" }, null, 2) + "\n");
console.log(`wrote ${out} with ${Object.keys(config).length} key(s)`);
