// Jira + Slack after a deploy. Never blocks a deploy (the job is continue-on-error).
// Lab: prints exactly what would be sent. Suite: the same list feeds the live jira-sync action
// (status per environment, fixVersion stamping, version create/rename/release) and the Slack card.
// Env: STAGE, RESULT (success|failure), BEFORE (previous branch tip), GITHUB_SHA.
import { sh, summary } from "./lib.mjs";

const STATUS = { qa: "QA Env", staging: "Staging", production: "Done" };
const stage = process.env.STAGE;
const before = /^0+$/.test(process.env.BEFORE ?? "") || !process.env.BEFORE ? null : process.env.BEFORE;
const range = before ? `${before}..${process.env.GITHUB_SHA}` : `-1 ${process.env.GITHUB_SHA}`;

// Default merge-commit message: subject "Merge pull request #N from …", body = PR title.
// A revert PR moves its ticket BACK one status instead of forward.
const keys = new Set();
const reverted = new Set();
for (const block of sh(`git log --merges --format=%b%x1e ${range}`).split("\x1e")) {
  const target = /^\s*(Revert "|revert[:(])/.test(block) ? reverted : keys;
  for (const k of block.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []) target.add(k);
}
for (const k of reverted) keys.delete(k);

const lines = [`### Notify (${process.env.RESULT}) → ${stage}`];
if (process.env.RESULT === "success") {
  lines.push(`- Jira: ${[...keys].join(", ") || "no ticket keys"} → **${STATUS[stage]}**`);
  if (reverted.size) lines.push(`- Jira: ${[...reverted].join(", ")} reverted → moved **back one status**, fixVersion removed`);
  if (stage !== "qa") lines.push(`- Slack: ${stage} card with ${keys.size} ticket(s)`);
} else {
  lines.push("- Jira: unchanged", "- Slack: failure alert to the PR author");
}
summary(lines.join("\n"));
