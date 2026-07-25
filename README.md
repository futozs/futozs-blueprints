# futozs-blueprints

[Blueprint](https://blueprint.zip) extensions for [Pterodactyl](https://pterodactyl.io).

Each extension lives in its own directory under `extensions/` and is versioned and released
independently, so installing one never drags in the others.

## Extensions

| Extension | Description |
|---|---|
| [serverorganizer](extensions/serverorganizer) | Groups, colours, icons, drag & drop ordering and primary/backup markers for the client dashboard, plus chained restart for redundant pairs. English and Hungarian UI. |

## Installing

```bash
curl -fsSL https://raw.githubusercontent.com/futozs/futozs-blueprints/main/install.sh -o install.sh
less install.sh                  # read it before you run it
bash install.sh serverorganizer
```

If your panel is not at `/var/www/pterodactyl`:

```bash
PANEL_DIR=/srv/pterodactyl bash install.sh serverorganizer
```

> Piping an installer straight into `bash` means running code you have not read. The two-step form
> above is deliberate.

Prefer doing it by hand? Download `<extension>.blueprint` from the
[releases](../../releases), drop it into your panel directory, and run:

```bash
cd /var/www/pterodactyl
blueprint -install serverorganizer
```

## Requirements

| | |
|---|---|
| Pterodactyl | 1.11 or newer (developed against 1.12.1) |
| Blueprint | `beta-2026-06` |
| Node.js | 22+ (required by Blueprint) |

## Building from source

```bash
scripts/build.sh serverorganizer            # -> dist/serverorganizer.blueprint
scripts/build.sh serverorganizer /var/www/pterodactyl
```

`build.sh` runs `check-placeholders.sh` first and refuses to package if it finds a problem.

## Adding a new extension

1. Create `extensions/<name>/` with a `conf.yml` at its root — see `extensions/serverorganizer`
   for a working example that covers components, a client API, and a migration.
2. Add a `README.md` in that directory.
3. Add a row to the table above.
4. Release it by pushing a tag shaped `<name>-v<version>`, e.g. `serverorganizer-v1.0.1`.
   The workflow reads the extension name from the tag, packages only that one, and publishes it.

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
