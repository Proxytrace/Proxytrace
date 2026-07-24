#!/usr/bin/env bash
# Boot sequence for the all-in-one image: resolve configuration, prepare /data, initialise the
# embedded Postgres cluster on first start, then hand the five processes to supervisord.
#
# Embedded Postgres/Redis are a convenience for `docker run`, not a requirement: set
# ConnectionStrings__Default or Redis__ConnectionString and the matching embedded service is
# simply not started (what deploy/docker-compose.yml does — it runs managed postgres/redis
# containers so they can be backed up and upgraded on their own).
set -euo pipefail

PG_BIN=/usr/lib/postgresql/16/bin
PGDATA=${PGDATA:-/data/pgdata}
APPDATA=${PROXYTRACE_DATA_DIR:-/data/appdata}
INDEX_DIR=${Search__IndexPath:-/data/searchindex}
REDIS_DIR=/data/redis

log() { echo "[proxytrace] $*"; }

# ── Configuration ──────────────────────────────────────────────────────────────────────
# Anything the operator already set wins; the rest gets a working single-container default.
embed_postgres=false
if [[ -z "${ConnectionStrings__Default:-}" ]]; then
  embed_postgres=true
  # Loopback-only cluster with trust auth (see initdb below) — the password is irrelevant to
  # it and only present because Npgsql wants a complete connection string.
  export ConnectionStrings__Default="Host=127.0.0.1;Port=5432;Database=proxytrace;Username=proxytrace;Password=proxytrace"
fi

embed_redis=false
if [[ -z "${Redis__ConnectionString:-}" ]]; then
  embed_redis=true
  export Redis__ConnectionString="127.0.0.1:6379"
fi

# The API and the proxy are separate processes even in one container, so the ingestion queue
# still goes through Redis rather than the in-process transport.
export Messaging__Provider=${Messaging__Provider:-Redis}
export Authentication__Mode=${Authentication__Mode:-Local}
export Kiosk__Enabled=${Kiosk__Enabled:-false}
# What the browser opens, and what the UI advertises to agents as their OpenAI base URL.
# Override both when you publish other host ports or front the container with a real domain.
export Self__BaseUrl=${Self__BaseUrl:-${PROXYTRACE_PUBLIC_URL:-http://localhost:5101}}
export Frontend__AllowedOrigin=${Frontend__AllowedOrigin:-$Self__BaseUrl}
export Proxy__PublicBaseUrl=${Proxy__PublicBaseUrl:-${PROXYTRACE_PROXY_PUBLIC_URL:-http://localhost:5102}}

# Where the API waits for the database before applying migrations. For an external database
# this is parsed back out of the connection string; an unparseable one just skips the wait and
# lets the API's own connection retry handle it.
db_host=$(sed -n 's/.*[Hh]ost=\([^;]*\).*/\1/p' <<<"$ConnectionStrings__Default")
db_port=$(sed -n 's/.*[Pp]ort=\([^;]*\).*/\1/p' <<<"$ConnectionStrings__Default")
db_port=${db_port:-5432}

# ── /data ──────────────────────────────────────────────────────────────────────────────
mkdir -p "$APPDATA" "$INDEX_DIR"
chown -R app:app "$APPDATA" "$INDEX_DIR"

if [[ "$embed_postgres" == true ]]; then
  mkdir -p "$PGDATA"
  chown postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"

  # initdb refuses a non-empty directory, so PG_VERSION is the "already a cluster" marker —
  # on an existing volume (a restart, or an upgrade to a newer image) we leave it untouched
  # and the API migrates the schema forward on startup.
  if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
    log "initialising the embedded Postgres cluster in $PGDATA"
    # Trust auth is safe here: the cluster listens on loopback inside this container only, so
    # anything that could authenticate to it can already read the app's own secrets.
    su postgres -c "$PG_BIN/initdb -D '$PGDATA' -U proxytrace --encoding=UTF8 --locale=C.UTF-8 --auth-local=trust --auth-host=trust" >/dev/null
    su postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' -o '-c listen_addresses=127.0.0.1' -w start" >/dev/null
    su postgres -c "$PG_BIN/createdb -h 127.0.0.1 -U proxytrace proxytrace"
    su postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' -m fast -w stop" >/dev/null
    log "Postgres cluster ready"
  fi
fi

if [[ "$embed_redis" == true ]]; then
  mkdir -p "$REDIS_DIR"
  chown redis:redis "$REDIS_DIR"
fi

# ── Process table ──────────────────────────────────────────────────────────────────────
# supervisord's priority only orders *starts*, it does not wait for readiness — so the API
# gates on the database being connectable and the proxy gates on the API being healthy (it
# reads a schema the API's migrations create).
conf=/etc/supervisor/conf.d/proxytrace.conf
: >"$conf"

# Only program sections go here — the [supervisord] section stays in the packaged
# /etc/supervisor/supervisord.conf, which already includes this directory.
emit() { cat >>"$conf"; }

if [[ "$embed_postgres" == true ]]; then
  emit <<EOF
[program:postgres]
command=$PG_BIN/postgres -D $PGDATA -c listen_addresses=127.0.0.1
user=postgres
priority=10
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF
fi

if [[ "$embed_redis" == true ]]; then
  emit <<EOF

[program:redis]
command=/usr/bin/redis-server --bind 127.0.0.1 --dir $REDIS_DIR --save 60 1000
user=redis
priority=10
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF
fi

emit <<EOF

[program:api]
command=/usr/local/bin/wait-for.sh tcp $db_host $db_port -- dotnet /opt/proxytrace/api/Proxytrace.Api.dll
directory=/opt/proxytrace/api
user=app
priority=20
autorestart=true
# supervisord does not derive HOME from user=, and the .NET host wants one it can write to.
environment=ASPNETCORE_URLS="http://127.0.0.1:8080",HOME="/tmp",DOTNET_CLI_TELEMETRY_OPTOUT="1"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:proxy]
command=/usr/local/bin/wait-for.sh http http://127.0.0.1:8080/api/health -- dotnet /opt/proxytrace/proxy/Proxytrace.Proxy.Api.dll
directory=/opt/proxytrace/proxy
user=app
priority=30
autorestart=true
environment=ASPNETCORE_URLS="http://0.0.0.0:8081",HOME="/tmp",DOTNET_CLI_TELEMETRY_OPTOUT="1"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
priority=30
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

log "starting (postgres embedded: $embed_postgres, redis embedded: $embed_redis)"
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf -n
