# futozs-blueprints

Extensions for [Pterodactyl](https://pterodactyl.io) — for **1.x** through [Blueprint](https://blueprint.zip)
and for **2.x** as native panel extensions, built from the same source.

Each extension lives in its own directory under `extensions/` and is versioned and released
independently, so installing one never drags in the others.

## Extensions

| Extension | Description |
|---|---|
| [serverorganizer](extensions/serverorganizer) | Groups, colours, icons and drag & drop ordering for the client dashboard; primary/backup pairs detected automatically and shown on one card with live state; one-button full-screen restart (primary first, then backup). English and Hungarian UI. |

## Installing

```bash
curl -fsSL https://raw.githubusercontent.com/futozs/futozs-blueprints/main/install.sh -o install.sh
less install.sh                  # read it before you run it
bash install.sh serverorganizer
```

`install.sh` detects the panel's major version and installs the matching package: the `.blueprint`
archive through Blueprint on 1.x, the `.pteroext` archive through `php artisan p:extension:install` on
2.x. On 2.x run it as the panel's web user:

```bash
sudo -u www-data bash install.sh serverorganizer
```

If your panel is not at `/var/www/pterodactyl`:

```bash
PANEL_DIR=/srv/pterodactyl bash install.sh serverorganizer
```

> Piping an installer straight into `bash` means running code you have not read. The two-step form
> above is deliberate.

Prefer doing it by hand? Download the package for your panel from the [releases](../../releases).

Pterodactyl 1.x — drop `<extension>.blueprint` into your panel directory, and run:

```bash
cd /var/www/pterodactyl
blueprint -install serverorganizer
```

Pterodactyl 2.x — no Blueprint needed:

```bash
cd /var/www/pterodactyl
sudo -u www-data php artisan p:extension:install /path/to/serverorganizer.pteroext --enable --replace
```

## Requirements

| | 1.x package (`.blueprint`) | 2.x package (`.pteroext`) |
|---|---|---|
| Pterodactyl | 1.11 or newer (developed against 1.12.1) | 2.0 (developed against `v2.0.0-beta.2`, SDK `2.0.0-beta.6`) |
| Blueprint | `beta-2026-06` | not used |
| Node.js | 22+ (required by Blueprint) | not needed on the server — the archive ships the built bundle |

Both packages share the same database table, so a panel upgraded from 1.x to 2.x keeps every
user's arrangement.

## Building from source

```bash
scripts/build.sh serverorganizer            # -> dist/serverorganizer.blueprint
scripts/build.sh serverorganizer /var/www/pterodactyl
```

`build.sh` runs `check-placeholders.sh` first and refuses to package if it finds a problem.

The 2.x package needs Node 22 and a Pterodactyl 2.x checkout for the SDK, which is not published on
npm:

```bash
git clone --branch v2.0.0-beta.2 https://github.com/pterodactyl/panel.git ../panel-2
(cd ../panel-2 && npm ci && npm run sdk:testing)
PANEL_SRC=../panel-2 scripts/build-v2.sh serverorganizer   # -> dist/serverorganizer.pteroext
```

`build-v2.sh` typechecks, runs the tests, builds the bundle, and refuses to package when the version
in `v2/extension.json` differs from `conf.yml`.

## Adding a new extension

1. Create `extensions/<name>/` with a `conf.yml` at its root — see `extensions/serverorganizer`
   for a working example that covers components, a client API, and a migration.
2. Add a `README.md` in that directory.
3. Add a row to the table above.
4. For a 2.x package, add `extensions/<name>/v2/` with an `extension.json` (see
   `extensions/serverorganizer/v2`). Keep the version equal to `conf.yml`.
5. Release it by pushing a tag shaped `<name>-v<version>`, e.g. `serverorganizer-v1.0.1`.
   The workflow reads the extension name from the tag, packages only that one — the `.blueprint`,
   plus the `.pteroext` when a `v2/` package exists — and publishes them.

## A trap worth knowing about

Blueprint's installer substitutes placeholder tokens — `{mode}`, `{name}`, `{version}`, `{target}`,
`{root}`, `{identifier}` and others — in **every** extension file, including `.tsx`. A JSX expression
like `key={mode}` gets silently rewritten to `key=local`, and the build then fails *after* the
installer has reported success. Comments are rewritten too.

This is worse than it sounds: `yarn build:production` deletes `public/assets/*.js` before building,
so a failed build leaves the panel's frontend unusable until a good build runs.

Rename the variable (`mode` → `sortKey`), or escape it as `!{mode}`. `scripts/check-placeholders.sh`
catches this before packaging, and CI runs it on every release.

## License

MIT — see [LICENSE](LICENSE).
