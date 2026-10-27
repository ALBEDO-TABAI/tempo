#!/bin/bash
# Unsigned macOS arm64 test build from Linux: vite → esbuild → electron-builder (zip, darwin-arm64 better-sqlite3 prebuild)
# → ad-hoc sign (rcodesign) → re-zip keeping symlinks → 25 MB parts + md5.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-/workspace/dist-parts}; NAME=${NAME:-tempo-mac-arm64-v1}
RCODESIGN=${RCODESIGN:-/home/box/tools/rcodesign}
npm run tokens >/dev/null && npm -w @tempo/app run build >/dev/null
cd packages/desktop && rm -rf release && npm run dist:mac
APP=release/mac-arm64/Tempo.app
test -f "$APP/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/prebuilds/darwin-arm64.node"
test -f "$APP/Contents/Resources/renderer/index.html"
"$RCODESIGN" sign "$APP" >/dev/null   # ad-hoc: Apple Silicon refuses to run unsigned Mach-O
mkdir -p "$OUT" && rm -f "$OUT/$NAME".zip* "$OUT/MD5SUMS-$NAME.txt"
(cd release/mac-arm64 && python3 ../../../../scripts/zip-app.py . Tempo.app "$OUT/$NAME.zip")
cd "$OUT" && split -b 25M -d -a 2 "$NAME.zip" "$NAME.zip.part" && md5sum "$NAME.zip" "$NAME.zip.part"* > "MD5SUMS-$NAME.txt" && cat "MD5SUMS-$NAME.txt"
