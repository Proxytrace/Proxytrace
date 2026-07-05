# At-Rest Secret Protection & Authentication Hardening

Any application that stores credentials — upstream API keys it must replay, inbound tokens it must
verify, MFA secrets, invite links — will eventually leak a database dump, a backup, or a log file.
This guide distills a set of transferable patterns for making those leaks non-fatal: cryptographic
seams, blind indexes, key-ring management, migration of legacy plaintext, TOTP-based MFA, machine
API-key auth, and keeping developer back doors out of production binaries.

## Principles

- **Classify every secret by how it is *used*, not what it is.** A secret the server must send
  onward or recompute against (an upstream provider key, an SMTP password, a TOTP shared secret) is
  *replayable* → reversibly **encrypt** it. A secret only ever compared against a presented value
  (inbound API keys, invite tokens, reset tokens, backup codes) is *verify-only* → one-way **hash**
  it and show the plaintext exactly once at creation. Hashing a replayable secret makes it unusable;
  encrypting a verify-only credential means a dump plus the key yields working credentials for no
  benefit.
- **Put crypto behind narrow seams.** All encryption goes through one interface (e.g.
  `ISecretProtector` with `Protect`/`Unprotect`), all hashing through another (`ISecretHasher`).
  Call sites never name an algorithm. This lets you rotate algorithms, swap providers, and unit-test
  with fakes without touching business code.
- **State the threat model explicitly.** These patterns defend against *offline* artifacts: DB
  dumps, backups, log access. They do not defend against an attacker holding both the database and
  the key material, nor against a compromised running process. Write that down so nobody
  over-claims — and so nobody "fixes" a deliberate non-goal.
- **Never issue a privileged artifact (session, token) before every required factor has passed.**
- **Debug conveniences must be structurally incapable of reaching production** — compiled out, not
  configured off — and a test must prove their absence in release artifacts.
- **Layer interfaces low, implementations low-but-separate.** The seam interfaces belong in the
  domain/core layer so storage code can consume them without pulling in application logic; the
  concrete implementations belong in the lowest infrastructure layer that *every* host needing them
  (main API, sidecar/proxy processes) can reference.

## Patterns

### 1. The two-seam split: `ISecretProtector` vs `ISecretHasher`

**Problem.** Crypto decisions scattered across call sites can't be rotated, audited, or tested; and
developers reach for the wrong primitive (encrypting what should be hashed, or vice versa).

**Solution.** Exactly two interfaces:

```csharp
public interface ISecretProtector { string Protect(string plaintext); string Unprotect(string ciphertext); }
public interface ISecretHasher   { string Hash(string value); }  // deterministic, e.g. hex SHA-256
```

Back the protector with a platform key-management facility (ASP.NET Core Data Protection is one
illustration; libsodium sealed boxes or a KMS envelope are others). Back the hasher with a fast,
deterministic, *key-independent* hash — plain SHA-256 is sound **only** for high-entropy values
(≥128-bit CSPRNG tokens), because there is nothing to brute-force. It is never acceptable for
user-chosen passwords; those go through a third, dedicated seam (salted, slow: argon2/bcrypt/PBKDF2).

**Rationale.** Two seams encode the classification decision in the type system. The hasher being
key-independent is a deliberate resilience property: even if the encryption key ring is lost,
verify-only auth paths keep working.

### 2. Encrypt at the storage-mapper boundary; hash at the creation site

**Problem.** If both transforms happen "wherever convenient," you get double-encryption on
re-save, double-hashing on update, or plaintext accidentally persisted by a code path that forgot.

**Solution.**
- **Encryption** lives in the persistence mapping layer: encrypt on write, decrypt on read. Loading
  and re-saving an entity round-trips safely because the mapper always sees plaintext in memory and
  ciphertext at rest. Inject the protector lazily so design-time tooling (migration generators) can
  build the model without live key material.
- **Hashing** happens once, where the secret enters the domain (the endpoint or service that mints
  it), and again at lookup time against the presented raw value. It must *not* live in the mapper:
  an already-hashed entity that is updated (e.g. marking a token consumed) would be hashed twice
  and never match again.

