#!/usr/bin/env bash
# Default: write crontab from SLACK_REPORT_CRON and run supercronic.
# Override: docker compose run --rm slack-report /usr/local/bin/slack-report.sh
set -euo pipefail

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

CRON_EXPR="${SLACK_REPORT_CRON:-0 8 * * *}"
CRONTAB_FILE="/tmp/slack-report.crontab"

echo "${CRON_EXPR} /usr/local/bin/slack-report.sh" > "${CRONTAB_FILE}"
echo "slack-report cron: ${CRON_EXPR} (TZ=${TZ:-UTC})"

exec /usr/local/bin/supercronic -passthrough-logs "${CRONTAB_FILE}"
