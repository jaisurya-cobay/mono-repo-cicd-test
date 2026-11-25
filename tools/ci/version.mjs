// Works out the version from PR titles merged since the release base.
// Env: MODE=rc|final, RELEASE_VERSION_FLOOR (optional), JIRA_RELEASED (optional, comma list), GH_TOKEN.
// Outputs: version (empty = nothing to release), tag, base, prs (JSON list of {number,title}).
import { parseVersion, baseVersion, nextVersion, nextRc, countsForVersion } from "./conventions.mjs";
import { sh, output, summary } from "./lib.mjs";

const mode = process.env.MODE ?? "rc";
const repo = process.env.GITHUB_REPOSITORY;
const tags = sh("git tag -l 'v*'").split("\n").filter(Boolean);
const finals = tags.filter((t) => parseVersion(t)?.rc === null);
const base = baseVersion({
  floor: process.env.RELEASE_VERSION_FLOOR || undefined,
  tags: finals,
  jiraReleased: (process.env.JIRA_RELEASED ?? "").split(",").filter(Boolean),
});
const baseTag = `v${base.major}.${base.minor}.${base.patch}`;
// Range starts at the base tag when it exists in git; a floor-only base counts the whole history
// once, which only happens on the very first suite release.
const range = tags.includes(baseTag) ? `${baseTag}..HEAD` : "HEAD";

// Every merge commit in range whose head branch is a feature/fix/hotfix branch.
const prs = [];
for (const line of sh(`git log --merges --format=%s ${range}`).split("\n")) {
  const m = /^Merge pull request #(\d+) from [^/]+\/(.+)$/.exec(line);
  if (!m || !countsForVersion(m[2])) continue;
  const title = sh(`gh api repos/${repo}/pulls/${m[1]} --jq .title`);
  prs.push({ number: +m[1], title });
}

const version = nextVersion({ base, titles: prs.map((p) => p.title), taken: finals });
const tag = version ? (mode === "rc" ? nextRc(version, tags) : version) : "";

output("version", version ?? "");
output("tag", tag);
output("base", baseTag);
output("prs", JSON.stringify(prs));
summary([
  `### Version: ${tag || "nothing to release"}`,
  `Base ${baseTag}${process.env.RELEASE_VERSION_FLOOR ? ` (floor ${process.env.RELEASE_VERSION_FLOOR})` : ""} · ${prs.length} PR(s) since`,
  "", "| PR | Title |", "|---|---|",
  ...prs.map((p) => `| #${p.number} | ${p.title.replace(/\|/g, "\\|")} |`),
].join("\n"));