**Rationale.** Each transform has exactly one idempotence-safe location. Putting them anywhere else
creates re-save corruption bugs that only appear on the second write.

### 3. Blind index for equality lookups on encrypted columns

**Problem.** Good encryption is non-deterministic (random IV), so `WHERE api_key = ?` on a
ciphertext column can never match, and the column cannot be indexed by value.

**Solution.** Alongside the ciphertext column, store a deterministic hash of the plaintext in a
second, indexed column. Lookup: hash the presented value, match the hash column, then decrypt the
row you found. Hashed (verify-only) secrets need no extra column — the stored value already *is*
the lookup key.

**Rationale.** Preserves O(log n) indexed lookup without weakening encryption to a deterministic
mode. Caveat: an unkeyed blind index leaks equality (two rows with the same secret hash the same)
and permits offline guessing of *low-entropy* values — fine for CSPRNG keys, but use a keyed HMAC
if the indexed value could ever be guessable.

### 4. Key-ring lifecycle and multi-process sharing

**Problem.** Ephemeral or per-process keys silently produce ciphertext that no one can ever decrypt
after a restart — or that a *sibling process* (a lean proxy that must replay the upstream key the
main API encrypted) cannot read.

**Solution.**
- Persist the key ring to a well-known data directory outside the database; pin the application
  name/purpose string (version it, e.g. `"MyApp.Secrets.v1"`) so keys are shared intentionally.
- Every process that reads *or* writes encrypted secrets loads the same key-ring module and mounts
  the same data directory (in container deployments, a shared volume wired into both services).
- On read, degrade gracefully: catch the decryption failure, treat the secret as unset, and log —
  never crash a hot path because one row was written under a lost key.

**Rationale.** The key ring living outside the DB is precisely what makes a DB dump useless. The
shared-volume requirement is the operational corollary — document it loudly, because it fails
silently (writes succeed, reads throw) if missed.

### 5. Backfill: retrofitting protection onto shipped plaintext

**Problem.** The product already shipped with plaintext secrets in the database. A migration that
drops and recreates columns destroys live credentials; a one-shot script that crashes halfway
leaves an inconsistent mix.

**Solution.** A startup backfill service (hosted service, ordered after schema migration) that is
**idempotent and per-row**: each table has a cheap "not yet protected" marker (a null companion
column, a value whose length doesn't match a hash's) and each row is transformed independently. The
schema migration **renames** legacy columns into their new roles rather than drop+add, so the
plaintext survives for the backfill to read — hand-verify the generated migration emits a rename.
Retry transient failures a few times; on persistent failure, log at the highest operator-visible
severity and continue boot rather than crash. Document the blast radius honestly: unprotected rows
cannot authenticate until a later run completes, while newly created credentials work immediately.

**Rationale.** Idempotence + per-row markers make partial runs resumable and re-runs no-ops — the
only safe shape for a process that races with restarts, crashes, and horizontal history.

### 6. Two-step login with short-lived MFA challenge tickets

**Problem.** Bolting MFA onto login by issuing a session and then "upgrading" it forces every
authorization check to inspect an `mfa_verified` claim — one missed check is a full bypass.

**Solution.** The password step never issues a session for an MFA-enrolled account. It returns an
opaque, single-use **challenge ticket**: short TTL (~5 minutes), a per-ticket failed-attempt cap
(~5), server-side state. A second endpoint consumes the ticket plus a TOTP code *or* an unused
backup code and only then issues the session. The session token itself carries no MFA claim and the
auth middleware is untouched — MFA correctness is concentrated in the login service. Apply the same
`LoginOutcome` shape to **password reset completion**: proving email control must not bypass the
device factor. Rate-limit the verify endpoint per IP — a 6-digit code space is small.

**Rationale.** "No session until all factors pass" removes an entire bypass class. Ticket state
lost on restart is harmless (user re-enters the password), which is why in-memory storage is
acceptable — *for a single-instance topology* (see Pitfalls).

### 7. TOTP enrollment, backup codes, and replay guard as first-class entities

**Problem.** MFA state modeled as flags on the user row invites drift (flag true, no secret) and
loses the lifecycle (pending vs confirmed enrollment, consumed vs live backup codes).

