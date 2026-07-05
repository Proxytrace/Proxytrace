# Testing Strategy Across Layers

Test suites rot in two ways: they become slow and flaky until nobody trusts a red build, or they
become so coupled to shared fixtures that every refactor breaks fifty tests that were never really
testing anything. This guide describes a layered testing strategy — unit, integration, end-to-end,
and performance — built around one harness as the single source of truth, strict per-test isolation,
and e2e tests that exercise the real deployed stack rather than a simulacrum of it.

## Principles

- **One harness, documented once, enforced always.** All tests in a layer extend the same base
  harness and follow the same conventions. A single authoritative "how to write tests here"
  document (kept adjacent to the code) overrides individual habit. Divergent test styles are debt,
  not diversity — call out legacy exceptions explicitly as "debt, not precedent" so they aren't
  copied.
- **Each layer tests what only it can test.** Unit/domain tests cover construction, validation,
  and state transitions. Integration tests cover services wired to real (in-memory or containerized)
  persistence with faked external infrastructure. E2e tests cover flows that cross a process
  boundary (browser → API → DB → queue). Performance tests cover behavior at realistic data volume.
  Pushing a concern to the wrong layer buys either false confidence (unit test for a query plan) or
  wasted minutes (e2e test for a formatter).
- **No shared mutable state between tests, ever.** No instance fields holding the system under
  test, no static fixtures, no test ordering assumptions. Everything a test needs is built inside
  the test method. This is the difference between a suite that parallelizes safely and one that
  produces heisenbugs.
- **Fake infrastructure, never the domain.** Substitute external clients (HTTP, LLM/provider APIs,
  email senders); use the real domain objects, real validation, real repositories. Faking the
  domain tests your fakes.
- **Tests document behavior.** Names read as specifications (`Subject_Condition_ExpectedOutcome`);
  each test has one logical assertion focus. A well-named failing test tells you what broke without
  reading its body.
- **A test you haven't run is unverified.** Never claim a test passes without executing it; if the
  environment prevents execution (no Docker), say so and do the next-best check (typecheck/compile).

## Patterns

### The DI container is the fixture

**Problem:** Shared fixture classes and instance-field mocks leak state between tests, defeat
parallelism, and grow into unmaintainable god-objects.

**Solution:** The base test class exposes a method (e.g. `GetServices()`) that builds a **fresh
dependency-injection container per call**, wiring the layer under test plus in-memory storage and
standard infrastructure stubs. Tests resolve what they need from it; teardown disposes every
container the test created. Two override hooks exist: a class-wide one (rare) and a per-call
lambda (the default) for test-specific fakes.

```
[Test]
async Task Ingest_PersistsRecord_AndNotifies() {
    var notifier = Fake<INotifier>();                 // created locally
    var services = GetServices(b => b.RegisterInstance(notifier));

    var sut = services.Get<IIngestor>();
    await sut.IngestAsync(payload, ct);

    await notifier.Received(1).NotifyAsync(Any, ct);  // same instance the SUT used
}
```

**Rationale:** Isolation and fixture-free tests at once. Each container carries its own isolated
in-memory database (unique name per test), so there is literally nothing to leak. Beware fake
lifetimes: a transient-registered fake resolves to a *different* instance each time, so assertions
on it silently see nothing — register a single instance for any fake you assert on.

### Factory delegates instead of `new` on domain objects

**Problem:** Tests that `new` up domain entities bypass validation and invariants, so they pass
against objects that could never exist in production.

**Solution:** Construct domain objects only through the same DI-resolved factories production uses
(e.g. `CreateNew` for fresh entities, `CreateExisting` for reconstitution). Pair this with a
**test-data generator** per entity type that can produce a valid persisted instance
(`CreateAsync`), reuse one (`GetOrCreateAsync`), or build in-memory only (`GenerateAsync`) — so a
test needing "any valid parent for this FK" is one line.

**Rationale:** Every test object went through real validation; a change to invariants immediately
fails the tests that relied on the old shape. The generator centralizes "what does a valid X look
like" in exactly one place.

### In-memory DB for logic, real DB for scale

**Problem:** In-memory database providers are fast and isolation-friendly but hide client-side
query evaluation, index misses, and bad query plans; real databases catch those but are too slow
for thousands of unit tests.

**Solution:** Split by intent. Default to in-memory persistence for domain/application tests —
they exercise real mappers and repositories, just not the query planner. Add a **separate opt-in
performance suite** that seeds a real database at production-like volume (e.g. a million rows of
the highest-volume table) and measures changed query paths against explicit latency/throughput
budgets checked into the repo. Any change to a query, mapping, or index on an unbounded-growth
table must extend the perf suite in the same change.

**Rationale:** A correctness test on ten rows cannot catch an O(rows) blow-up or a nested-loop
plan from stale statistics. Budgets make regressions binary: the suite runs green, so any red is a
regression to chase, not a judgment call.

### E2e against the real stack, seeded via an API client helper

**Problem:** E2e suites that stub the backend or run against a dev server test a configuration
nobody ships; e2e suites that click through the UI to build test data are slow and break on every
UI change.

