#!/bin/bash
#
# futozs-blueprints installer
#
#   bash install.sh <extension-name>
#   PANEL_DIR=/srv/pterodactyl bash install.sh serverorganizer
#
# Downloads the latest release of one extension and installs it through
# Blueprint. Nothing outside your panel directory is modified, and this script
# never invokes sudo on your behalf.
#
set -euo pipefail

REPO="futozs/futozs-blueprints"
PANEL_DIR="${PANEL_DIR:-/var/www/pterodactyl}"
NAME="${1:-}"

info() { printf '\033[34m==>\033[0m %s\n' "$1"; }
fail() { printf '\033[31mERROR:\033[0m %s\n' "$1" >&2; exit 1; }

if [ -z "$NAME" ]; then
    echo "Usage: bash install.sh <extension-name>"
    echo
    echo "See https://github.com/${REPO} for the list of extensions."
    exit 1
fi

# --- checks ---------------------------------------------------------------

info "Checking your panel at ${PANEL_DIR}"

[ -d "$PANEL_DIR" ] || fail "No such directory: ${PANEL_DIR}. Set PANEL_DIR to your panel path."
[ -f "$PANEL_DIR/artisan" ] || fail "${PANEL_DIR} does not look like a Pterodactyl install (no 'artisan')."
[ -f "$PANEL_DIR/config/app.php" ] || fail "${PANEL_DIR} is missing config/app.php."
[ -w "$PANEL_DIR" ] || fail "No write permission on ${PANEL_DIR}. Run as a user that can write there."

command -v blueprint >/dev/null 2>&1 || fail "Blueprint is not installed. See https://blueprint.zip"
command -v curl >/dev/null 2>&1 || fail "'curl' is required."
command -v unzip >/dev/null 2>&1 || fail "'unzip' is required."

PANEL_VERSION=$(grep -oE "'version' => '[^']+'" "$PANEL_DIR/config/app.php" | head -1 | cut -d"'" -f4 || true)
info "Pterodactyl version: ${PANEL_VERSION:-unknown}"

# --- locate the newest release for this extension -------------------------

# Releases are tagged '<name>-v<version>', so /releases/latest is not usable here:
# it would return whichever extension was released most recently. We list all
# releases (newest first) and pick the first asset belonging to this extension.
info "Looking up the latest ${NAME} release"

ASSET_URL=$(
    curl -fsSL "https://api.github.com/repos/${REPO}/releases" |
        grep -oE "https://github\.com/${REPO}/releases/download/${NAME}-v[^\"]+/${NAME}\.blueprint" |
        head -1 || true
)

if [ -z "$ASSET_URL" ]; then
    fail "No published release found for '${NAME}'. Check the name at https://github.com/${REPO}"
fi

VERSION=$(printf '%s' "$ASSET_URL" | sed -E "s#.*/${NAME}-v([^/]+)/.*#\1#")
info "Found version ${VERSION}"

# --- download -------------------------------------------------------------

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$ASSET_URL" -o "$TMP/${NAME}.blueprint" || fail "Download failed: ${ASSET_URL}"

# A .blueprint file is a zip. If we were handed an HTML error page instead,
# catch it now rather than letting Blueprint choke on a corrupt archive.
unzip -tq "$TMP/${NAME}.blueprint" >/dev/null 2>&1 \
    || fail "The downloaded file is not a valid .blueprint archive."

info "Downloaded ${NAME}.blueprint ($(du -h "$TMP/${NAME}.blueprint" | cut -f1))"

# --- install --------------------------------------------------------------

cp "$TMP/${NAME}.blueprint" "$PANEL_DIR/${NAME}.blueprint"

info "Installing through Blueprint — this rebuilds the frontend and takes a minute or two"
cd "$PANEL_DIR"

if blueprint -install "$NAME"; then
    info "Done. Reload your dashboard."
else
    fail "Blueprint reported a failure. See ${PANEL_DIR}/.blueprint/extensions/blueprint/private/debug/logs.txt"
fi
