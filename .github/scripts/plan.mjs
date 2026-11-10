// Decides which apps to deploy to one environment, and why.
// Env: DEPLOY_ENV (QA|staging|production), HEAD_SHA, optional ONLY_APP (slug) for manual/rollback.
import { deployables, affected, lastSuccess, contentHash, output, summary } from "./lib.mjs";

const env = process.env.DEPLOY_ENV;
const head = process.env.HEAD_SHA;
const onlyApp = process.env.ONLY_APP || "";

const rows = [];
const plan = { server: [], static: [] };
for (const app of deployables()) {
  if (onlyApp && app.slug !== onlyApp) continue;
  let reason;
  if (onlyApp) reason = "manual / rollback request";
  else {
    const last = lastSuccess(env, app.slug);
    if (!last) reason = "first deploy to this environment";
    else {
      const changed = affected(last.sha, head);
      if (changed === null) reason = `last deploy ${last.sha.slice(0, 7)} not in history`;
      else if (changed.has(app.name)) reason = `changed since last deploy ${last.sha.slice(0, 7)}`;
      else {
        rows.push(`| ${app.slug} | skip | unchanged since ${last.sha.slice(0, 7)} |`);
        continue;
      }
    }
  }
  const item = { app: app.slug, project: app.name, root: app.root, hash: contentHash(app.name) };
  plan[app.kind].push(item);
  rows.push(`| ${app.slug} | **deploy** | ${reason} · content ${item.hash} |`);
}

summary([`### Deploy plan → ${env} @ ${head.slice(0, 7)}`, "", "| App | Action | Why |", "|---|---|---|", ...rows].join("\n"));
output("server", JSON.stringify(plan.server));
output("static", JSON.stringify(plan.static));
output("projects", [...plan.server, ...plan.static].map((i) => i.project).join(","));
output("any", String(plan.server.length + plan.static.length > 0));