**Solution.** Two entities:
- **Enrollment**: user FK (unique — one per user, with the DB unique index as the source of truth;
  concurrent setups race on it and the loser re-reads), the shared secret (**encrypted** — the
  server must recompute codes from it, so it is replayable by the classification rule),
  `ConfirmedAt` (null = pending; "MFA active" is *derived* from a confirmed row, never a flag), and
  `LastUsedStep` — a **replay guard** rejecting any code whose time-step is ≤ the last accepted
  one, even inside the ±1-step clock-drift window.
- **Backup codes**: ~10 rows, each a **hash** of a CSPRNG code (verify-only; shown once at
  activation, transactionally with confirmation), `ConsumedAt` per row, unique index on the hash.

Enrollment flow: setup returns `{secret, otpauth URI}` (QR rendered client-side — no server QR
dependency); activation verifies the first code before confirming; disable requires password
re-auth; an admin endpoint removes MFA unconditionally for lockout recovery. Audit enable, disable,
and every failed challenge.

**Rationale.** Deriving "MFA on" from data cannot desynchronize. The replay guard closes the
shoulder-surf/intercept window that the drift tolerance would otherwise open.

### 8. Scoped API keys as a dedicated auth scheme for machine endpoints

**Problem.** Letting browser sessions and machine credentials interchange means a leaked API key
can drive the whole UI API, and a stolen browser token can drive machine integrations.

**Solution.** Machine endpoints (ingestion, an MCP/automation surface) authenticate via a distinct
scheme that reads `Authorization: Bearer <key>`, looks the key up **by hash**, and rejects it
unless it carries the required **scope** from a flags set (`Ingestion`, `AutomationRead`,
`AutomationWrite`, …). Pin the machine route to *only* that scheme via an authorization policy, so
browser tokens can't reach it and keys aren't valid elsewhere. Each key binds a **tenant/project**
(its data boundary) and an **owner user** (attribution — the handler stashes the owner so downstream
"current user" resolution works identically to an interactive request). Write operations re-check
the write scope explicitly at the tool/handler level. When retrofitting scopes, backfill existing
keys to their **narrowest historical use** so no key silently gains new power.

**Rationale.** Scheme isolation plus least-privilege scopes bound the blast radius of any single
leaked credential to one surface, one tenant, and one permission level — and every action stays
attributable to a person.

### 9. Break-glass recovery with redaction by default

**Problem.** A sole admin locked out with no working email path needs recovery; but logging live
reset links turns log-read access into account takeover.

**Solution.** Reset tokens are CSPRNG, hash-stored, short-TTL (~1h), single-use. When email
delivery is unavailable, log only a truncated one-way **token hint** (enough to correlate log line
to DB row, useless to reconstruct the token) plus instructions. A config flag (default **off**)
unlocks true break-glass logging of the full URL — to be enabled only during active recovery, then
turned back off. Prefer non-logged paths first: another admin minting a link shown once in the UI,
or fixing email delivery.

**Rationale.** Redaction-by-default keeps the log a debugging artifact, not a credential store,
while still leaving a documented escape hatch for the genuine lockout scenario.

### 10. Debug affordances compiled out, with a release guard test

**Problem.** A hardcoded dev login ("always sign in as `debug@…`") is enormously convenient and
enormously dangerous: a runtime flag guarding it is one misconfiguration away from a production
back door.

**Solution.**
- Gate the *entire* affordance — the type and its DI registration — behind compile-time exclusion
  (`#if DEBUG` or the equivalent build-tag mechanism), never a runtime environment check.
- Implement it *through* the normal machinery: seed a real user row with a properly hashed
  password so login flows through the ordinary path — no verification bypass exists anywhere,
  even in debug.
- Add a **release-only guard test** compiled only in non-debug configuration that asserts, against
  the release-built assembly, that the seeder type does not exist, the debug namespace is empty,
  and neither credential literal appears in the binary bytes. If anyone drops the guard, the
  release test run fails.
- Zero-credential conveniences (an interactive API explorer) may use a runtime environment check —
  the compile-time rule is specifically for anything carrying or bypassing credentials.

