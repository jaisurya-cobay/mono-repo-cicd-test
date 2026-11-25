// Decides which apps to deploy to one environment, and why.
// An app deploys when its code changed since its last SUCCESSFUL deploy to this environment, so a
// failed or skipped deploy is retried on the next push and nothing is lost.
// Env: STAGE (qa|staging|production), HEAD_SHA, LIVE_DEPLOYS, optional ONLY_APP (slug) for rollback.
import { deployables, affected, lastSuccess, contentHash, isLive, recordEnv, output, summary } from "./lib.mjs";

const stage = process.env.STAGE;
const head = process.env.HEAD_SHA;
const onlyApp = process.env.ONLY_APP || "";

const rows = [];
const plan = { server: [], static: [] };
for (const app of deployables()) {
  if (onlyApp && app.slug !== onlyApp) continue;
  const live = isLive(app.slug, stage);
  const mode = live ? "live" : "dry run";
  let reason;
  if (onlyApp) reason = "manual / rollback request";
  else {
    const last = lastSuccess(recordEnv(app.slug, stage), app.slug);
    if (!last) reason = "first deploy to this environment";
    else {
      const changed = affected(last.sha, head);
      if (changed === null) reason = `last deploy ${last.sha.slice(0, 7)} not in history`;
      else if (changed.has(app.name)) reason = `changed since last deploy ${last.sha.slice(0, 7)}`;
      else {
        rows.push(`| ${app.slug} | skip | ${mode} | unchanged since ${last.sha.slice(0, 7)} |`);
        continue;
      }
    }
  }
  const item = { app: app.slug, project: app.name, root: app.root, hash: contentHash(app.name, head), live, record: recordEnv(app.slug, stage) };
  plan[app.kind].push(item);
  rows.push(`| ${app.slug} | **deploy** | ${mode} | ${reason} · content ${item.hash} |`);
}

summary([`### Deploy plan → ${stage} @ ${head.slice(0, 7)}`, "", "| App | Action | Mode | Why |", "|---|---|---|---|", ...rows].join("\n"));
output("server", JSON.stringify(plan.server));
output("static", JSON.stringify(plan.static));
output("projects", [...plan.server, ...plan.static].map((i) => i.project).join(","));
output("any", String(plan.server.length + plan.static.length > 0));
