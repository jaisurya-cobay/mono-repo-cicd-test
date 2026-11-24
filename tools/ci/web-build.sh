#!/usr/bin/env bash
# Web builds are made ONCE per content hash and stored as an Actions artifact "web-<app>-<hash>"
# (90 days). Every environment downloads the same files; only config.json differs per environment.
# Suite: same idea with s3://<builds-bucket>/web/<app>/<hash>.tgz instead of Actions artifacts.
#   web-build.sh find <app> <hash>          → prints artifact id, or nothing
#   web-build.sh fetch <app> <hash> <dir>   → downloads and unpacks into <dir>
set -euo pipefail
cmd=$1 app=$2 hash=$3
name="web-$app-$hash"
id=$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=$name&per_page=1" --jq '[.artifacts[] | select(.expired == false)][0].id // empty')
case $cmd in
  find) echo "$id" ;;
  fetch)
    dir=$4
    [[ -n $id ]] || { echo "::error::No stored build $name (expired or never built). Re-run the qa deploy for this commit."; exit 1; }
    mkdir -p "$dir"
    gh api "repos/$GITHUB_REPOSITORY/actions/artifacts/$id/zip" > "$RUNNER_TEMP/$name.zip"
    unzip -q -o "$RUNNER_TEMP/$name.zip" -d "$dir"
    echo "Fetched $name ($id)"
    ;;
  *) echo "usage: web-build.sh find|fetch <app> <hash> [dir]" >&2; exit 2 ;;
esac
