# Database Tools

Pterodactyl **2.x** native extension. Adds the tools of the old 1.x database addon to the panel's own
**Databases** page of a server:

- **Size** column — the size of every database (data + indexes), refreshed every 30 seconds.
- **Import** — from an `.sql` file (max. 50 MB), or straight from a remote MySQL / MariaDB database
  (host, port, database, username, password). *Delete all tables and data* empties the database
  first.
- **Export** — downloads the whole database as a `.sql` file (`DROP TABLE` + `CREATE TABLE` +
  `INSERT`s).
- **Clear** — drops every table, after typing the database name to confirm.

The tools need the subuser permission `database.view_password`, the same as on 1.x. Every action is
written to the server's activity log (`server:database.export`, `.import`, `.import-remote`,
`.clear`).

## How it works

The extension overrides the `server.databases` view with a copy of the stock (classic) view taken from
`v2.0.0-beta.2`, plus the Size column and three row buttons (`v2/src/client`). Creating, rotating
passwords and deleting still go through the panel's own model and actions.

The backend (`v2/src`, `v2/routes/server.php`) sits behind the panel's server-scoped client API, so
the `{database}` must belong to the `{server}`:

```
GET  /api/client/servers/{server}/extensions/databasetools/sizes
GET  /api/client/servers/{server}/extensions/databasetools/{database}/export
POST /api/client/servers/{server}/extensions/databasetools/{database}/import
POST /api/client/servers/{server}/extensions/databasetools/{database}/import-remote
POST /api/client/servers/{server}/extensions/databasetools/{database}/clear
```

It connects with the **database host's** credentials: the per-database user is normally restricted
to the server's remote (for example `172.18.%`) and cannot connect from the panel.

## Installing

```bash
sudo -u www-data bash install.sh databasetools
```

or by hand: `sudo -u www-data php artisan p:extension:install databasetools.pteroext --enable --replace`.
See the [repository README](../../README.md) for building from source.

## Differences from the 1.x addon

- On 1.x the addon was patched into the panel core (`ImportExportController`, `DatabaseTransformer`,
  `DatabaseRow.tsx`); here it is a separate package that survives panel updates.
- *Delete all tables and data* is now honoured for file imports too (1.x sent the flag but ignored
  it).
- Sizes come from one request per page instead of one database connection per database in the list
  response.
