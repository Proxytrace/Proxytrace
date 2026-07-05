# Feature Gating Behind a License / Tier Service

Products sold in tiers need to switch capabilities and limits on and off per customer — at runtime,
reversibly, and without a redeploy. Scattered `if (tier == Pro)` checks rot into an unauditable mesh
that breaks on every new tier, and naive gating that deletes or errors on downgrade destroys
customer configuration. This guide describes a single-service gating architecture that stays
auditable, degrades gracefully, and is testable in every tier.

## Principles

- **One service is the only gate.** A single interface (`ILicenseService` or equivalent) is the
  sole source of truth for entitlement decisions. No call site compares tier enums, parses license
  tokens, or caches its own copy of the answer. Every duplicate check is a future inconsistency.
- **Tiers are data, not code.** A gated capability is a member of a `Feature`/`Limit` enum assigned
  to tier *definitions*; call sites ask "is feature X enabled?", never "is the tier ≥ Pro?". Adding
  a tier or moving a feature between tiers then touches one table, zero call sites.
- **Default to the free tier, never to null.** The service's current snapshot is never null and an
  absent/invalid/expired license resolves to the lowest tier's entitlements. Code is written to
  degrade downward, not to assume a paid tier or to null-guard.
- **Entitlements can change while the process runs.** Licenses are set, removed, revoked, and
  expired at runtime. The service exposes a change event; anything that caches a decision must
  invalidate on it. A tier is a *current state*, not a startup constant.
- **Downgrades pause, they do not destroy.** Unlicensed configuration stays in the database and is
  skipped at use time, so re-upgrading resumes exactly where the customer left off.
- **Never trust an unverified tier claim.** License tokens are signed (e.g. JWT verified against
  public keys bundled in the binary); the raw token, an env var, or a DB row is never read as an
  entitlement directly — only the validating service's output is.
- **An invalid license must not take the product down.** Validation failure yields a
  "invalid, free entitlements, here's why" snapshot surfaced as a UI banner — never a startup
  crash that turns a billing hiccup into an outage.

## Patterns

### 1. The single gate interface

**Problem.** Entitlement logic spread across controllers, services, and UI drifts: one path checks,
another doesn't, a third checks the wrong thing.

**Solution.** One narrow interface, injected everywhere a decision is needed:

```csharp
public interface ILicenseService
{
    LicenseSnapshot Current { get; }          // never null; defaults to the free tier
    event Action Changed;                     // fires on any tier/entitlement change
    bool IsFeatureEnabled(Feature feature);   // boolean capabilities
    long GetLimit(Limit limit);               // numeric caps; long.MaxValue == unlimited
}
```

The snapshot carries provenance (`Source`: none/environment/stored/override) and validity
(`Status`, `InvalidReason`) so the UI can explain *why* the tier is what it is. Sentinel
conventions are part of the contract: `long.MaxValue` means unlimited and is honored as-is — no
call site re-caps or special-cases it.

**Rationale.** A single seam makes gating auditable (grep for the interface), swappable (test
fakes, self-hosted overrides), and consistent by construction.

### 2. Check at the seam, once per capability

**Problem.** Checking entitlement deep inside shared helpers (or in five redundant layers) makes
behavior unpredictable and reviews impossible.

**Solution.** Each gated capability has one or two *deliberate* enforcement points, chosen per
capability:

- **Creation-time** enforcement: decorate the mutating endpoints with a declarative attribute/
  middleware (`[RequiresFeature(Feature.X)]`) returning a distinct status code (402 works well) —
  the client can distinguish "not licensed" from "forbidden".
- **Use-time** enforcement: the executor (scheduler, runner, pipeline) checks the feature just
  before doing the gated work and *skips* it when disabled.

Document, per feature, which point(s) apply and why. Listing/read endpoints usually stay ungated
so customers can still *see* configuration they can no longer run.

**Rationale.** A named seam per capability is reviewable and testable; it also lets you pick the
right degradation semantics per feature instead of one global rule.

### 3. Tiers as data: feature/limit enums mapped onto tier definitions

**Problem.** `if (tier >= Tier.Pro)` at call sites hard-codes the price sheet into the codebase;
repackaging tiers becomes a code change across the app.

**Solution.** Adding a gated capability means: add a `Feature` (or `Limit`) enum member, assign it
to the appropriate tier definition(s), and check `IsFeatureEnabled(...)` at the seam. The
tier→entitlement mapping lives in one place (the tier definitions), never at call sites.