**Rationale.** Configuration is reversible at runtime and drifts; compilation is not. The guard
test converts a policy ("never ship this") into an executable invariant.

## Pitfalls

- **Hashing a replayable secret or encrypting a verify-only one.** The classification rule is the
  first question for every new field; get it wrong and you either brick the feature or gift
  credentials to whoever steals a backup.
- **Plain SHA-256 for anything a human chose.** Unkeyed fast hashing is only safe over
  high-entropy machine-generated values. Passwords need a slow, salted KDF — keep it a separate
  seam so the fast hasher can't be misused by proximity.
- **Hashing in the storage mapper.** Guarantees double-hash corruption on the first re-save of an
  existing row. Encryption belongs in the mapper; hashing never does.
- **Ephemeral key ring / unshared data directory.** Writes succeed, restarts (or the sibling
  process) fail to decrypt. Persist the ring, share the volume, and degrade gracefully on
  decryption failure instead of crashing.
- **Drop+add column migrations over live secrets.** Destroys the plaintext the backfill needed.
  Rename, backfill, then (optionally, later) tighten.
- **In-memory auth state behind a load balancer.** Challenge tickets, attempt caps, and per-IP
  rate limiters kept in process memory are correct *only* for a documented single-instance
  topology. Adding a second replica silently partitions the counters and weakens brute-force
  guarantees — moving that state to a shared store (e.g. Redis) is a prerequisite for scaling out,
  not an afterthought. Write the constraint down where a deployer will see it.
- **`mfa_verified` claims on sessions.** Every consumer must remember to check; one gap is a full
  bypass. Withhold the session instead.
- **TOTP without a last-used-step replay guard.** The clock-drift window makes each code valid for
  ~90 seconds across steps; without the guard an observed code is replayable within it.
- **Legacy API keys silently inheriting new scopes.** Scope retrofits must backfill to the
  narrowest scope that preserves existing behavior.
- **Logging live recovery links by default.** Log a one-way hint; make the full link an explicit,
  temporary, documented break-glass flag.
- **"Debug-only" guarded by environment variables.** One misconfigured deployment reintroduces the
  back door. Compile it out and test the absence.

## Checklist for a new project

- [ ] Classify each stored secret: replayable → encrypt; verify-only → hash + show once. Document
      the decision per field.
- [ ] Define `ISecretProtector` and `ISecretHasher` seams in the core layer; implementations in
      infrastructure; a separate slow-KDF seam for passwords.
- [ ] Encrypt in the storage mapper (lazy protector for design-time tooling); hash at creation
      site + lookup time, never in the mapper.
- [ ] Add a blind-index hash column (indexed) for any encrypted field needing by-value lookup;
      consider keyed HMAC if values could be low-entropy.
- [ ] Persist the key ring to a data directory outside the DB with a versioned purpose string;
      mount it into every process that touches ciphertext; degrade gracefully on decrypt failure.
- [ ] If retrofitting: rename-not-drop migrations, idempotent per-row startup backfill with
      markers, retries, and loud-but-non-fatal failure logging.
- [ ] MFA: two-step login with a short-TTL single-use challenge ticket and attempt cap; no session
      until all factors pass; password reset completion honors the same rule; per-IP rate limit on
      code verification.
- [ ] Model enrollment (encrypted secret, `ConfirmedAt`, `LastUsedStep` replay guard, unique per
      user) and backup codes (hashed, per-row consumption) as entities; derive "MFA active" from
      data; provide an admin lockout-recovery disable; audit all MFA transitions.
- [ ] Machine endpoints: dedicated API-key auth scheme, hash-based lookup, least-privilege scopes,
      policy-pinned routes, tenant + owner binding, narrow backfill for legacy keys.
- [ ] Recovery links: CSPRNG, hash-stored, short TTL, single-use; redacted logging by default with
      an explicit break-glass flag.
- [ ] Debug logins compiled out via build-time guards; a release-configuration test proves the
      type, namespace, and credential literals are absent from the shipped binary.
- [ ] Write the threat model (defends dumps/backups; not DB+keys together) and the topology
      constraint (single instance vs shared state) into the docs.
