# Enterprise support key

**Every feature of Proxytrace is included on every installation, with no limits and no key.**
There is nothing to unlock: optimization proposals, Tracey, agentic evaluators, scheduled runs,
custom anomaly detectors, cost budgets, test-case synthesis, SSO and the audit log all work out
of the box, and projects, users, agents, test suites and monthly traces are unlimited.

The only thing a key does is **record an Enterprise support contract**. If you hold one, activate
the key so the installation shows the contract (a crowned **Enterprise support** chip in the top
bar and the details under **Settings → Enterprise support**). If you don't, ignore this page —
nothing changes.

## Source availability

Proxytrace's source code is public at
[github.com/NordsteinSoftware/Proxytrace](https://github.com/NordsteinSoftware/Proxytrace) under the
[PolyForm Shield 1.0.0](https://github.com/NordsteinSoftware/Proxytrace/blob/master/LICENSE)
license: you may use, copy, modify and redistribute it for any purpose — personal, academic,
commercial and internal business use alike. The single restriction is that you may not offer a
product or service that competes with Proxytrace. The software comes with no warranty and no
support obligation; support is what an Enterprise contract adds.

## Activating a support key

There are two ways to supply the key; both accept the same token (a JWT):

1. **Settings → Enterprise support** (admins) — paste the key, **Validate** it (a dry run that
   shows the contract holder and expiry it would record), then **Activate**. The key is verified
   offline, stored in the database, and applied **immediately — no restart**. The same page shows
   the current status, where the active key came from, and offers **Re-check now** (force a
   license-server check) and **Remove stored key**.
2. **`PROXYTRACE_LICENSE` environment variable** — set it in the deployment `.env` and restart.
   Useful for infrastructure-as-code setups.

### Precedence

A key activated in the UI is stored in the database and **takes precedence** over the
`PROXYTRACE_LICENSE` environment variable. Removing the stored key (Settings → Enterprise support →
*Remove stored key*) falls back to the environment-supplied key, or to "no contract" when none
is set.

## An invalid key never blocks anything

If a configured key fails validation — malformed, signed with an unknown key, issued for the wrong
audience, or already expired — Proxytrace **still starts and runs exactly as before**; only the
recorded status becomes **Invalid**. A red banner appears above the top bar with the rejection
reason and a link to **Settings → Enterprise support**, where an admin can paste a corrected key —
no container restart needed.

The reason is one of `Malformed`, `BadSignature`, `WrongIssuer`, `WrongAudience`, `Expired`, or
`MissingClaim`.

::: tip
The token is trimmed before validation, so surrounding whitespace is tolerated, but embedded
newlines from a bad copy/paste are a common cause of `Malformed`. Paste the JWT as a single
unbroken line.
:::

::: info Keys issued before 1.12
Keys issued while Proxytrace still had feature tiers carry feature and limit claims. They keep
validating; the extra claims are ignored (a warning is logged once at activation).
:::

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PROXYTRACE_LICENSE` | The support key (a JWT). Trimmed before use. Takes precedence over the `Licensing:License` appsettings value, but a key activated in the UI (stored in the database) overrides both. Unset (and no config value) → no contract recorded. | _unset_ |
| `PROXYTRACE_LICENSE_SERVER_URL` | Override the license server base URL. **Debug builds only** — Release builds ignore this and always use the default. | `https://license.proxytrace.dev` |
| `PROXYTRACE_LICENSE_PUBLIC_KEY` | Override the signature-verification public keys (comma-separated, base64). **Debug builds only** — Release builds use the keys baked into the binary. | _embedded keys_ |
| `PROXYTRACE_LICENSE_CACHE_PATH` | Path to the offline status cache file. | `$PROXYTRACE_DATA_DIR/license-cache.json` when `PROXYTRACE_DATA_DIR` is set (the Docker deployment's `appdata` volume), else `<LocalApplicationData>/proxytrace/license-cache.json` |

::: warning Release builds ignore the Debug-only overrides
`PROXYTRACE_LICENSE_SERVER_URL` and `PROXYTRACE_LICENSE_PUBLIC_KEY` exist only to support local
development and testing. In a Release build they are ignored entirely; the license server URL and
public keys are fixed at compile time.
:::

### appsettings

These values live in `Proxytrace.Api/appsettings.json` under the `Licensing` section:

```json
{
  "Licensing": {
    "License": "eyJ...",
    "ServerCheckEnabled": true,
    "CheckIntervalHours": 24,
    "OfflineGracePeriodDays": 7
  }
}
```

- `License` — the support key (a JWT), as an alternative to the `PROXYTRACE_LICENSE` environment
  variable. The environment variable **wins** when both are set. Intended mainly for local
  debugging — set it in `appsettings.local.json` (which is git-ignored) rather than committing a
  token.
- `ServerCheckEnabled` — **Debug builds only.** Whether the background service contacts the
  license server for periodic revocation checks. When `false`, the startup snapshot is kept as-is
  and **no network calls** are made. Defaults to `false` in Debug. **Release builds ignore this
  setting entirely and always perform the server check.**
- `CheckIntervalHours` — how often the running app re-validates the key against the license
  server. Default **24**.
- `OfflineGracePeriodDays` — how long the app keeps reporting the contract as active on its
  last-known-good status when the license server is unreachable. Default **7**.

## Trace retention

Retention is purely the `AgentCallCleanup:RetentionDurationDays` setting (default **30** days) —
see [Configuration](/admin/configuration). It is not tied to the support key.

## Air-gapped and offline operation

Proxytrace contacts the license server (`https://license.proxytrace.dev`) **on startup** and then
**every 24 hours** (`CheckIntervalHours`) to confirm the key is still valid and has not been
revoked. Signature verification itself is fully offline — it never needs the network — so the
periodic check is only about revocation.

If the license server cannot be reached, the recorded status continues from the last known-good
result for the **7-day offline grace period** (`OfflineGracePeriodDays`):

| Time since last successful check | What you see |
|---|---|
| Within 7 days | Status **Active**. |
| Grace period active | Status **Active**, plus an amber **grace banner** warning that the key has not been re-validated. |
| After 7 days | Status **Expired**. Nothing stops working — only the recorded contract lapses. |

If the server explicitly reports the key as **revoked**, the status changes immediately rather
than waiting out the grace period.

The last-known-good status is persisted to the cache file (`PROXYTRACE_LICENSE_CACHE_PATH`) so
that a restart during an outage does not reset the grace window. For a permanently disconnected
install, ask for an **offline-only key** (below).

### Offline-only keys

For genuinely air-gapped installs, Proxytrace supports an **offline-only key**: one that is
**never** checked against the license server, so it needs no outbound connectivity at all. It
activates exactly like a normal key.

- **No server contact, ever.** The periodic 24-hour check and the offline grace window do not
  apply. The settings page shows an "offline key" note and hides **Re-check now**.
- **Expiry is the only thing that ends it.** The key records the contract until its built-in
  expiry date, then shows **Expired**. Offline keys are capped at **365 days**.
- **It cannot be revoked.** Because the install never calls home, key rotation does not retire it
  early. Treat it as a bearer credential and prefer the shortest lifetime that fits your renewal
  cadence.

## Buying support

Enterprise support contracts — and offline keys for air-gapped installs — are available from the
Proxytrace website:

- **Support & pricing:** <https://proxytrace.dev/#pricing>

## Key-rotation FAQ

Proxytrace verifies key signatures against a set of public keys embedded in the binary. A key is
accepted if **any** active public key validates its signature. This lets signing keys rotate
without invalidating keys already in the field, using a staged dual-key release playbook:

- **Release N — introduce the new key.** Ship a build that trusts **both** the current key and
  the next key. Existing support keys keep validating.
- **Release N+1 — sign with the new key.** New support keys are signed by the new key; builds
  still trust both.
- **Release N+2 — retire the old key.** Once outstanding keys have been re-issued, ship a build
  that trusts **only** the new key.

**Q: I upgraded Proxytrace and now my key is rejected with `BadSignature`.**
Your key was likely signed with a public key the new build no longer trusts (you skipped past
Release N+2 of a rotation). Obtain a re-issued key — see [Buying support](#buying-support). Nothing
in the product is affected in the meantime.

## Related

- [Configuration](/admin/configuration) — settings files and environment variables.
- [Installation](/admin/installation) — getting Proxytrace running.
