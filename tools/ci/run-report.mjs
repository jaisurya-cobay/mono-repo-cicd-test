// Run summary: one table at the top of every run saying what ran, what passed, and for each failure
// the failed step, the real error output, and what to do next. Runs last, on success and failure.
// Env: GH_TOKEN (actions: read), GITHUB_REPOSITORY, GITHUB_RUN_ID, TITLE (what this run is).
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const repo = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const gh = (path) => execSync(`gh api "${path}"`, { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] });
const self = process.env.GITHUB_JOB_NAME ?? "Run summary";

// What a failure in each kind of job means for the person reading it. Matched on the job name.
const NEXT = [
  [/^Route PR/, "This branch can't target this base. Features go into qa; staging takes only qa; master takes only staging and hotfix/*."],
  [/^Checks/, "Fix what the failed step reports and push to the PR. Nothing was merged or deployed."],
  [/^Lint workflow files/, "Fix the workflow file and line named in the error, then push."],
  [/^Promotion gate/, "An app isn't running this exact code one environment lower, or a back-merge is still open. Wait for that deploy / merge the back-merge, then re-run."],
  [/^Hotfix/, "Fix the hotfix PR and push. Nothing was released."],
  [/^Bot: merge back-merge/, "Check the back-merge PR and merge it by hand."],
  [/^Plan/, "Usually a GitHub API or git hiccup: re-run the failed job. Nothing was deployed."],
  [/^Full tests/, "The merged code fails tests. Fix it in a new PR or revert the PR. Nothing was deployed."],
  [/^Build (image|web)/, "Fix the build in a new PR. Nothing was deployed; users still get the previous version."],
  [/^Deploy/, "Users still get the previous version (the switch happens only after the health check). Fix and push; the next run retries this app."],
  [/^Version/, "Apps are already deployed; only the tag, GitHub Release or Release PR failed. Re-run this job."],
  [/^Re-check/, "Re-run the promotion PR's checks by hand."],
  [/^Notify/, "The deploy is fine; only Jira or Slack failed. Re-run this job to send the update."],
  [/^Release/, "The preflight message says what is missing. Nothing was merged."],
  [/^(Find|Roll back)/, "The rollback didn't happen; the current version is still running. Check the version name and that its image or build still exists."],
  [/^ci$/, "Look at the failed job above it."],
];
const nextStep = (job) => (NEXT.find(([re]) => re.test(job))?.[1] ?? "Open the job and read the failed step's log.");

const icon = (c) => ({ success: "✅", failure: "❌", cancelled: "🛑", skipped: "⏭️", timed_out: "⏱️" }[c] ?? "⏳");
const secs = (j) => (j.started_at && j.completed_at ? Math.max(0, (Date.parse(j.completed_at) - Date.parse(j.started_at)) / 1000) : null);
const fmt = (s) => (s === null ? "" : s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)}m`);

const jobs = JSON.parse(gh(`repos/${repo}/actions/runs/${runId}/jobs?per_page=100`)).jobs.filter((j) => j.name !== self);
const failed = jobs.filter((j) => ["failure", "timed_out", "cancelled"].includes(j.conclusion));

// The real error: the job's own error annotations, else the last log lines of the failed step.
function errorOf(job) {
  let notes = [];
  try {
    notes = JSON.parse(gh(`repos/${repo}/check-runs/${job.id}/annotations`))
      .filter((a) => a.annotation_level === "failure" && !/^Process completed with exit code/.test(a.message))
      .map((a) => a.message.trim());
  } catch {}
  if (notes.length) return notes.slice(0, 3).join(" · ");
  try {
    const log = gh(`repos/${repo}/actions/jobs/${job.id}/logs`).split("\n").map((l) => l.replace(/^\S+Z /, "").replace(/\x1b\[[0-9;]*m/g, ""));
    const end = log.findIndex((l) => l.startsWith("##[error]"));
    const lines = log.slice(Math.max(0, (end < 0 ? log.length : end) - 12), end < 0 ? log.length : end)
      .filter((l) => l.trim() && !l.startsWith("##[") && !/^\s*(shell|env):/.test(l));
    return lines.slice(-6).join(" ⏎ ") || "no error text in the log";
  } catch {
    return job.conclusion === "timed_out" ? "the job ran past its time limit and was stopped" : "log not available";
  }
}

const out = [];
const verdict = failed.length ? `❌ ${failed.length} job(s) failed` : jobs.some((j) => !j.conclusion) ? "⏳ still running" : "✅ everything passed";
out.push(`## ${process.env.TITLE ?? "Run"}: ${verdict}`, "");
out.push("| Job | Result | Time |", "|---|---|---|");
for (const j of jobs) out.push(`| ${j.name} | ${icon(j.conclusion)} ${j.conclusion ?? j.status} | ${fmt(secs(j))} |`);

for (const j of failed) {
  const step = j.steps?.find((s) => ["failure", "timed_out", "cancelled"].includes(s.conclusion));
  out.push("", `### ❌ ${j.name}`,
    "| | |", "|---|---|",
    `| Failed step | ${step ? step.name : j.conclusion === "timed_out" ? "time limit reached" : "before any step ran"} |`,
    `| Error | ${errorOf(j).replace(/\|/g, "\\|").slice(0, 900)} |`,
    `| What to do | ${nextStep(j.name)} |`,
    `| Log | ${j.html_url} |`);
}
if (failed.length) {
  out.push("", `Slack (lab: printed only): ❌ ${process.env.TITLE ?? "Run"} failed at ${failed.map((j) => j.name).join(", ")}. ${nextStep(failed[0].name)}`);
}

const text = out.join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
console.log(text);
