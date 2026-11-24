// Server apps a hotfix PR changes, with their content hash, so the PR can build the image the
// production deploy will reuse. Env: BASE_SHA. Output: server (JSON matrix).
import { deployables, affected, contentHash, output, summary } from "./lib.mjs";

const changed = affected(process.env.BASE_SHA, "HEAD") ?? new Set();
const server = deployables()
  .filter((a) => a.kind === "server" && changed.has(a.name))
  .map((a) => ({ app: a.slug, project: a.name, root: a.root, hash: contentHash(a.name) }));
output("server", JSON.stringify(server));
summary(`### Hotfix images: ${server.map((s) => `${s.app}:${s.hash}`).join(", ") || "none (no server change)"}`);
