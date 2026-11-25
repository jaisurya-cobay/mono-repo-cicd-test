#!/usr/bin/env bash
# Applies .github/rulesets/*.json to a repo (create or update by name). Rulesets as code: change the
# JSON in a PR, then run this. Needs an admin token (gh auth) and the release app's numeric ID.
#   tools/ci/rulesets.sh <owner/repo> <release-app-id> [--lab]
# --lab: one-person lab repo, so approvals → 0 and no code-owner review (you can't approve your own PR).
set -euo pipefail
repo=$1 app_id=$2 lab=${3:-}
existing=$(gh api "repos/$repo/rulesets" --jq 'map({(.name): .id}) | add // {}')
for f in "$(dirname "$0")"/../../.github/rulesets/*.json; do
  body=$(sed "s/\"__RELEASE_APP_ID__\"/$app_id/" "$f")
  if [[ $lab == --lab ]]; then
    body=$(jq '(.rules[] | select(.type == "pull_request") | .parameters) |= (.required_approving_review_count = 0 | .require_code_owner_review = false | .require_last_push_approval = false)' <<<"$body")
  fi
  name=$(jq -r .name <<<"$body")
  id=$(jq -r --arg n "$name" '.[$n] // empty' <<<"$existing")
  if [[ -n $id ]]; then gh api -X PUT "repos/$repo/rulesets/$id" --input - <<<"$body" >/dev/null; echo "updated $name"
  else gh api -X POST "repos/$repo/rulesets" --input - <<<"$body" >/dev/null; echo "created $name"; fi
done
