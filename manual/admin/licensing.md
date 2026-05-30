# Licensing

Proxytrace ships with a built-in licensing subsystem that gates premium features and
enforces tier limits. **You do not need a license to run Proxytrace** — it runs on the
**Free** tier out of the box.

## Free by default

If the `PROXYTRACE_LICENSE` environment variable is unset, Proxytrace starts on the **Free**
tier with no further configuration. The Free tier allows:

- **1** project
- **3** users
- **14-day** trace retention
- **10,000** traces per month

On startup you will see an informational log line confirming the tier, for example:

```
info: Proxytrace.Licensing.LicenseService[0]
      No license configured — running in Free tier.
```

To unlock higher limits and premium features, set `PROXYTRACE_LICENSE` to an Enterprise
license token (see [Where to buy](#where-to-buy)).

## An invalid license stops startup

::: danger A malformed or invalid license is fatal
If `PROXYTRACE_LICENSE` is **set** but the token is invalid — malformed, signed with an
unknown key, issued for the wrong audience, or already expired — Proxytrace **refuses to
start**. The host process logs the failure and exits with a **non-zero exit code**. This is
deliberate: a broken license must never silently downgrade a paying deployment to Free.
:::

The error looks like this in the logs:

```
fail: Proxytrace.Licensing.LicenseService[0]
      Invalid PROXYTRACE_LICENSE (reason: BadSignature) — refusing to start.
Unhandled exception. Proxytrace.Licensing.Exceptions.InvalidLicenseException: The configured license is invalid (BadSignature).
```

The `reason` is one of `Malformed`, `BadSignature`, `WrongIssuer`, `WrongAudience`,
`Expired`, or `MissingClaim`.

### Recovery

1. Inspect the logs to read the failure reason:

   ```bash
   docker logs proxytrace
   ```

2. Then either:
   - **Fix the license** — correct the `PROXYTRACE_LICENSE` value (re-copy the token,
     remove stray whitespace or line breaks, or obtain a current token if it expired) and
     restart the container; or
   - **Run Free** — unset `PROXYTRACE_LICENSE` entirely and restart. With no license
     configured, Proxytrace boots on the Free tier and serves normally.

::: tip
The token is trimmed before validation, so surrounding whitespace is tolerated, but
embedded newlines from a bad copy/paste are a common cause of `Malformed`. Paste the JWT as
a single unbroken line.
:::

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PROXYTRACE_LICENSE` | The license token (a JWT). Trimmed before use. Unset → Free tier. | _unset_ |
| `PROXYTRACE_LICENSE_SERVER_URL` | Override the license server base URL. **Debug builds only** — Release builds ignore this and always use the default. | `https://license.proxytrace.dev` |
| `PROXYTRACE_LICENSE_PUBLIC_KEY` | Override the signature-verification public keys (comma-separated, base64). **Debug builds only** — Release builds use the keys baked into the binary. | _embedded keys_ |
| `PROXYTRACE_LICENSE_CACHE_PATH` | Path to the offline license-status cache file. | `<LocalApplicationData>/proxytrace/license-cache.json` |

::: warning Release builds ignore the Debug-only overrides
`PROXYTRACE_LICENSE_SERVER_URL` and `PROXYTRACE_LICENSE_PUBLIC_KEY` exist only to support
local development and testing. In a Release build they are ignored entirely; the license
server URL and public keys are fixed at compile time.
:::

### appsettings

Two non-secret tuning values live in `Proxytrace.Api/appsettings.json` under the
`Licensing` section:

```json
{
  "Licensing": {
    "CheckIntervalHours": 24,
    "OfflineGracePeriodDays": 7
  }
}
```

- `CheckIntervalHours` — how often the running app re-validates the license against the
  license server. Default **24**.
- `OfflineGracePeriodDays` — how long the app keeps operating on its last-known-good license
  status when the license server is unreachable, before downgrading to Free. Default **7**.

## Tiers

| | Free | Enterprise |
|---|---|---|
| Projects | 1 | Unlimited |
| Users | 3 | Unlimited |
| Traces / month | 10,000 | Unlimited |
| Trace retention | 14 days | 365 days |
| Optimization Proposals | — | Yes |
| Agentic Evaluators | — | Yes |
| Custom Evaluators | — | Yes |
| SSO (OIDC) | — | Yes |
| Audit Log | — | Yes |

::: tip Keep this table in sync
The authoritative limits and feature sets live in
`Proxytrace.Licensing/LicensePolicy.cs`. If that file changes, update this table to match.
:::

When you exceed a Free-tier limit (for example, trying to create a second project or invite
a fourth user), the request is rejected. When you access a premium feature without a license
that includes it, the API responds with HTTP **402** and the UI shows an upgrade prompt.

## Air-gapped and offline operation

Proxytrace contacts the license server (`https://license.proxytrace.dev`) **on startup** and
then **every 24 hours** (`CheckIntervalHours`) to confirm the license is still valid and has
not been revoked. Signature verification itself is fully offline — it never needs the
network — so the periodic check is only about revocation and updated entitlements.

If the license server cannot be reached, the app continues normally using its last
known-good status. This tolerance window is the **7-day offline grace period**
(`OfflineGracePeriodDays`):

| Time since last successful check | Behaviour |
|---|---|
| Within 7 days | Full Enterprise operation. |
| Grace period active | Full operation continues, and a **grace banner** is shown in the UI warning that the license has not been re-validated. |
| After 7 days | The app **silently downgrades to Free**. Premium features stop working and limits revert to Free values. |

If the server explicitly reports the license as **revoked**, the app downgrades to Free
immediately rather than waiting out the grace period.

The last-known-good status is persisted to the cache file
(`PROXYTRACE_LICENSE_CACHE_PATH`) so that a restart during an outage does not reset the grace
window. For genuinely air-gapped deployments, expect to operate within the grace period and
plan periodic, controlled connectivity to refresh the license, or contact sales about
offline licensing arrangements.

## Where to buy

Enterprise licenses are available from the Proxytrace website. To purchase or to discuss
offline / air-gapped licensing, see the pricing page or contact sales:

- **Pricing:** <https://proxytrace.dev/pricing>

## Key-rotation FAQ

Proxytrace verifies license signatures against a set of public keys embedded in the binary.
A license is accepted if **any** active key validates its signature. This lets us rotate
signing keys without invalidating licenses already in the field, using a staged
dual-key release playbook:

- **Release N — introduce the new key.** Ship a build that trusts **both** the current key
  and the next key. The new key is published but not yet used to sign anything. Existing
  licenses (signed by the old key) keep validating.
- **Release N+1 — sign with the new key.** New licenses are issued signed by the new key.
  Builds still trust both keys, so old and new licenses both validate during the transition.
- **Release N+2 — retire the old key.** Once enough time has passed for outstanding licenses
  to be re-issued, ship a build that trusts **only** the new key. The old key is dropped.

Because every release in the sequence trusts at least the key your license was signed with,
customers never experience a forced re-issue, and there is no flag day. If you operate in an
air-gapped environment, upgrade across these releases in order so you are never more than one
key generation behind.

**Q: I upgraded Proxytrace and now my license is rejected with `BadSignature`.**
Your license was likely signed with a key that the new build no longer trusts (you skipped
past Release N+2 of a rotation). Obtain a re-issued license — see
[Where to buy](#where-to-buy) — or, to keep running in the meantime, unset
`PROXYTRACE_LICENSE` to operate on the Free tier.

## Related

- [Configuration](/admin/configuration) — settings files and environment variables.
- [Installation](/admin/installation) — getting Proxytrace running.
