#!/usr/bin/env bash
# Render configured Grafana dashboards (last 24h by default) and post PNGs/JPEGs to Slack.
# Designed for docker compose --profile slack-report, and for manual runs from the repo.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

# Load repo-root .env for manual runs. Compose injects env directly — do not require a file.
if [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Error: ${name} is required" >&2
    exit 1
  fi
}

require_var GRAFANA_URL
require_var GRAFANA_TOKEN
require_var SLACK_BOT_TOKEN
require_var SLACK_CHANNEL
require_var SLACK_REPORT_DASHBOARDS

SLACK_REPORT_FROM="${SLACK_REPORT_FROM:-now-24h}"
SLACK_REPORT_TO="${SLACK_REPORT_TO:-now}"
SLACK_REPORT_TZ="${SLACK_REPORT_TZ:-UTC}"
SLACK_REPORT_FORMAT="${SLACK_REPORT_FORMAT:-jpeg}"
SLACK_REPORT_QUALITY="${SLACK_REPORT_QUALITY:-80}"
SLACK_REPORT_WIDTH="${SLACK_REPORT_WIDTH:-1920}"
SLACK_REPORT_HEIGHT="${SLACK_REPORT_HEIGHT:-1080}"
SLACK_REPORT_TIMEOUT="${SLACK_REPORT_TIMEOUT:-120}"

GRAFANA_URL="${GRAFANA_URL%/}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

failures=0

is_png() {
  local path="$1"
  [ -s "${path}" ] || return 1
  # PNG magic: 89 50 4E 47
  local magic
  magic="$(od -An -tx1 -N4 "${path}" | tr -d ' \n')"
  [ "${magic}" = "89504e47" ]
}

dashboard_title() {
  local uid="$1"
  local resp
  resp="$(curl -sf -H "Authorization: Bearer ${GRAFANA_TOKEN}" \
    "${GRAFANA_URL}/api/dashboards/uid/${uid}" 2>/dev/null || true)"
  if [ -n "${resp}" ]; then
    local title
    title="$(echo "${resp}" | jq -r '.dashboard.title // empty')"
    if [ -n "${title}" ]; then
      echo "${title}"
      return
    fi
  fi
  echo "${uid}"
}

compress_image() {
  local src="$1"
  local dest="$2"
  local format="$3"
  local quality="$4"

  case "${format}" in
    png)
      cp "${src}" "${dest}"
      ;;
    jpeg|jpg)
      convert "${src}" -quality "${quality}" "${dest}"
      ;;
    webp)
      cwebp -quiet -q "${quality}" "${src}" -o "${dest}"
      ;;
    *)
      echo "Error: unsupported SLACK_REPORT_FORMAT=${format} (use jpeg, webp, or png)" >&2
      return 1
      ;;
  esac
}

upload_to_slack() {
  local file_path="$1"
  local filename="$2"
  local title="$3"
  local comment="$4"
  local length
  length="$(wc -c < "${file_path}" | tr -d ' ')"

  local get_url_resp
  get_url_resp="$(curl -sf -F "filename=${filename}" -F "length=${length}" \
    -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
    https://slack.com/api/files.getUploadURLExternal)"

  local ok upload_url file_id
  ok="$(echo "${get_url_resp}" | jq -r '.ok')"
  upload_url="$(echo "${get_url_resp}" | jq -r '.upload_url // empty')"
  file_id="$(echo "${get_url_resp}" | jq -r '.file_id // empty')"

  if [ "${ok}" != "true" ] || [ -z "${upload_url}" ] || [ -z "${file_id}" ]; then
    echo "Error getting Slack upload URL: ${get_url_resp}" >&2
    return 1
  fi

  curl -sf -X POST \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@${file_path}" \
    "${upload_url}" >/dev/null

  local files_json
  files_json="$(jq -nc --arg id "${file_id}" --arg title "${title}" '[{id:$id,title:$title}]')"

  local complete_resp
  complete_resp="$(curl -sf \
    -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
    -F "files=${files_json}" \
    -F "channel_id=${SLACK_CHANNEL}" \
    -F "initial_comment=${comment}" \
    https://slack.com/api/files.completeUploadExternal)"

  ok="$(echo "${complete_resp}" | jq -r '.ok')"
  if [ "${ok}" != "true" ]; then
    echo "Error completing Slack upload: ${complete_resp}" >&2
    return 1
  fi
}

