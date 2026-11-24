# mono-repo-cicd-test

Lab for the cobay-suite CI/CD. Same Nx layout and the same workflows as the suite will get, with AWS
stubbed: deploy steps print or simulate instead of calling SSM / S3. Public repo, so no company code.

Branches: `qa → staging → master`, `hotfix/* → master`. Merge commits everywhere; versions come from PR titles.

## Layout

```
.github/
  workflows/
    ci.yml               PR checks by lane, one required check "ci"
    deploy.yml           push qa/staging/master: plan → test (qa) → build once → deploy → version → notify
    release.yml          Release button: preflight, then the release bot merges into master
    rollback.yml         Rollback button: app + environment + version, never builds
    security.yml         nightly re-scan of the images that are live
    dast.yml             manual ZAP scan against staging
    _build-image.yml     reusable: buildx + registry layer cache, SBOM + provenance, Trivy
    _deploy-server.yml   reusable: one image → one environment (lab stub for OIDC + SSM rolling)
    _deploy-web.yml      reusable: one stored web build + config.json → one environment
  actions/setup/         pnpm + Node from .nvmrc + caches + frozen install
  rulesets/              qa, staging, master, tags (apply with tools/ci/rulesets.sh)
  dependabot.yml         monthly, grouped per ecosystem
tools/ci/                plan, gate, guard, version, title, notify … (+ unit tests)
apps/ packages/          Nx projects; deploy:server / deploy:static tags mark deployables
```

## One-time setup

1. **Release bot (GitHub App)** on your account: Settings → Developer settings → GitHub Apps → New.
   Permissions: Contents read/write, Pull requests read/write, Metadata read. No webhook.
   Install it on this repo. Then in the repo: variable `RELEASE_APP_ID`, secret `RELEASE_APP_PRIVATE_KEY`.
2. **Branches**: create `qa` and `staging` from `master`.
3. **Settings → General → Pull requests**: allow merge commits only, allow auto-merge, auto-delete head branches.
4. **Settings → Actions → General**: allow GitHub Actions to create and approve pull requests.
5. **Rulesets**: `tools/ci/rulesets.sh jaisurya-cobay/mono-repo-cicd-test <app-id> --lab`
   (`--lab` drops required approvals, because one person can't approve their own PR).
6. **Environments**: `server-qa`, `server-staging`, `server-production`, `web-qa`, `web-staging`, `web-production`.
   On each `web-*`: variable `WEB_CONFIG_JSON`, e.g. `{"apiBaseUrl":"https://api.qa.example.com"}`.
7. **Variables**: `LIVE_DEPLOYS` = which apps deploy for real per environment, e.g.
   `{"post-purchase-server":["qa","staging","production"],"post-purchase-client":["qa","staging","production"],"post-purchase-tracking":["qa","staging","production"]}`.
   Leave an app out to keep it in dry run. Optional: `RELEASE_VERSION_FLOOR` (e.g. `v1.0.0`),
   `LAB_FAIL_DEPLOY` = `<stage>:<app>` to simulate a failed rollout, `CICD_ENABLED=false` to stop everything.

## Scenarios to rehearse

| # | Do | Expect |
|---|---|---|
| 1 | Draft PR into qa | nothing runs |
| 2 | Ready for review, title `fixed bug` | ci fails on the title |
| 3 | `feat(post-purchase-client): OMS-1 …`, client change only | quick check on client only; after merge only the client builds and deploys to QA |
| 4 | `fix(post-purchase-server): OMS-2 …` | only the server: image built once, deployed to QA |
| 5 | One PR touching server + client | both build; server deploys first, then client |
| 6 | Change `packages/shared-contracts` | every app that imports it |
| 7 | Docs-only PR | checks only, nothing deploys |
| 8 | Promotion PR qa → staging | gate passes in under a minute; staging reuses the image and web build; tag `vX.Y.Z-rc.1`; Release PR opened |
| 9 | Second promotion with only a `fix` | rc recalculated against the last release, never lower |
| 10 | Press Release | preflight passes, bot merges, production deploy, tag + GitHub Release |
| 11 | Press Release again | "Nothing to release", green |
| 12 | `hotfix/OMS-3-…` → master with `feat:` | ci fails: hotfix must be fix, perf or revert |
| 13 | Hotfix with `fix:`, then Release | image built on the PR and reused; patch version; back-merge PRs into staging and qa auto-merge |
| 14 | Open qa PR touching the hotfix's file, branched before it | back-merge guard fails until updated from qa; other PRs pass |
| 15 | Hotfix that conflicts with qa | back-merge PR labelled `backmerge-conflict`, left for a person |
| 16 | Promotion while a back-merge is pending | gate fails and names the missing hotfix |
| 17 | `LAB_FAIL_DEPLOY=qa:post-purchase-server` then merge server + client | server fails, client waits; next push retries the server |
| 18 | Rollback production server to the previous tag | no build, same lock as deploys |
| 19 | Revert a feat PR before promotion | version drops back (PR and revert cancel out) |
| 20 | App left out of `LIVE_DEPLOYS` | dry-run summary, recorded as `<stage>-dryrun`, never counts as a real deploy |
