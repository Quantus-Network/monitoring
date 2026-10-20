#!/usr/bin/env bash
# Print "true" if the selected git tag should also be published as :latest.
# :latest is only for the newest stable tag (vX.Y.Z, no prerelease suffix).
set -euo pipefail

SELECTED="${1:?selected version required}"

if [[ ! "$SELECTED" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
  echo "invalid version: $SELECTED" >&2
  exit 1
fi

newest_stable=""
while IFS= read -r tag; do
  if [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    newest_stable="$tag"
    break
  fi
done < <(git tag --list 'v*' --sort=-v:refname)

if [[ -n "$newest_stable" && "$SELECTED" == "$newest_stable" ]]; then
  echo "true"
else
  echo "false"
fi
