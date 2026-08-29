# Licensing (the Enterprise support key)

Proxytrace has **no feature gating and no limits**: every capability is available on every
installation, with no key. `Proxytrace.Licensing` exists only to record whether an **Enterprise
support contract** is on file — a signed key that resolves to a `LicenseSnapshot` the UI shows in
the topbar chip and under *Settings → Enterprise support*. Nothing in the product branches on it.

The subsystem is split along the Core boundary (see [`code-reuse.md`](code-reuse.md)): the
**engine** — JWT verification, activation, the resolved snapshot, and the background server check
with offline grace — lives in `Nordstein.Core.Licensing`
([`core/docs/licensing.md`](../core/docs/licensing.md)), keyed by a string vocabulary.
`Proxytrace.Licensing` supplies the **product identity**: the `LicenseTier` enum (`Free` /
`Enterprise` — the member names are the JWT `tier` claim values, a wire-format contract; here
`Enterprise` means "support contract on file", nothing more), the issuer/audience, the
`LicensePublicKeys` trust root, and thin enum-typed adapters implementing the
`ILicenseService`/`ILicenseActivator` interfaces below. The product vocabulary has **no features
and no limits** (`ProxytraceLicenseTierPolicy` returns empty definitions); `feat`/`lim` claims on
keys issued while Proxytrace still gated features are ignored by the engine with a warning, so
existing keys keep validating.

```csharp
public interface ILicenseService
{
    LicenseSnapshot Current { get; }            // never null; defaults to Free (= no support contract)
    event Action Changed;                       // fires when the snapshot changes (background check, key set/removed)
    Task ForceRefreshAsync(CancellationToken cancellationToken = default);
}
```

## Directives

- **Never gate anything on the license.** Do not add feature checks, limits, or tier branches —
  not in the backend, not in the frontend, not in MCP tools. The key is informational. If a paid
  capability is ever wanted again it is a product decision to be designed anew, not a call site to
  re-add.
- **`Current` is never null** and defaults to `Free` (no contract) — never null-guard the snapshot.
- **React to `Changed`** only for display state; the snapshot can change at runtime (a background
  server check, or an admin setting/removing a key in the UI).
- Keys are **JWT, verified against bundled public keys** (`LicensePublicKeys`). Never trust an
  unverified tier value; always go through the service.
- The trusted keys are fixed at **compile time**: `LicensePublicKeys.GetActiveKeys()` returns the
  embedded production key unless the build ran with `-p:LicensePublicKey=<base64-spki>[,<more>]`
  (Docker build-arg `LICENSE_PUBLIC_KEY`), which bakes replacement keys into assembly metadata.
  The dev/e2e composes use it to trust the committed test-signed key; official release images pass
  no override. The `PROXYTRACE_LICENSE_PUBLIC_KEY` **runtime** env override exists only in Debug
  builds — never extend it to Release.
- The repo is public under the **PolyForm Shield 1.0.0** license: free for any use, including
  commercial and internal business use, with the single restriction that nobody may offer a product
  or service that competes with Proxytrace. The license key plays no part in that — it only records
  a support contract.

## Runtime key management (set/remove without restart)

The effective key resolves in this precedence order: **database-stored key → environment JWT
(`PROXYTRACE_LICENSE` / `Licensing:License`) → none (Free)**.

- `LicenseSnapshot` carries a `Source` (`None`/`Environment`/`Stored`) and, when a configured key
  fails validation, `Status = Invalid` + `InvalidReason`. An invalid key **never crashes the host**;
  the UI surfaces a banner instead, and nothing else changes.
- `ILicenseActivator` (`Proxytrace.Licensing`) — validation + snapshot swap:
  `Validate` (dry run, throws `InvalidLicenseException`), `Activate` (throws; current snapshot kept
  on rejection), `ActivateOrInvalid` (never throws — applies an Invalid snapshot), and
  `ActivateConfigured` (re-resolves env/none; used on remove).
- `ILicenseKeyManager` (`Proxytrace.Application.Licensing`) — orchestrates persistence:
  `SetAsync` validates → persists via `IStoredLicenseStore` (single-row `StoredLicenseEntity` in
  Storage) → activates as `Stored`; `RemoveAsync` deletes and falls back via `ActivateConfigured`.
- `StoredLicenseStartupService` (Application hosted service, registered **after** the database
  initializer) applies the stored key once migrations have run. Failures are logged, never fatal.
- The engine's `LicenseCheckService` (`Nordstein.Core.Licensing`) reacts to `Changed` — a key
  activated at runtime starts revocation checks.
- API: `GET /api/license` (anonymous; `customerEmail` withheld from unauthenticated callers),
  `POST /api/license/validate` (anonymous dry run), `PUT /api/license` (admin, **or anonymous while
  no users exist**), `DELETE /api/license` (admin), `POST /api/license/refresh` (admin). Kiosk
  deployments have no key and block the mutating endpoints through the read-only middleware.
- The offline-grace cache and the auto-generated signing key live in `PROXYTRACE_DATA_DIR` when
  set (the Docker deployment mounts the `appdata` volume there).
- The standalone proxy (`Proxytrace.Proxy.Api`) does **not** load the licensing module — nothing
  in the proxy pipeline consumes the snapshot.

## Offline-only keys

An **offline-only** key is for air-gapped installs that cannot reach the license server. The JWT
carries one extra claim, `offline` (a JSON boolean), and the server emits it **present and `true`**
only on these keys — a normal online key omits the claim entirely.

- The engine's `JwtLicenseValidator` parses `offline` by JSON type onto `LicenseSnapshot.Offline`
  (true only when present and exactly `true`). Everything else about the token — ES256 signature,
  `iss`/`aud`/`exp` validation against the bundled public keys — is unchanged, so an offline token
  still verifies fully offline.
- The engine's `LicenseCheckService` **skips the periodic `/licenses/check` call entirely** for an
  offline snapshot (both the background loop and the admin "Re-check now" / `ForceRefreshAsync`
  path). The offline-grace state machine therefore never runs for these keys.
- With no server check, **`exp` is the only thing that ends an offline key**, enforced locally: an
  already-expired token is rejected at validation, and a token that expires *while running* moves to
  `Expired` by `EnforceOfflineExpiry`. Expiry changes only the recorded support status.
- **Security:** an offline key cannot be revoked and is a bearer credential until `exp`. The server
  caps offline `exp` at ≤365 days.
- `Offline` flows through to the API (`GET /api/license` → `LicenseDto.offline`,
  `POST /api/license/validate` → `ValidateLicenseResultDto.offline`); the settings page surfaces
  it (an "offline key" note and no "Re-check now" button).
