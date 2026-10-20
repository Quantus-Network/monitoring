#!/bin/sh
# Write Cloudflare Access scrape credentials, then start Prometheus.
set -e

if [ -z "$CF_ACCESS_CLIENT_ID" ] || [ -z "$CF_ACCESS_CLIENT_SECRET" ]; then
  echo "error: CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must be set" >&2
  exit 1
fi

printf '%s' "$CF_ACCESS_CLIENT_ID" > /etc/prometheus/secrets/cf_access_client_id
printf '%s' "$CF_ACCESS_CLIENT_SECRET" > /etc/prometheus/secrets/cf_access_client_secret

exec /bin/prometheus "$@"
