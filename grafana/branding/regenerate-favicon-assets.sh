#!/bin/sh
# macOS: rebuild fav32.png, favicon.ico, logo.png from quantus-favicon.svg (needs qlmanage + sips).
set -e
cd "$(dirname "$0")"
OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT
qlmanage -t -s 512 -o "$OUT_DIR" quantus-favicon.svg >/dev/null 2>&1
SRC="$OUT_DIR/quantus-favicon.svg.png"
sips -z 32 32 "$SRC" -o fav32.png
sips -z 180 180 "$SRC" -o logo.png
sips -s format ico fav32.png --out favicon.ico
echo "Updated fav32.png, favicon.ico, logo.png"
