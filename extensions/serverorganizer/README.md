# Server Organizer

Turns the flat server list on the Pterodactyl client dashboard into something you can actually
organise: groups, colours, icons, drag & drop ordering, and primary/backup markers.

Every user organises their own dashboard — there is no central admin configuration to maintain.
The interface is available in **English and Hungarian**, picked from your browser language and
overridable in the toolbar.

## Features

- **Groups** — create, rename, colour, icon and collapse them. Groups can be reordered by dragging.
- **Drag & drop ordering** — move servers within a group or between groups. Dragging switches to
  manual sort automatically, so your arrangement is never silently overwritten by a sort mode.
- **Colours & icons** — per-server accent colour plus a searchable 87-icon set, or your own image
  URL. If the image fails to load it falls back to the icon rather than showing a broken tile.
- **Primary / backup markers** — flag a server and get a small badge on its icon.
- **Sort modes** — manual, by name, by status, or by role.
- **Chained restart for redundant pairs** — one button restarts the backup first and only
  promotes to the primary once the backup is genuinely back up. See below.

The extension reuses Pterodactyl's own `ServerRow` component instead of reimplementing it, so live
CPU / RAM / disk readings and everything else keep working exactly as before.

## Chained restart

Mark one server in a group as **primary** and another as **backup**, and a restart button appears on
the group header. Pressing it restarts the backup first; the primary follows only if the backup came
back up *and stayed up*. If the backup fails, the chain stops and the primary is never touched — the
two are never down at the same time.

Throughout, you see the live console output, the current phase, and a countdown of how long the
server has been stable.

**What counts as success:** the server must reach Pterodactyl's `running` state and then stay there
for a configurable window (30 seconds by default). This deliberately catches the case where an app
starts, prints that it is ready, and dies moments later — a plain "is it running" check would call
that a success and restart your primary on top of a dead backup.

**Failure detection** additionally watches the console for known signatures: failed `git pull`
(merge conflicts, untracked files that would be overwritten), broken `package.json`, ports already in
use, and common Node crashes. The patterns live in `components/Organizer/Redundancy/patterns.ts` —
add your own if your stack prints something different. A missing pattern is not dangerous: the
stability window still catches a crash. An over-broad pattern is worse, which is why the defaults
match specific lines rather than the word "error".

**Repairs.** When a `package.json` or port problem is detected, the panel offers a fix rather than
acting on its own:

- *Fix port* — rewrites the `start` script using the port **Pterodactyl itself allocated** to that
  server, so you never type a port by hand. A copy of the file is kept first.
- *Delete package.json* — for pull conflicts, behind an explicit second click and a warning. Only
  useful if the file is committed in your repository, since the next pull has to restore it.

A `package.json` that is not valid JSON is deliberately **never** rewritten from scratch: doing so
would silently destroy your dependency list.

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
- The *status* sort uses the server's suspended / installing state, not its live power state. Live
  state is fetched per row and is not available at the list level.

## Adding a language

`components/Organizer/i18n.tsx` holds every string. Add a new entry to `STRINGS`, add the language
to `LANGUAGES`, and extend `detectLang()` if you want it auto-detected. The `en` object is the
source of truth: any key missing from a translation falls back to English rather than showing a
raw key.
