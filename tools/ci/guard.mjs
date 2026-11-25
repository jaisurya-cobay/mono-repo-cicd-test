// Back-merge guard for PRs into qa. Fails only when the PR touches files a hotfix changed AND the PR
// branch does not contain that hotfix yet. Every other PR passes, so nobody is frozen.
// With merge commits everywhere, feature commits keep their SHAs on master, so the commits on master
// that HEAD lacks (no merges) are exactly the hotfix commits not yet back in this branch.
// Env: BASE_SHA (PR base). Needs full history and origin/master fetched.
import { sh, summary } from "./lib.mjs";

const missing = sh("git log --no-merges --format=%H HEAD..origin/master").split("\n").filter(Boolean);
if (!missing.length) {
  summary("### Back-merge guard: ✅ this branch already has every hotfix");
  process.exit(0);
}
const hotfixFiles = new Set(missing.flatMap((c) => sh(`git show --name-only --format= ${c}`).split("\n").filter(Boolean)));
const prFiles = sh(`git diff --name-only ${process.env.BASE_SHA}...HEAD`).split("\n").filter(Boolean);
const overlap = prFiles.filter((f) => hotfixFiles.has(f));

if (!overlap.length) {
  summary(`### Back-merge guard: ✅ ${missing.length} hotfix commit(s) not in this branch, but no file overlaps`);
  process.exit(0);
}
summary([
  "### Back-merge guard: ❌ update your branch from qa first",
  "This PR changes files that a production hotfix also changed, and your branch does not have that hotfix yet.",
  "Wait for the back-merge PR into qa to merge, then update this branch from qa.",
  "", ...overlap.map((f) => `- \`${f}\``),
].join("\n"));
console.log(`::error title=Back-merge guard::Update this branch from qa first: ${overlap.join(", ")} changed in a hotfix you don't have yet.`);
process.exit(1);
