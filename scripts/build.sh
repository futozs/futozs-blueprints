#!/bin/bash
#
# Package one extension into an installable .blueprint archive.
#
#   scripts/build.sh serverorganizer [output-dir]
#
# The archive is a plain zip whose ROOT must contain conf.yml — that is what
# Blueprint reads first.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${1:-}"
OUT_DIR="${2:-$REPO_ROOT/dist}"

if [ -z "$NAME" ]; then
    echo "Usage: scripts/build.sh <extension-name> [output-dir]"
    echo
    echo "Available extensions:"
    for dir in "$REPO_ROOT"/extensions/*/; do
        [ -d "$dir" ] && echo "  - $(basename "$dir")"
    done
    exit 1
fi

SRC="$REPO_ROOT/extensions/$NAME"

[ -d "$SRC" ] || { echo "ERROR: no such extension: $NAME"; exit 1; }
[ -f "$SRC/conf.yml" ] || { echo "ERROR: $SRC is missing conf.yml"; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "ERROR: 'zip' is required."; exit 1; }

echo "==> Checking for Blueprint placeholder collisions"
"$REPO_ROOT/scripts/check-placeholders.sh" "$SRC" || exit 1

echo "==> Packaging $NAME"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/${NAME}.blueprint"
rm -f "$OUT"

# Zip from inside the extension directory so conf.yml lands at the archive root.
cd "$SRC" || exit 1
zip -r -q "$OUT" . -x '*.DS_Store' -x '__MACOSX/*' -x '.dist/*' || {
    echo "ERROR: packaging failed"
    exit 1
}

echo "==> Verifying archive"
unzip -tq "$OUT" >/dev/null || { echo "ERROR: corrupt archive"; rm -f "$OUT"; exit 1; }
unzip -p "$OUT" conf.yml >/dev/null 2>&1 || {
    echo "ERROR: conf.yml is not at the archive root"
    rm -f "$OUT"
    exit 1
}

VERSION=$(grep -oE 'version: *"[^"]+"' "$SRC/conf.yml" | head -1 | cut -d'"' -f2)
echo
echo "Built: $OUT ($(du -h "$OUT" | cut -f1), version ${VERSION:-unknown})"