**Rationale.** Marketing repackages tiers more often than engineering ships features. Keeping the
mapping as data makes that a one-line change and keeps call sites meaningful ("can I run scheduled
jobs?") rather than commercial ("is this customer Enterprise?").

### 4. Graceful degradation vs hard block — choose per capability

**Problem.** One global downgrade behavior is always wrong somewhere: hard-blocking everything
breaks running systems and deletes goodwill; silently allowing everything makes tiers meaningless.

**Solution.** A small vocabulary, applied deliberately:

- **Skip silently at use time** — background/aggregate work where an error would pollute results:
  the executor omits the unlicensed step and computes results over what did run.
- **Pause but preserve** — scheduled/configured automation: the scheduler skips unlicensed entries
  without deleting them; re-upgrade resumes them untouched.
- **Hard block management, keep visibility** — a 402 on create/update/delete/execute while list
  stays open, so the customer sees what they'd regain by upgrading.
- **Accepted-consequence windows** — a satellite process polling the stored license may honor a
  revoked-but-unexpired key until the next poll or expiry. Where you accept such a window, write
  the acceptance down.

**Rationale.** Downgrade is a temporary commercial state, not a data-loss event. Preserving
configuration converts a lapsed customer into a resumable one; the explicit vocabulary keeps each
feature's behavior a decision instead of an accident.

### 5. Runtime activation, precedence, and the change event

**Problem.** Requiring a restart to apply a license makes trials and upgrades painful; multiple
license sources (env var, admin-entered key, deployment override) conflict without a rule.

**Solution.** Resolve the effective license by a fixed precedence — deployment override →
customer-stored key (DB) → environment-provided key → free — and re-resolve on change. Split
responsibilities: a **validator** (verify signature/lifetime, produce a snapshot), an **activator**
(atomically swap the current snapshot: strict `Activate` that keeps the old license on rejection,
lenient `ActivateOrInvalid` for surfacing bad keys, and `ActivateConfigured` to fall back after
removal), and a **key manager** (validate → persist → activate). Apply the stored key via a startup
service ordered after schema migration; log failures, never crash. Long-lived consumers (revocation
checkers, caches, in-flight schedulers) subscribe to `Changed` rather than latching the startup
snapshot.

**Rationale.** Precedence-plus-event turns licensing into a small state machine with one writer
and many reactive readers — the only structure that stays correct when keys change mid-flight.

### 6. Offline/air-gapped licenses as an explicit, bounded variant

**Problem.** Air-gapped customers can't reach a license server, but disabling phone-home checks
for everyone removes revocation entirely.

**Solution.** An explicit signed claim (e.g. `offline: true`) that only the issuer emits. For such
keys the client skips server checks entirely (no offline-grace degradation for lack of network),
and local expiry becomes the *only* terminator — enforced both at validation and while running.
Because an offline key cannot be revoked and works on unlimited installs, the issuer caps its
lifetime (≤ a year); short lifetime is the sole containment lever. Surface the offline nature in
the API/UI (and hide "re-check now" — there is nothing to ask).

**Rationale.** Making offline an explicit issued property (not a client-side toggle) keeps the
security trade-off in the vendor's hands and honestly bounded.

### 7. Testing gated paths in all tiers

**Problem.** Gating bugs are asymmetric and invisible: an over-gate breaks paying customers, an
under-gate gives the product away — and the default test fixture usually runs one tier only.

**Solution.**
- Make the gate trivially fakeable (it's one interface): fixtures set any tier, or an "everything
  on / everything off" fake.
- For each gated capability test at least: **unlicensed** (blocked/skipped, configuration
  preserved, correct status code), **licensed** (works), and **transition** (downgrade pauses,
  re-upgrade resumes; `Changed` invalidates caches).
- Test the sentinel and default rules: free-tier snapshot when no/invalid license; `long.MaxValue`
  treated as unlimited.
- Test that an invalid key yields the invalid-with-reason snapshot rather than a crash.

**Rationale.** Tier behavior is a matrix; only enumerating the matrix per capability catches the
silent under-gate that no user ever reports.

## Pitfalls

- **Tier-enum comparisons at call sites.** The moment `tier >= Pro` appears outside the tier
  definitions, repackaging becomes a codebase-wide hunt. Always feature/limit checks.
- **Null-guarding or assuming the snapshot.** `Current` is never null and defaults to free; code
  that assumes a paid tier crashes exactly for the customers evaluating you.
- **Fail-fast startup on invalid license.** A billing/clock/key problem becomes a full outage.
  Boot into free entitlements with a visible banner instead.
- **Caching entitlement decisions without subscribing to the change event.** Runtime downgrades
  and admin key changes silently don't apply until restart.
- **Destructive downgrades.** Deleting schedules, evaluator attachments, or rules on downgrade
  punishes the customer twice and makes re-upgrade worthless. Pause, preserve, resume.
- **Gating the read path along with the write path by reflex.** Hiding existing configuration
  confuses customers and support; usually only mutation/execution needs the 402.
- **Trusting an unverified tier value** (env var, DB column, client claim). Only the validating
  service's output counts; signature verification against bundled public keys is the floor.
- **Forgetting satellite processes.** Sidecars/proxies that enforce gated behavior need the same
  service (perhaps with server checks disabled and a polling stored-license feed) — and their
  staleness window documented as an accepted consequence.
- **Re-capping `long.MaxValue`.** Sentinel conventions belong to the interface contract; local
  special-casing reintroduces per-call-site drift.

## Checklist for a new project

- [ ] Define the single gate interface: non-null `Current` snapshot, `Changed` event,
      `IsFeatureEnabled`, `GetLimit` with a documented unlimited sentinel.
- [ ] Model features and limits as enums mapped onto tier definitions; ban tier comparisons at
      call sites (code review rule or analyzer).
- [ ] For each gated capability, pick and document its enforcement point(s): creation-time
      (declarative attribute, 402), use-time (skip/pause), or both — and its downgrade semantics.
- [ ] Downgrades preserve configuration; re-upgrades resume it. No gate deletes customer data.
- [ ] Signed license tokens verified against bundled public keys; invalid/expired keys resolve to
      free entitlements with a surfaced reason, never a crash.
- [ ] Runtime set/remove without restart: precedence order (override → stored → environment →
      free), validator/activator/key-manager split, startup application after migrations.
- [ ] Long-lived consumers subscribe to the change event and invalidate cached decisions.
- [ ] If air-gapped installs matter: an issuer-signed offline claim, local-expiry-only
      enforcement, capped lifetime, offline status surfaced in the UI.
- [ ] Satellite processes load the same gating module with an appropriate license feed; document
      their staleness window.
- [ ] Tests per capability cover unlicensed, licensed, and transition (downgrade/upgrade/change
      event), plus the free-default and unlimited-sentinel contracts.
