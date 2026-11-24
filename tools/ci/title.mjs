// PR-title check. Env: PR_TITLE, LANE. Scopes come from the Nx project list, so a new app needs no edit here.
import { checkTitle } from "./conventions.mjs";
import { sh, summary } from "./lib.mjs";

const title = process.env.PR_TITLE ?? "";
const lane = process.env.LANE ?? "fast";
const scopes = JSON.parse(sh("pnpm exec nx show projects --json")).map((n) => n.replace(/^@[^/]+\//, ""));
const errors = checkTitle(title, { lane, scopes });

summary([`### PR title: ${errors.length ? "❌" : "✅"} \`${title}\``, "", ...errors.map((e) => `- ${e}`)].join("\n"));
for (const e of errors) console.log(`::error title=PR title::${e}`);
process.exit(errors.length ? 1 : 0);
