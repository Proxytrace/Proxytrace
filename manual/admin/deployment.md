# Deployment

Proxytrace is self-hosted via Docker Compose. There are two deployment shapes.

For production installs, use the **released images** (`ghcr.io/proxytrace/proxytrace-*`) with
the pinned compose file shipped on every [GitHub release](https://github.com/Proxytrace/Proxytrace/releases)
— see [Installation](/admin/installation). The commands below build the same shapes from a
source checkout.

## Standard (split) deployment

The default `docker-compose.yml` runs the app split into services:

```bash
docker compose up --build      # API on :5100, frontend on :5101
```

In this shape the **frontend is served by a separate nginx container**
(`frontend/Dockerfile` + `frontend/nginx.conf`), which proxies `/api` to the API container.
A **Redis** event broker carries real-time updates between the ingestion proxy and the app.

## Kiosk (single-process) deployment

Kiosk mode runs the app as a single process — the **.NET API serves the compiled frontend
from its `wwwroot/`** and no Redis is required. Useful for demos and simple installs.

```bash
docker compose -f docker-compose.kiosk.yml up --build   # API on :5200, frontend on :5201
```

Locally, `./dev.sh` runs the kiosk shape by default; `SPLIT=1 ./dev.sh` runs the split
shape with a throwaway Redis.

## The bundled manual (`/docs`)

This manual is built (VitePress) into the same web root the app serves and is reachable at
**`/docs`** in both deployment shapes:

- **Kiosk** — the manual is copied into `Proxytrace.Api/wwwroot/docs` and served by the
  API's static file middleware.
- **Split / nginx** — the manual is built into the nginx image at
  `/usr/share/nginx/html/docs`.

Both serve paths apply a strict Content-Security-Policy. The `/docs` path is configured to
allow exactly what the static manual needs, so it loads without CSP violations while the
app itself keeps its strict policy.

::: warning Deep links
The manual is built with file extensions kept (`cleanUrls: false`) so that requests like
`/docs/admin/database.html` resolve to real files and are not captured by the SPA's
catch-all route. Keep this setting if you customize the build.
:::

## Health & security headers

The API sets security headers (CSP, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`) on every response; the nginx config mirrors them
for the split deployment. See [Configuration](/admin/configuration).
