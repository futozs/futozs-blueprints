# Server Organizer

Turns the flat server list on the Pterodactyl client dashboard into something you can actually
organise: groups, colours, icons, drag & drop ordering, and primary/backup markers.

Every user organises their own dashboard — there is no central admin configuration to maintain.
The interface is available in **English and Hungarian**, picked from your browser language and
overridable in the toolbar.

## Features

- **Groups** — create, rename, colour, icon and collapse them. Groups can be reordered by dragging.
- **Drag & drop ordering** — move cards within a group or between groups. Dragging switches to
  manual sort automatically, so your arrangement is never silently overwritten by a sort mode.
- **Colours & icons** — per-card accent colour plus a searchable icon set, or your own image URL.
  If the image fails to load it falls back to the icon rather than showing a broken tile.
- **Pair cards (automatic)** — a primary and its backup are shown side by side on one card, with a
  live "2/2 running" badge and a big restart button. Nothing to configure: see below.
- **Sort modes** — custom order, by name, or by **live state** (anything offline or starting comes
  first, so problems are on top).
- **One-button restart** — full-screen view: primary first, the backup only after the primary is
  genuinely serving again. See below.

The extension reuses Pterodactyl's own `ServerRow` component instead of reimplementing it, so live
CPU / RAM / disk readings and everything else keep working exactly as before.

## Pairs are detected, not configured

The role comes from the server's own **Startup `ROLE` variable** (`ROLE=primary|backup bash
.ptero/start.sh`); servers with the same `GIT_ADDRESS` + `BRANCH` form a pair. The extension only
*reads* these — it never edits the startup command or any variable. Change the role in the panel's
Startup tab and the dashboard follows.

A server without a `ROLE` is shown as a plain row, exactly as before.

## Restart

Pressing **Restart** on a pair card opens a full-screen view: two large step cards (PRIMARY → BACKUP)
with live status, CPU / RAM / uptime and the running commit, and a large console underneath. Click a
card to watch that server's console; the active one is followed automatically.

The chain itself is deliberately thin, because the server's `.ptero/start.sh` does the real work
(git, build lock, install, build, migrations, launch on the allocated port):

1. `POST /api/client/servers/{uuid}/power` with `restart` — the primary.
2. Wait for Wings to report the server down and back to `running`. The egg's *done* string is
   `Ready in`, so `running` means Next.js is actually serving. No timers, no regex to maintain.
3. Wait for start.sh's `bemelegítve` line (at most 2 minutes): by then the primary has recorded
   the commit it is running, which the backup will check out.
4. Only then the backup, the same way.

If the primary does not come up, the chain stops and the backup is never touched — it keeps the site
online. **Retry** resumes from the failed step. **Abort** stops the chain (not the server).

The step cards translate start.sh's log lines into large, plain status: *Building…*, *Waiting: another
build*, *Waiting for its peer*, *Migrating database*, *No change — no build*, *Serving*… These are
display only; they never decide success or failure.

Before starting, the screen warns in red when the restart would take the site down (no backup, or
the backup is not running).

## Installing

```bash
bash install.sh serverorganizer
```

See the [repository README](../../README.md) for the full instructions.

## How your data is stored

Settings live in a dedicated `serverorganizer_prefs` table — one row per user, holding a JSON
document with the groups, ordering, colours, icons and language. **No Pterodactyl core table is
touched.**

The client API exposes exactly two endpoints, both scoped to the authenticated user:

```
GET  /api/client/extensions/serverorganizer/prefs
PUT  /api/client/extensions/serverorganizer/prefs
```

Saved documents are validated server-side — shape, field lengths and allowed values — and capped at
256 KB. Image URLs are restricted to `http`/`https` so no other scheme can be smuggled in.

## Uninstalling

```bash
cd /var/www/pterodactyl
blueprint -remove serverorganizer
```

The `serverorganizer_prefs` table is deliberately left in place so your arrangement survives a
reinstall. Drop it manually if you want it gone for good.

## Known limitations

- The organiser hides everything that renders after it on the dashboard — that is how it replaces
  the default list. If another extension adds content below the server list, that content will not
  be visible while the organiser is enabled.
- The live state is polled every 15 seconds for the sort order and the pair badges.

## Upgrading from 3.x

Manual primary/backup markers, the "ready" regular expression and the start-script repair are gone:
roles come from `ROLE`, readiness from Wings, and start.sh owns the start command. Old saved
settings load fine — the obsolete fields are dropped on the next save.

## Adding a language

`components/Organizer/i18n.tsx` holds every string. Add a new entry to `STRINGS`, add the language
to `LANGUAGES`, and extend `detectLang()` if you want it auto-detected. The `en` object is the
source of truth: any key missing from a translation falls back to English rather than showing a
raw key.
