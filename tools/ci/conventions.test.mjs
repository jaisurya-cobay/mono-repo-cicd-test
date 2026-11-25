import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTitle, bumpOf, cancelReverts, baseVersion, nextVersion, nextRc, upcomingGuess, parseVersion, countsForVersion } from "./conventions.mjs";

const scopes = ["post-purchase-client", "post-purchase-server", "post-purchase-tracking", "shared-contracts", "engine-client"];

test("valid titles pass", () => {
  assert.deepEqual(checkTitle("feat(post-purchase-client): OMS-198 bulk label download", { scopes }), []);
  assert.deepEqual(checkTitle("chore: bump eslint", { scopes }), []);
  assert.deepEqual(checkTitle("chore(deps): bump axios", { scopes: [] }), []);
  assert.deepEqual(checkTitle('Revert "feat(post-purchase-client): OMS-198 bulk label download"', { scopes }), []);
});

test("key required for feat, fix, perf only", () => {
  assert.equal(checkTitle("fix(post-purchase-server): handle null AWB", { scopes }).length, 1);
  assert.deepEqual(checkTitle("docs: update runbook", { scopes }), []);
});

test("bad format, type and scope are reported", () => {
  assert.equal(checkTitle("fixed bug", { scopes }).length, 1);
  assert.match(checkTitle("feature: OMS-1 x", { scopes })[0], /Unknown type/);
  assert.match(checkTitle("fix(billing): OMS-1 x", { scopes })[0], /Unknown scope/);
});

test("hotfix lane accepts only patch-sized types", () => {
  assert.deepEqual(checkTitle("fix(post-purchase-server): OMS-230 COD total", { lane: "hotfix", scopes }), []);
  assert.match(checkTitle("feat(post-purchase-server): OMS-231 new thing", { lane: "hotfix", scopes })[0], /only be fix, perf or revert/);
  assert.equal(checkTitle("fix(post-purchase-server)!: OMS-232 api change", { lane: "hotfix", scopes }).length, 1);
});

test("bump levels", () => {
  assert.equal(bumpOf("feat(x)!: OMS-1 a"), 3);
  assert.equal(bumpOf("feat: OMS-1 a"), 2);
  assert.equal(bumpOf("perf: OMS-1 a"), 1);
  assert.equal(bumpOf("chore(deps): a"), 0);
});

test("a PR and its revert cancel out", () => {
  const titles = ["feat(c): OMS-1 a", "fix(s): OMS-2 b", 'Revert "feat(c): OMS-1 a"'];
  assert.deepEqual(cancelReverts(titles), ["fix(s): OMS-2 b"]);
  assert.equal(nextVersion({ base: parseVersion("v1.103.0"), titles }), "v1.103.1");
});

test("legacy tags are ignored and the floor wins", () => {
  assert.equal(parseVersion("v.4.0.1"), null);
  const base = baseVersion({ floor: "v1.102.0", tags: ["v.4.0.1", "v.3.01", "v1.97.0"], jiraReleased: ["v1.101.0"] });
  assert.deepEqual(base, { major: 1, minor: 102, patch: 0, rc: null });
});

test("rc tags never count as a base", () => {
  const base = baseVersion({ tags: ["v1.103.0", "v1.104.0-rc.3"] });
  assert.equal(nextVersion({ base, titles: ["fix: OMS-9 a"] }), "v1.103.1");
});

test("feat → minor, fix-only → patch, breaking → major, chore → nothing", () => {
  const base = parseVersion("v1.103.0");
  assert.equal(nextVersion({ base, titles: ["feat: OMS-1 a", "fix: OMS-2 b"] }), "v1.104.0");
  assert.equal(nextVersion({ base, titles: ["fix: OMS-2 b"] }), "v1.103.1");
  assert.equal(nextVersion({ base, titles: ["feat(s)!: OMS-3 c"] }), "v2.0.0");
  assert.equal(nextVersion({ base, titles: ["chore: x", "docs: y"] }), null);
});

test("hotfix took the patch: staging moves to the next free one", () => {
  const base = parseVersion("v1.103.0");
  assert.equal(nextVersion({ base, titles: ["fix: OMS-2 b"], taken: ["v1.103.0", "v1.103.1"] }), "v1.103.2");
});

test("rc numbering and the Jira upcoming guess", () => {
  assert.equal(nextRc("v1.104.0", ["v1.104.0-rc.1", "v1.104.0-rc.2", "v1.103.9-rc.7"]), "v1.104.0-rc.3");
  assert.equal(nextRc("v1.104.0", []), "v1.104.0-rc.1");
  assert.equal(upcomingGuess("v1.64.1"), "v1.65.0");
});

test("promotion, back-merge and release PRs do not count", () => {
  assert.equal(countsForVersion("qa"), false);
  assert.equal(countsForVersion("staging"), false);
  assert.equal(countsForVersion("backmerge/master-to-qa-abc1234"), false);
  assert.equal(countsForVersion("feature/OMS-1-x"), true);
  assert.equal(countsForVersion("hotfix/OMS-230-cod"), true);
});
