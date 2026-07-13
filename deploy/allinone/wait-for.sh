#!/usr/bin/env bash
# Block until a dependency is reachable, then exec the real process.
#
#   wait-for.sh tcp  <host> <port> -- <cmd...>     # database socket accepts connections
#   wait-for.sh http <url>         -- <cmd...>     # endpoint answers 2xx
#
# supervisord starts programs in priority order but never waits for readiness, so this is what
# keeps the API off a database that is still initialising and the proxy off an API that has not
# applied its migrations yet. It gives up after the timeout and execs anyway: a supervised
# process that then fails fast and gets restarted is a better outcome than one that hangs here
# forever with no logs.
set -euo pipefail

TIMEOUT_SECONDS=${WAIT_FOR_TIMEOUT_SECONDS:-120}

mode=$1
shift

case "$mode" in
  tcp)
    host=$1 port=$2
    shift 2
    probe() { (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null; }
    what="$host:$port"
    ;;
  http)
    url=$1
    shift
    probe() { curl -fsS -o /dev/null --max-time 3 "$url"; }
    what="$url"
    ;;
  *)
    echo "wait-for.sh: unknown mode '$mode'" >&2
    exit 64
    ;;
esac

[[ ${1:-} == "--" ]] || { echo "wait-for.sh: expected -- before the command" >&2; exit 64; }
shift

deadline=$((SECONDS + TIMEOUT_SECONDS))
until probe; do
  if ((SECONDS >= deadline)); then
    echo "[proxytrace] $what still unreachable after ${TIMEOUT_SECONDS}s — starting anyway" >&2
    break
  fi
  sleep 1
done

exec "$@"
