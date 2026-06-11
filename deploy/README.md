# Proxytrace — Docker Compose deployment

Runs the full Proxytrace stack: web UI, API, ingestion proxy, Postgres, and Redis.
Images are published to GHCR (`ghcr.io/proxytrace/...`); nothing is built locally.

## Quickstart

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD and PROXYTRACE_SIGNING_KEY (generation hints inside)
docker compose up -d
```

Open http://localhost:5101 and follow the first-run setup. The user & operator manual
is served at http://localhost:5101/docs.

Point your agents' OpenAI base URL at the ingestion proxy to start capturing traces:
`http://localhost:5102/openai/v1`

## Upgrading

```bash
# back up first: docker compose exec postgres pg_dump -U proxytrace proxytrace > backup.sql
docker compose pull
docker compose up -d
```

Database migrations apply automatically on startup. See the manual's
[Upgrading](http://localhost:5101/docs/admin/upgrading.html) page for details.

## License

Without `PROXYTRACE_LICENSE` set, Proxytrace runs the Free tier. Enter your license
key in `.env` and run `docker compose up -d` to apply it.