report_one() {
  local entry="$1"
  local uid="${entry%%\?*}"
  local extra_qs=""
  if [[ "${entry}" == *\?* ]]; then
    extra_qs="&${entry#*\?}"
  fi

  local title
  title="$(dashboard_title "${uid}")"
  local safe_uid
  safe_uid="$(echo "${uid}" | tr '/ ' '__')"
  local png_path="${TMP_DIR}/${safe_uid}.png"

  echo "Rendering ${title} (${uid}) [${SLACK_REPORT_FROM} → ${SLACK_REPORT_TO}]..."

  local render_url
  render_url="${GRAFANA_URL}/render/d/${uid}/report?orgId=1&from=${SLACK_REPORT_FROM}&to=${SLACK_REPORT_TO}&width=${SLACK_REPORT_WIDTH}&height=${SLACK_REPORT_HEIGHT}&tz=${SLACK_REPORT_TZ}&kiosk=tv&theme=dark&timeout=${SLACK_REPORT_TIMEOUT}${extra_qs}"

  if ! curl -sf -H "Authorization: Bearer ${GRAFANA_TOKEN}" \
    "${render_url}" \
    -o "${png_path}"; then
    echo "Error: Grafana render request failed for ${uid}" >&2
    return 1
  fi

  if ! is_png "${png_path}"; then
    echo "Error: Grafana did not return a PNG for ${uid} (auth or renderer failure?). First bytes:" >&2
    head -c 200 "${png_path}" >&2 || true
    echo >&2
    return 1
  fi

  local format="${SLACK_REPORT_FORMAT}"
  local out_path ext filename
  case "${format}" in
    png)
      out_path="${png_path}"
      ext="png"
      ;;
    jpeg|jpg)
      out_path="${TMP_DIR}/${safe_uid}.jpg"
      ext="jpg"
      format="jpeg"
      ;;
    webp)
      out_path="${TMP_DIR}/${safe_uid}.webp"
      ext="webp"
      ;;
    *)
      echo "Error: unsupported SLACK_REPORT_FORMAT=${format}" >&2
      return 1
      ;;
  esac

  if [ "${format}" != "png" ]; then
    echo "Compressing to ${format} (quality ${SLACK_REPORT_QUALITY})..."
    compress_image "${png_path}" "${out_path}" "${format}" "${SLACK_REPORT_QUALITY}"
  fi

  filename="${safe_uid}.${ext}"
  local comment
  comment="📊 Daily Grafana report: *${title}* (${SLACK_REPORT_FROM} → ${SLACK_REPORT_TO})"

  echo "Uploading ${filename} to Slack..."
  upload_to_slack "${out_path}" "${filename}" "${title}" "${comment}"
  echo "Sent: ${title}"
}

# Split comma-separated dashboard list (trim whitespace around entries)
IFS=',' read -r -a DASHBOARD_ENTRIES <<< "${SLACK_REPORT_DASHBOARDS}"

for raw in "${DASHBOARD_ENTRIES[@]}"; do
  entry="$(echo "${raw}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "${entry}" ] && continue
  if ! report_one "${entry}"; then
    failures=$((failures + 1))
    echo "Continuing after failure for: ${entry}" >&2
  fi
done

if [ "${failures}" -gt 0 ]; then
  echo "Finished with ${failures} failure(s)." >&2
  exit 1
fi

echo "All dashboard reports sent successfully."
