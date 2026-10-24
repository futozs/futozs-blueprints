#!/bin/bash
#
# Package the Pterodactyl 2.x build of one extension into a .pteroext archive.
#
#   PANEL_SRC=/path/to/panel-2.x scripts/build-v2.sh serverorganizer [output-dir]
#
# The 2.x package lives in extensions/<name>/v2 and shares its UI code with the
# 1.x Blueprint package (scripts/sync-shared.mjs copies it in before building).
# The SDK is not on npm: it is linked from a panel 2.x checkout (PANEL_SRC) whose
# 'npm ci && npm run sdk:testing' has been run. Without PANEL_SRC, an existing
# extensions/<name>/v2/.panel link is used.
#
# The archive holds what 'php artisan p:extension:pack' would put in it.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${1:-}"
OUT_DIR="${2:-$REPO_ROOT/dist}"

[ -n "$NAME" ] || { echo "Usage: PANEL_SRC=<panel 2.x checkout> scripts/build-v2.sh <extension-name> [output-dir]"; exit 1; }

SRC="$REPO_ROOT/extensions/$NAME/v2"
[ -f "$SRC/extension.json" ] || { echo "ERROR: $SRC/extension.json not found - $NAME has no 2.x package"; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "ERROR: 'zip' is required."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "ERROR: 'npm' (Node 22) is required."; exit 1; }

# A ket csomag verzioja mindig egyezzen: egy kiadas = egy verzio, 1.x-en es 2.x-en.
V1=$(grep -oE 'version: *"[^"]+"' "$REPO_ROOT/extensions/$NAME/conf.yml" | head -1 | cut -d'"' -f2)
V2=$(grep -oE '"version": *"[^"]+"' "$SRC/extension.json" | head -1 | cut -d'"' -f4)
[ "$V1" = "$V2" ] || { echo "ERROR: conf.yml says $V1 but v2/extension.json says $V2"; exit 1; }

if [ -n "${PANEL_SRC:-}" ]; then
    ln -sfn "$(cd "$PANEL_SRC" && pwd)" "$SRC/.panel"
fi
[ -f "$SRC/.panel/packages/sdk/package.json" ] || { echo "ERROR: no panel 2.x checkout - set PANEL_SRC"; exit 1; }

# Feloldjuk abszolut utra, MIELOTT belepnenk a csomag konyvtaraba.
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
OUT="$OUT_DIR/${NAME}.pteroext"
rm -f "$OUT"

cd "$SRC"
echo "==> Installing dependencies"
npm ci --no-audit --no-fund
echo "==> Typecheck"
npm run typecheck
echo "==> Tests"
npm test
echo "==> Build"
npm run build

echo "==> Packaging $NAME (2.x)"
zip -q "$OUT" extension.json composer.json
for dir in routes database resources dist src vendor; do
    [ -d "$dir" ] || continue
    zip -r -q "$OUT" "$dir" -x '*.map' -x '*.spec.ts' -x '*.spec.tsx' -x '*/.*' -x '*/node_modules/*'
done

unzip -tq "$OUT" >/dev/null || { echo "ERROR: corrupt archive"; rm -f "$OUT"; exit 1; }
unzip -p "$OUT" dist/client.js >/dev/null 2>&1 || { echo "ERROR: dist/client.js is missing"; rm -f "$OUT"; exit 1; }

echo
echo "Built: $OUT ($(du -h "$OUT" | cut -f1), version $V2)"
