#!/usr/bin/env bash
# Classify a registry manifest probe (docker manifest inspect or equivalent).
# Usage: classify_manifest_probe.sh <exit_code>
# Reads combined inspect stdout/stderr from stdin.
# Prints exactly one of: exists | not_found | error
set -euo pipefail

STATUS="${1:?exit code required}"

if [[ ! "$STATUS" =~ ^[0-9]+$ ]]; then
  echo "invalid exit code: $STATUS" >&2
  exit 1
fi

OUTPUT="$(cat)"

if [[ "$STATUS" -eq 0 ]]; then
  echo "exists"
  exit 0
fi

# Confirmed registry not-found only. Auth, DNS, timeouts, and 5xx must not
# look like a missing tag — "no such host" is deliberately not matched.
if grep -qiE \
  'no such manifest|manifest unknown|MANIFEST_UNKNOWN|name unknown|NAME_UNKNOWN|manifest for .+ not found' \
  <<<"$OUTPUT"
then
  echo "not_found"
  exit 0
fi

echo "error"
exit 0
