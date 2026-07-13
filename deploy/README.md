# Proxytrace — Docker Compose deployment

Runs the full Proxytrace stack: web UI, API, ingestion proxy, Postgres, and Redis.
Images are published to GHCR (`ghcr.io/proxytrace/...`); nothing is built locally. The same
images are mirrored on Docker Hub (`jabbakadabra/proxytrace-...`) — to pull from there
instead, replace the `ghcr.io/proxytrace/` prefix in `docker-compose.yml` with
`jabbakadabra/`.

## Quickstart

```bash
docker compose up -d
```

That's it — no `.env` required. Open http://localhost:5101 and follow the first-run
setup. The user & operator manual is served at http://localhost:5101/docs.

Point your agents' OpenAI base URL at the ingestion proxy to start capturing traces:
`http://localhost:5102/openai/v1`

## Configuration (optional)

Every setting has a working default. To override (ports, public URL, your own
database password — recommended for production):

```bash
cp .env.example .env
# edit .env, then:
docker compose up -d
```

The session signing key is generated on first start and persisted in the `appdata`
volume; logins survive restarts and upgrades without any configuration.

## Upgrading

```bash
# back up first: docker compose exec postgres pg_dump -U proxytrace proxytrace > backup.sql
docker compose pull
docker compose up -d
```

Database migrations apply automatically on startup. See the manual's
[Upgrading](http://localhost:5101/docs/admin/upgrading.html) page for details.

## License

Without a license, Proxytrace runs the Free tier. To activate a license key, either:

- enter it during the first-run setup wizard or under **Settings → License** (stored
  in the database, applies immediately — no restart), or
- set `PROXYTRACE_LICENSE` in `.env` and run `docker compose up -d`.

A key activated in the UI takes precedence over the environment variable.
