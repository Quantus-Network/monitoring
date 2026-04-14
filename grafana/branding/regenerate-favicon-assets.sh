#!/bin/sh
# Rebuild fav32.png, favicon.ico, logo.png from quantus-favicon.svg.
# Requires: librsvg (brew install librsvg), sips (macOS built-in).
set -e
cd "$(dirname "$0")"

rsvg-convert -w 32  -h 32  quantus-favicon.svg -o fav32.png
rsvg-convert -w 180 -h 180 quantus-favicon.svg -o logo.png
sips -s format ico fav32.png --out favicon.ico >/dev/null 2>&1

echo "Updated fav32.png, favicon.ico, logo.png"
