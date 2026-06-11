# Upgrading

Proxytrace releases follow [semantic versioning](https://semver.org). Release notes for every
version are published on the [GitHub releases page](https://github.com/Proxytrace/Proxytrace/releases).

When a newer release is available, admins see a notice in the app — see
[Update notifications](/admin/configuration#update-notifications) for how that works and how
to disable it.

## Before you upgrade: back up

Database migrations are **forward-only**. Rolling back a release means restoring a database
backup, so take one first:

```bash
docker compose exec postgres pg_dump -U proxytrace proxytrace > proxytrace-backup.sql
```

## Upgrading a Docker Compose installation

The compose file from the release artifact pins exact image versions. To upgrade, edit the
image tags (or download the new release's artifact, which ships them pre-pinned), then:

```bash
docker compose pull
docker compose up -d
```

The `api` container applies any pending database migrations automatically on startup; no
manual migration step exists. Your data lives in named Docker volumes (`pgdata` for the
database, `searchindex` for the search index) and survives the upgrade. The search index is
forward-compatible; if it ever misbehaves after an upgrade it can be rebuilt from
**Settings → Search indexing**.

::: tip Pin versions in production
Prefer pinned tags (`:1.2.3`) over `:latest` in production so upgrades are deliberate. The
rolling tags `:1.2` and `:1` track the newest patch/minor release respectively.
:::

## Rolling back

Restore the backup, then start the previous version:

```bash
docker compose down
docker compose exec -T postgres psql -U proxytrace proxytrace < proxytrace-backup.sql
```

Never run an older application version against a database that a newer version has already
migrated.

## PostgreSQL major versions

The deployment pins PostgreSQL to a major version (`postgres:16-alpine`). A PostgreSQL
**major** upgrade (16 → 17) is never just a tag bump — it requires a dump/restore or
`pg_upgrade`. Proxytrace releases will note when a newer PostgreSQL major is supported;
until then, keep the pinned major.
