// Pure rules shared by the PR-title check and the version calculation. No I/O, unit-tested.

export const TYPES = ["feat", "fix", "perf", "refactor", "chore", "docs", "test", "ci", "build", "style", "revert"];
const KEY_REQUIRED = new Set(["feat", "fix", "perf"]);
const HOTFIX_TYPES = new Set(["fix", "perf", "revert"]);
const KEY = /\b[A-Z][A-Z0-9]+-\d+\b/;
const TITLE = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9-]+)\))?(?<bang>!)?: (?<subject>.+)$/;
const GITHUB_REVERT = /^Revert "(?<original>.+)"$/;

// Parse a PR title. Returns { type, scope, breaking, subject, key, revertOf } or null when unparseable.
export function parseTitle(title) {
  const t = title.trim();
  const gr = t.match(GITHUB_REVERT);
  if (gr) return { type: "revert", scope: null, breaking: false, subject: gr.groups.original, key: t.match(KEY)?.[0] ?? null, revertOf: gr.groups.original };
  const m = t.match(TITLE);
  if (!m) return null;
  const { type, scope = null, bang, subject } = m.groups;
  return {
    type, scope, breaking: Boolean(bang) || /BREAKING CHANGE/.test(subject), subject,
    key: subject.match(KEY)?.[0] ?? null,
    revertOf: type === "revert" ? subject.replace(/^"|"$/g, "") : null,
  };
}

// Validate a PR title for a lane. `scopes` = known Nx project names (without the @org/ prefix).
// Returns a list of problems (empty = valid).
export function checkTitle(title, { lane, scopes = [] } = {}) {
  const p = parseTitle(title);
  if (!p) return [`"${title}" is not "type(scope): OMS-123 description". Allowed types: ${TYPES.join(", ")}.`];
  const errors = [];
  if (!TYPES.includes(p.type)) errors.push(`Unknown type "${p.type}". Allowed: ${TYPES.join(", ")}.`);
  if (p.scope && scopes.length && !scopes.includes(p.scope)) errors.push(`Unknown scope "${p.scope}". Use an Nx project: ${scopes.join(", ")}.`);
  if (KEY_REQUIRED.has(p.type) && !p.key) errors.push(`"${p.type}" needs a ticket key, e.g. "${p.type}(scope): OMS-123 ${p.subject}".`);
  if (lane === "hotfix") {
    if (!HOTFIX_TYPES.has(p.type)) errors.push(`A hotfix can only be fix, perf or revert (a patch). "${p.type}" must go through qa.`);
    if (p.breaking) errors.push("A hotfix cannot be a breaking change. Ship it through qa.");
  }
  return errors;
}

// Bump level of one PR title: 3 major, 2 minor, 1 patch, 0 none.
export function bumpOf(title) {
  const p = parseTitle(title);
  if (!p) return 0;
  if (p.breaking) return 3;
  if (p.type === "feat") return 2;
  if (p.type === "fix" || p.type === "perf") return 1;
  return 0;
}

// Drop PRs that were reverted inside the same range, and the reverts themselves.
export function cancelReverts(titles) {
  const out = [...titles];
  for (let i = out.length - 1; i >= 0; i--) {
    const p = parseTitle(out[i] ?? "");
    if (!p?.revertOf) continue;
    const j = out.findIndex((t, k) => k !== i && t?.trim() === p.revertOf.trim());
    if (j >= 0) { out[i] = null; out[j] = null; }
  }
  return out.filter((t) => t !== null);
}

// Strict vX.Y.Z (optionally -rc.N). Legacy tags such as v.4.0.1 return null.
export function parseVersion(v) {
  const m = /^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec((v ?? "").trim());
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], rc: m[4] === undefined ? null : +m[4] } : null;
}
const cmp = (a, b) => a.major - b.major || a.minor - b.minor || a.patch - b.patch;
const fmt = (v) => `v${v.major}.${v.minor}.${v.patch}`;

// The release base: highest of the floor, every final release tag, and released Jira versions.
export function baseVersion({ floor, tags = [], jiraReleased = [] }) {
  const finals = [floor, ...tags, ...jiraReleased].map(parseVersion).filter((v) => v && v.rc === null);
  if (!finals.length) return { major: 0, minor: 0, patch: 0, rc: null };
  return finals.sort(cmp).at(-1);
}

// Next version from the base and the PR titles merged since it. null = nothing to release.
// `taken` = every existing final tag; the result is always above all of them (hotfix collisions).
export function nextVersion({ base, titles, taken = [] }) {
  const level = Math.max(0, ...cancelReverts(titles).map(bumpOf));
  if (level === 0) return null;
  let v = { ...base };
  if (level === 3) v = { major: v.major + 1, minor: 0, patch: 0 };
  else if (level === 2) v = { major: v.major, minor: v.minor + 1, patch: 0 };
  else v = { major: v.major, minor: v.minor, patch: v.patch + 1 };
  const finals = taken.map(parseVersion).filter((t) => t && t.rc === null);
  while (finals.some((t) => cmp(t, v) >= 0)) v = { ...v, patch: v.patch + 1 };
  return fmt(v);
}

// Next release-candidate tag for a version, given existing tags.
export function nextRc(version, tags = []) {
  const n = tags.map(parseVersion).filter((t) => t && t.rc !== null && fmt(t) === version).map((t) => t.rc);
  return `${version}-rc.${n.length ? Math.max(...n) + 1 : 1}`;
}

// Jira "upcoming" guess after a release: last released + minor.
export function upcomingGuess(released) {
  const v = parseVersion(released);
  return v ? fmt({ major: v.major, minor: v.minor + 1, patch: 0 }) : null;
}

// Which PRs count for versioning: feature/fix/hotfix PRs, not promotions, back-merges or release PRs.
export function countsForVersion(headRef) {
  return !["qa", "staging"].includes(headRef) && !headRef.startsWith("backmerge/");
}
