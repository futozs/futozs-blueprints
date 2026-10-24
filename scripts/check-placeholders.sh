#!/bin/bash
#
# Blueprint placeholder collision check.
#
#   scripts/check-placeholders.sh extensions/serverorganizer
#
# Blueprint's installer substitutes tokens like {mode}, {name} and {version} in
# EVERY extension file, including .tsx. A JSX expression such as key={mode} is
# silently rewritten, and the build then fails *after* the installer has already
# reported success. Worse, `yarn build:production` wipes public/assets before
# building, so a failed build leaves the panel's frontend broken.
#
# Catching it here is far cheaper than catching it in a broken panel.
#
set -uo pipefail

TARGET="${1:-.}"

TOKENS="appcontext author engine fs identifier is mode name random root target timestamp version viewcontext webroot"

FAILED=0
for TOKEN in $TOKENS; do
    HITS=$(grep -rn \
        --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js' \
        --exclude-dir=node_modules --exclude-dir=v2 \
        "{${TOKEN}}" "$TARGET" 2>/dev/null || true)

    if [ -n "$HITS" ]; then
        echo "!! '{${TOKEN}}' collides with a Blueprint placeholder:"
        echo "$HITS"
        FAILED=1
    fi
done

if [ "$FAILED" -ne 0 ]; then
    echo
    echo "Rename the variable (e.g. 'mode' -> 'sortKey'), or escape it as !{mode}."
    echo "This applies to comments too — they get rewritten just the same."
    exit 1
fi

echo "No placeholder collisions."
