// Gate for promotions (qa → staging, staging → master) and the Release preflight.
// 1. Every promoted app already runs this exact code green in the lower environment.
// 2. No hotfix on master is missing from the branch being promoted (back-merge not merged yet).
// Env: LOWER_ENV (qa|staging), BASE_SHA (target branch tip), HEAD_SHA (PR head). Needs origin/master.
import { deployables, affected, lastSuccess, recordEnv, sh, summary } from "./lib.mjs";

const env = process.env.LOWER_ENV;
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;

const promoted = affected(base, head);
if (promoted === null) throw new Error(`cannot compare ${base}..${head}`);

let failed = false;
const rows = [];
for (const app of deployables()) {
  if (!promoted.has(app.name)) {
    rows.push(`| ${app.slug} | not in this promotion | ✅ |`);
    continue;
  }
  const last = lastSuccess(recordEnv(app.slug, env), app.slug);
  const drift = last && affected(last.sha, head);
  if (!last) {
    failed = true;
    rows.push(`| ${app.slug} | never deployed to ${env} | ❌ |`);
  } else if (drift === null || drift.has(app.name)) {
    failed = true;
    rows.push(`| ${app.slug} | ${env} runs ${last.sha.slice(0, 7)}; code changed since | ❌ |`);
  } else {
    rows.push(`| ${app.slug} | ${env} runs the same code (${last.sha.slice(0, 7)}) | ✅ |`);
  }
}

const missingHotfix = sh(`git log --no-merges --format="%h %s" ${head}..origin/master`).split("\n").filter(Boolean);
if (missingHotfix.length) {
  failed = true;
  rows.push(`| hotfix | master has ${missingHotfix.length} commit(s) this branch lacks: merge the back-merge PR first | ❌ |`);
}

summary([`### Gate: ${env} must already run what is being promoted`, "", "| App | Status | |", "|---|---|---|", ...rows,
  ...(missingHotfix.length ? ["", "Missing from this branch:", ...missingHotfix.map((c) => `- ${c}`)] : [])].join("\n"));
if (failed) {
  console.log(`::error title=Gate::Promotion blocked. See the run summary for the app or hotfix that is not ready.`);
  process.exit(1);
}
