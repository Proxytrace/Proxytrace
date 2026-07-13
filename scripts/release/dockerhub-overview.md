# Proxytrace

**Trace, test and improve your AI agents.** Proxytrace captures every LLM call your agents
make, turns real traces into regression suites, and closes the loop with evidence-backed
optimization proposals. Self-hosted, runs entirely on your own infrastructure.

- Website: <https://proxytrace.dev>
- Source & releases: <https://github.com/Proxytrace/Proxytrace>
- Docs: served at `/docs` in every install

## The images

Proxytrace is a three-image stack; they are versioned and released together, so always run
matching tags.

| Image | Role |
|-------|------|
| `jabbakadabra/proxytrace-api` | Application API, background jobs, MCP endpoint |
| `jabbakadabra/proxytrace-proxy` | OpenAI-compatible ingestion proxy your agents point at |
| `jabbakadabra/proxytrace-frontend` | Web UI (nginx) |

These are mirrors of the canonical images on GitHub Container Registry
(`ghcr.io/proxytrace/proxytrace-{api,proxy,frontend}`) — identical digests, same tags.

**Tags:** `X.Y.Z` (immutable, pin this in production), plus rolling `X.Y`, `X` and `latest`.
Prereleases (`X.Y.Z-rc.N`) publish only their exact version.

**Platforms:** `linux/amd64`, `linux/arm64`.

## Running it

Don't wire these up by hand — every [GitHub release](https://github.com/Proxytrace/Proxytrace/releases)
ships a `proxytrace.zip` with a pinned Docker Compose file (app + Postgres + Redis) and an
`.env` template:

```bash
curl -fLO https://github.com/Proxytrace/Proxytrace/releases/latest/download/proxytrace.zip
unzip proxytrace.zip && cd proxytrace-<version>
docker compose up -d        # no .env required — see .env.example for overrides
```

Then open <http://localhost:5101> and follow the first-run setup. To pull from Docker Hub
instead of GHCR, replace the `ghcr.io/proxytrace/` image prefix in the compose file with
`jabbakadabra/`.

Point your agent's OpenAI base URL at `http://localhost:5102/openai/v1` and traces stream
into the UI in real time.

## License

Proprietary — see [LICENSE](https://github.com/Proxytrace/Proxytrace/blob/master/LICENSE).
A free tier is built in; paid tiers unlock higher limits and additional features.
