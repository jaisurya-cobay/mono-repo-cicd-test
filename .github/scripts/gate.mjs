// Staging gate for promotion PRs. Every deployable that differs between the target branch and
// the PR head must already be running in the lower environment with the same content.
// Env: LOWER_ENV (QA|staging), BASE_SHA (target branch tip), HEAD_SHA (PR head).
import { deployables, affected, lastSuccess, summary } from "./lib.mjs";

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
  const last = lastSuccess(env, app.slug);
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

summary([`### Staging gate: ${env} must already run what is being promoted`, "", "| App | Status | |", "|---|---|---|", ...rows].join("\n"));
if (failed) {
  console.log(`::error::Some promoted apps are not verified in ${env}. Deploy them there first.`);
  process.exit(1);
}
