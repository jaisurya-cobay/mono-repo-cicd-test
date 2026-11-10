#!/usr/bin/env bash
# Per-app deployment record: record.sh start|success|failure <environment> <slug> <sha> [payload-json]
# start prints the deployment id; success/failure read it from DEPLOYMENT_ID.
set -euo pipefail
action=$1 environment=$2 slug=$3 sha=$4 payload=${5:-'{}'}
if [[ $action == start ]]; then
  id=$(jq -n --argjson p "$payload" --arg ref "$sha" --arg env "$environment" --arg task "deploy:$slug" \
      '{ref:$ref, environment:$env, task:$task, auto_merge:false, required_contexts:[], payload:$p,
        production_environment:($env=="production"), description:$task}' |
    gh api "repos/$GITHUB_REPOSITORY/deployments" --method POST --input - --jq .id)
  gh api "repos/$GITHUB_REPOSITORY/deployments/$id/statuses" --method POST -f state=in_progress >/dev/null
  echo "$id"
else
  gh api "repos/$GITHUB_REPOSITORY/deployments/$DEPLOYMENT_ID/statuses" --method POST -f state="$action" >/dev/null
fi
