# Secrets at Rest

How Proxytrace protects persisted secrets. Read this before adding a new secret-bearing field, or
before touching encryption, hashing, the Data Protection key ring, or the secrets backfill.

## The rule: encrypt vs hash

A secret's treatment is decided by **how it is used**, not by what it is:

- **Replayable secret** — Proxytrace must recover the plaintext and send it to a third party. These
  are reversibly **encrypted** (`ISecretProtector`). Example: `ModelProvider.ApiKey` (the upstream
  provider credential, replayed on every proxied/outbound call), the SMTP password.
- **Verify-only credential** — only ever compared against a presented value, never replayed. These
  are one-way **hashed** (`ISecretHasher`); the plaintext is shown once at creation and is
  unrecoverable afterwards. Example: `ApiKey.KeyHash` (inbound Proxytrace keys), `Invite.TokenHash`.

Never hash a replayable secret (you could not replay it) and never reversibly encrypt a verify-only
credential (a database dump would then yield usable credentials).

## The two seams (`Proxytrace.Application/Security/`)

- **`ISecretProtector`** — `Protect`/`Unprotect`, backed by ASP.NET Core Data Protection
  (`DataProtectionSecretProtector`, purpose `"Proxytrace.Secrets.v1"`). The seam and its key ring are
  registered together in `Proxytrace.Application/Security/SecretProtectionModule.cs` (application name
  `"Proxytrace"`, persisted to `PROXYTRACE_DATA_DIR/dataprotection-keys`); without it the ring is
  ephemeral and ciphertext does not survive a restart. **Both hosts that touch encrypted secrets — the
  API (writer) and the lean ingestion proxy (reader, which decrypts the upstream provider key before
  replaying it) — load this module and must mount the *same* `PROXYTRACE_DATA_DIR` volume**, or the
  proxy cannot decrypt what the API wrote (the deploy/e2e compose files wire the shared `appdata`
  volume into both). Reads degrade gracefully on a `CryptographicException` (treat the secret as unset
  + log) rather than crashing a hot path — see `ModelProviderConfig.Decrypt` and
  `EmailSettingsStore.DecryptPassword`.
- **`ISecretHasher`** — `Hash(value)` → hex SHA-256 (`Sha256SecretHasher`, delegating to the shared
  `Proxytrace.Common.Security.Sha256.HexHash`). Deterministic and **key-ring-independent**, so the
  verify paths keep working even if `PROXYTRACE_DATA_DIR` is lost. Unkeyed SHA-256 is safe here
  because the secrets are 256-bit CSPRNG values — a dump cannot reverse or forge them. **Not for
  passwords** (use `IPasswordService`, which is salted + slow).

`Sha256` lives in `Proxytrace.Common` so the `Domain` layer (entity generators) can hash without
referencing `Application`.

## Blind-index lookup

Encryption is non-deterministic (random IV), so an encrypted column cannot be looked up or indexed by
value. Where a replayable secret also needs a by-value lookup, store a deterministic **blind-index
hash** column alongside the ciphertext and query that:

- `ModelProvider.ApiKey` (ciphertext) + `ModelProviderEntity.ApiKeyLookupHash` (indexed) —
  `FindByApiKeyAsync` hashes the presented key and matches the hash, then decrypts the row.

Hashed secrets need no separate column: the stored value *is* the hash, so the repository hashes the
presented raw value before the equality lookup (`ApiKeyRepository.FindByKeyAsync`,
`InviteRepository.FindByTokenAsync`).

## Where each transform lives

- **Encrypt** happens at the **storage mapper boundary** (`ModelProviderConfig.Map`): encrypt + set
  the lookup hash on write, decrypt on read. This round-trips safely through edits (load decrypts →
  save re-encrypts). The protector is injected as `Lazy<ISecretProtector>` so design-time migration
  tooling can build the model without a key ring.
- **Hash** happens at the **creation site** (the value entering the domain is already the hash:
  `ModelProvidersController.CreateKey`, `InviteService.CreateAsync`) and at **lookup time** in the
  repository. It must **not** happen in the mapper — a hashed entity that is re-saved (e.g.
  `Invite.MarkConsumedAsync`) would otherwise be double-hashed.

## Backfill of pre-existing rows

The product shipped with plaintext secrets, so `SecretsBackfillService` (an `IHostedService`
registered after the database initializer) protects existing rows in place on first boot. It is
idempotent and per-row (a partial run resumes; a re-run is a no-op), keyed on a marker per table:

| Table | "Not yet protected" marker | Action |
|---|---|---|
| `ModelProvider` | `ApiKeyLookupHash IS NULL` | encrypt `ApiKey`, set the lookup hash |
| `ApiKey` | `KeyPrefix IS NULL` | hash the plaintext in `KeyHash`, set `KeyPrefix` |
| `Invite` | `TokenHash` length ≠ 64 | hash the plaintext token |

The accompanying migration (`ProtectSecretsAtRest`) **renames** the verify-only columns
(`ApiKey`→`KeyHash`, `Token`→`TokenHash`) rather than dropping and re-adding them, so the existing
plaintext survives into the new column for the backfill to read. A drop+add would destroy live keys
and pending invites. When changing these columns, hand-check the generated migration emits
`RenameColumn`, not drop+add.

**Failure handling.** Each table's pass is retried a few times for transient faults; a persistent
failure is logged at **Critical** (surfaced in the operator Error Log) instead of crashing boot. The
impact is real: until a row is backfilled its lookup column still holds the pre-retrofit plaintext,
so the hashed/encrypted lookup cannot match it — the affected existing API keys, provider auth, and
pending invites **do not authenticate until a restart re-runs the backfill to completion**.
Credentials created after the upgrade are unaffected.

## Threat model

Protects **database dumps and backups**: the encryption key ring lives outside the database (in
`PROXYTRACE_DATA_DIR`), and the hashes are one-way over high-entropy secrets. It does **not** defend
against an attacker who holds **both** the database and the data directory — acceptable for a
self-hosted, single-deployment product.

## Out of scope

`StoredLicense` JWT is left plaintext: it is a signed license token, not a credential, so encrypting
it adds migration + decrypt-on-startup cost for no real secrecy gain. `User.PasswordHash` is already
hashed via `IPasswordService`. Key rotation / re-encryption tooling and a keyed-HMAC blind index are
deliberately not implemented.