**Solution:** Boot the **production compose stack** (DB + cache + API + reverse proxy + built
frontend) against a throwaway database, then drive a real browser (e.g. Playwright). Setup data
goes through a shared, typed **API client helper** that mirrors the real public API contract —
one method per endpoint, throwing on non-2xx — never through UI clicks and never through inline
raw requests. Authentication is done once in a setup project and persisted (storage state) so
specs start logged in. Reset the database to a known baseline before every test via a dedicated
test-only endpoint, and have each spec seed exactly the data it asserts on.

**Rationale:** You test the artifact you deploy, including the reverse proxy, static hosting, and
real network. API seeding makes specs fast and immune to UI churn; the shared client keeps the
contract in one place. Per-test reset makes exact-count and empty-state assertions safe and kills
inter-spec coupling ("never depend on data another spec created").

### Stable test selectors as a contract

**Problem:** Selectors based on visible text or DOM structure break on copy edits, i18n, and
refactors — the largest single source of e2e flake-churn.

**Solution:** A selector priority: (1) `data-testid` for anything asserted on or interacted with,
with a naming convention like `<entity>-<element>[-<id>]` (`user-row-${id}`, `invoice-create-btn`,
`orders-empty-state`); (2) ARIA role + accessible name; (3) text matching only to assert
non-interactive content is present, never to click. Treat each test id as a **stable contract**
between component and test — keep it across refactors.

**Rationale:** Test ids survive translation, redesign, and restructuring; roles double as an
accessibility check. The convention makes ids predictable enough that spec authors rarely need to
read the component.

### Wait on conditions, never on time

**Problem:** Fixed sleeps are simultaneously too slow (padding every run) and too fast (flaking
under load); "network idle" waits hang forever once the app holds long-lived connections (SSE,
WebSockets).

**Solution:** Use auto-retrying, user-observable assertions (`toBeVisible`, `toHaveText`) and
poll-until helpers (`expect.poll`) for eventually-consistent effects with an explicit timeout and
failure message. Wait for page `load`, then assert on a concrete element — never on network
quiescence. Gate tests needing expensive external calls (real LLM/third-party APIs) behind a tag
plus an env-var skip so key-less runs pass cleanly.

**Rationale:** Condition-based waits are exactly as fast as the system and fail with a meaningful
message. Long-lived server-push connections make "no network activity" an unreachable state.

### Triage taxonomy: product bug vs infra vs test bug

**Problem:** Without a shared triage discipline, every red e2e run is "probably a flake",
re-runs replace diagnosis, and real regressions ship.

**Solution:** Classify every failure before touching anything: **product bug** (the app misbehaves
— fix the app, the test did its job), **infrastructure** (stack didn't boot, port clash, stale
volume, missing daemon — fix the environment, e.g. reset volumes between full runs), or **test
bug** (race, fragile selector, order dependency — fix the test, and fix the *pattern*, not just the
instance). Playwright-style traces, screenshots, and HTML reports are the evidence; an overlay
intercepting a click or an assertion racing a refetch are test/product bugs the report names
explicitly.

**Rationale:** The three classes have disjoint fixes and disjoint owners. Deleting or retrying a
failing test without classification silently converts product bugs into shipped bugs.

## Pitfalls

- **Instance-field fakes.** `private readonly _client = Fake<IClient>()` at class scope is shared
  state wearing a costume. Register substitutes in the per-test container instead.
- **Asserting on the returned object instead of reloading.** After a service persists a change,
  reload from the repository and assert on *that* — the in-memory return value can lie about what
  was actually saved.
- **Trusting the fake you configured, asserting on a different instance.** Transient fake
  registrations hand the SUT and the test different objects; `Received()` then passes or fails
  meaninglessly.
- **`beforeAll` seeding under per-test DB reset.** The reset wipes it before the first test runs;
  seed in `beforeEach` or the test body. Likewise, JS variables don't reset with the DB — re-zero
  accumulators.
- **Missing cancellation tokens.** Pass the harness token to every async call, or hung tests
  outlive their timeout.
- **The seams your seed data hits.** Hidden uniqueness constraints (fingerprints/hashes over
  content) and server-side defaults ("empty" collections that auto-populate) are classic e2e seed
  failures — document them once where spec authors will see them.
- **Escape hatches becoming defaults.** A shared expensive fixture (class-level seeded container)
  is a deliberate last resort; if it's used to avoid a few lines of setup, isolation is gone.

## Checklist for a new project

- [ ] One base test harness per stack: fresh DI container + isolated in-memory DB per test, with
      class-wide and per-test override hooks; teardown disposes containers automatically.
- [ ] One authoritative testing doc/skill; base class enforces the conventions the doc describes.
- [ ] Domain objects constructed only via factory delegates; a test-data generator per entity.
- [ ] Standard infrastructure stubs registered once in a per-layer test module.
- [ ] Naming convention `Subject_Condition_ExpectedOutcome`; one assertion focus per test.
- [ ] E2e suite boots the production compose stack against a throwaway DB; auth done once in a
      setup project; DB reset to baseline before each test.
- [ ] Shared typed API client for e2e data setup; adding an endpoint method there is the norm.
- [ ] `data-testid` naming convention documented; selector priority written down.
- [ ] No fixed sleeps; condition polling with explicit timeouts; external-dependency tests tagged
      and env-gated.
- [ ] Perf suite with checked-in budgets for high-volume query paths; required for any change to
      those paths.
- [ ] Failure triage taxonomy (product / infra / test) documented next to the run instructions.
