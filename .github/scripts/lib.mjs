// Helpers shared by plan.mjs and gate.mjs. Need: full git history, pnpm install done, GH_TOKEN.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";

export const sh = (cmd) => execSync(cmd, { encoding: "utf8", shell: "bash", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 << 20 }).trim();
const nx = (args) => sh(`pnpm exec nx ${args}`);
const repo = process.env.GITHUB_REPOSITORY;

// Deployable projects and their kind, from the deploy:<kind> tag in each package.json.
export function deployables() {
  const names = JSON.parse(nx(`show projects --projects "tag:deploy:*" --json`));
  return names.map((name) => {
    const p = JSON.parse(nx(`show project ${name} --json`));
    const kind = p.tags.find((t) => t.startsWith("deploy:")).slice("deploy:".length);
    return { name, kind, root: p.root, slug: name.replace(/^@[^/]+\//, "") };
  });
}

// Projects whose inputs changed between two commits (includes dependents of changed packages).
export function affected(base, head) {
  try {
    return new Set(JSON.parse(nx(`show projects --affected --base=${base} --head=${head} --json`)));
  } catch {
    return null; // base not reachable (force-push, rewritten history): caller treats as "changed"
  }
}

// Last successful deployment of one app to one environment, from GitHub Deployments.
// Per-app records use task "deploy:<slug>", so they never mix with other apps.
export function lastSuccess(environment, slug) {
  const list = JSON.parse(sh(`gh api "repos/${repo}/deployments?environment=${encodeURIComponent(environment)}&task=deploy:${slug}&per_page=30"`));
  for (const d of list) {
    const state = sh(`gh api "repos/${repo}/deployments/${d.id}/statuses?per_page=1" --jq '.[0].state // ""'`);
    if (state === "success") return { sha: d.sha, id: d.id, payload: d.payload };
  }
  return null;
}

// Content hash of a deployable: git tree of its folder + every workspace package it depends on
// + the lockfile. Same code => same hash, whatever the commit SHA (promotion merge commits included).
let graph;
export function contentHash(projectName, ref = "HEAD") {
  graph ??= JSON.parse(nx(`graph --print`)).graph;
  const seen = new Set();
  const walk = (n) => {
    if (seen.has(n) || !graph.nodes[n]) return;
    seen.add(n);
    for (const dep of graph.dependencies[n] ?? []) walk(dep.target);
  };
  walk(projectName);
  const parts = [...seen].sort().map((n) => `${graph.nodes[n].data.root}:${sh(`git rev-parse ${ref}:${graph.nodes[n].data.root}`)}`);
  parts.push(`lock:${sh(`git rev-parse ${ref}:pnpm-lock.yaml`)}`);
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 16);
}

export function output(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}<<EOF\n${value}\nEOF\n`);
  else console.log(`${key}=${value}`);
}

export function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  console.log(md);
}
