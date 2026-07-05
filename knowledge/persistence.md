# Persistence Layer Design

Storage code fails in ways application code doesn't: schema drift between environments, ORM leakage into the domain, queries that silently materialize whole tables, and delete cascades that wipe data nobody meant to touch. This guide captures a set of storage-layer patterns that keep the database an implementation detail — swappable, migratable, and fast at scale — while the rest of the system talks only to domain abstractions.

## Principles

- **The database is chosen in exactly one place.** Everything above the storage layer is provider-blind. Provider choice (production RDBMS vs. in-memory test double vs. embedded engine) is a composition-root decision expressed as a configuration value, never an `if` inside business code.
- **Domain types never see the ORM.** Domain objects are persistence-ignorant interfaces/records; ORM entities are `internal` to the storage assembly. A mapper per entity is the only bridge. This keeps the ORM replaceable and keeps domain invariants out of reach of lazy-loading and change-tracker semantics.
- **Schema evolves only through versioned migrations, generated against the production engine.** Migrations are the changelog of the database; each one is documented (what, why, backfill semantics) in a living doc alongside the code.
- **Design queries for the largest table you will ever have, not the one you have today.** Every query on an unboundedly-growing table must be index-served or a deliberate, budgeted aggregate. "Load rows, filter in memory" is a bug even when tests pass.
- **Test doubles have weaker semantics than the real engine — know exactly where.** Cascade rules, concurrency enforcement, index behavior, and SQL functions typically don't exist in an in-memory provider. Guard those with tests that assert on model metadata or generated SQL, not round-trips.

## Patterns

### Provider abstraction via a configuration seam

**Problem:** Supporting more than one database engine (or a real engine plus a fast in-memory mode for unit tests and demos) tends to smear `#if`/provider checks across the codebase.

**Solution:** One abstract `StorageConfiguration` type with a static factory per provider (`Postgres(connectionString)`, `InMemory()`, …). Each concrete configuration knows how to wire the ORM context and declares its capabilities (e.g. `SupportsMigrations`). The DI module takes the configuration and registers everything else identically.

**Rationale:** The provider matrix is decided once, at startup, from config. Adding or dropping an engine touches one file, and capability flags (migrations vs. `EnsureCreated`, relational-only features) branch inside the storage layer rather than in callers.

```
abstract record StorageConfiguration {
    internal abstract bool SupportsMigrations { get; }
    static StorageConfiguration Postgres(string conn) => new PostgresConfiguration(conn);
    static StorageConfiguration InMemory() => new InMemoryConfiguration();
}
```

Schema init follows capability: relational providers apply migrations on startup; the in-memory provider creates the schema from the model. Don't pretend the doubles are equivalent — document their gaps (see Pitfalls).

### Domain / storage split with per-entity mappers

**Problem:** Letting ORM entities double as domain objects couples business logic to persistence details (navigation properties, tracking, nullability quirks) and makes the ORM impossible to replace or test around.

**Solution:** A fixed per-concept file set: a public domain interface, an internal immutable domain record, an internal ORM entity, and a config class that owns both the ORM mapping (indexes, FKs, column types) and the domain↔entity mapper. Repositories accept and return domain types only.

**Rationale:** The boundary is mechanical and reviewable: *domain holds the full referenced object; storage holds the foreign-key id.* The mapper resolves references through the referenced entity's repository. Junction tables and pure read projections get storage entities with **no** domain counterpart — they are implementation detail.

### Migration discipline

**Problem:** Auto-generated migrations drift per developer machine, provider-specific types leak, and data backfills get lost in tribal knowledge.

**Solution:**
- A design-time context factory pinned to the **production** engine, so generated migrations always emit that engine's native types — never whatever database a dev happened to have configured.
- Migrations applied automatically on startup; no manual schema steps in any environment.
- New non-nullable columns ship with a SQL default so existing rows backfill deterministically (e.g. a flags column defaulting to the safest value, so legacy rows never silently gain capabilities).
- **Data-only migrations** are legitimate: a raw `UPDATE` that normalizes existing rows, with no model change. Name them for intent and document their caveats (e.g. a normalization that can collide with a unique index needs a stated precondition).
- Every migration gets a paragraph in the database doc: what changed, why, what happens to pre-existing rows. This is the institutional memory that prevents "why does this FK restrict?" archaeology.

**Rationale:** Migrations are the only path by which production data survives schema change; ambiguity here is data loss.

### Deliberate delete semantics, tested at the model level

**Problem:** Default cascade behavior is chosen implicitly and reviewed by nobody — until a hard delete of a small config row cascades into a high-volume telemetry table and destroys history irreversibly. The inverse bug also exists: a `Restrict` FK that makes an entity undeletable once used.

**Solution:** Choose per-FK: `Cascade` for owned children, `Restrict` for references into high-volume or historical data (pair with soft-delete/archive flows for the supported removal path), and *no FK at all* for append-only audit rows that must survive deletion of what they reference (store plain id columns plus snapshot labels).

**Rationale:** Cascade graphs are transitive and invisible in code review. Because in-memory test providers don't enforce them, write regression tests that assert delete behavior **on the ORM model metadata** (the source of the real DDL), not via delete round-trips.

### Indexing conventions for high-volume tables

**Problem:** The highest-volume, append-heavy table (events, traces, logs) serves both list pages and time-windowed aggregates; naive per-FK indexes leave the hot paths on sequential scans.

**Solution:**
- **Composite indexes shaped like the access path** — `(scope_fk, created_at)` serves "filter by owner, order/range by time" from one index while its leading column still covers the FK.
- **Partial indexes for rare-flag filters** — a `WHERE flags <> 0` index makes "show only flagged rows" cheap when flagged rows are a small fraction.
- **Denormalized, indexed sort/filter columns** written at ingestion (a computed total, a preview string, a scoping id copied from an ancestor) so list sorting and pickers stay single-table and index-served instead of computing per row or joining to the big table. Backfill via an idempotent, batched startup job whose candidate set strictly shrinks (`WHERE col IS NULL`, writing a sentinel rather than leaving null), so re-runs are no-ops.
- **Write-normalization for case-insensitive unique lookups** — normalize (trim + lowercase) at the write boundary and compare exactly at read time. A `LOWER(col) = LOWER(@x)` predicate is not sargable against a plain index and forces a scan on every lookup; canonical stored values make the ordinary unique index both case-insensitive and index-served, and make the uniqueness constraint actually block case-variant duplicates.

**Rationale:** Each convention converts an O(rows) operation into an O(log n + result) one; each denormalization trades a little write-path work for a read path that no longer touches the big table at all.

### Server-side aggregation, locked by translation tests

**Problem:** ORM query providers will happily materialize an entire table client-side when an expression doesn't translate — correct on 100 test rows, catastrophic at millions.

**Solution:** Aggregates must reduce **in the database**: time-series bucketing as an integer-slot `GROUP BY` (`floor((ts - epoch) / width)`) so only one row per non-empty bucket crosses the wire; percentiles via the engine's native function (raw SQL if the ORM can't express it), with an explicit fallback for the in-memory provider. List endpoints select scalar projections only — never the wide payload columns — and load the full row per-selection by key. Then **lock the shape**: unit tests render the query to SQL (`ToQueryString` or equivalent) against the production provider's translator — no live database needed — and assert the `GROUP BY`/aggregate appears server-side.

**Rationale:** Client-side evaluation is a silent regression vector; a translation test turns it into a compile-adjacent failure. Where a LINQ path and a raw-SQL path implement the same filter, add a parity test on the filter's member list so they cannot silently diverge.

### Optimistic concurrency via a version stamp

**Problem:** Two concurrent read-modify-write cycles silently lose one writer's update.

**Solution:** Every entity carries an `UpdatedAt` (or version) column configured centrally as the ORM's concurrency token, so updates/deletes emit `WHERE id = @id AND version = @original` and a zero-rowcount raises a conflict the repository translates into a domain exception. Enforcement is atomic at the database; any in-app pre-check is only a fast-fail.

**Rationale:** Centralizing the token (one loop over the model at context configuration) means no entity can forget it. Beware precision mismatches between in-memory timestamps and the engine's stored precision — align before comparing, and only on relational providers.

### Race-tolerant get-or-create

**Problem:** Check-then-insert on a uniquely-indexed row races across processes; an in-process lock only serializes one instance, and the loser crashes the hot path with a unique-violation.

**Solution:** Wrap the insert; on a unique-constraint exception, re-query for the row the winner inserted and return it (rethrow only if it's still absent).

### Encrypted columns and blind-index lookups (pointer)

Columns holding secrets are stored as ciphertext behind an encrypt/decrypt seam at the store boundary. Because ciphertext is not queryable, equality lookups on encrypted values go through a **blind index** — a deterministic keyed hash stored in a separate indexed column, computed identically at write and lookup time. Details (key management, hashing seams, backfill of pre-existing plaintext) belong in the security guide; the persistence-layer takeaway is that "encrypted" and "searchable" are reconciled by an extra derived column, not by decrypt-and-scan.

## Pitfalls

- **Trusting the in-memory provider's semantics.** It typically does not enforce FK cascade/restrict, does not emit the concurrency `WHERE` clause, ignores partial-index/relational metadata, and runs async queries synchronously (so `Task.WhenAll` fan-outs serialize). Classify each guarantee as "real engine only" and test it via model metadata or generated SQL.
- **Context lifetime leaks in long-lived services.** A singleton background service resolving contexts from the root DI scope accumulates them until process shutdown. Batch loops in singletons must own a child lifetime per batch (an owned/disposable context handle), not borrow the root's factory.
- **Migrations generated against the wrong engine.** Without a pinned design-time factory, one developer's local SQLite emits portable-but-wrong column types into the shared migration history.
- **Backfills that can re-run forever.** A backfill selecting `WHERE col IS NULL` must never write `NULL` back for "nothing to compute" — use a sentinel so the candidate set strictly shrinks and reboot loops terminate.
- **`LOWER()`/function-wrapped predicates on indexed columns** — not sargable; normalize at write time instead (or pay for an expression index deliberately).
- **Nullable-column sorts with default null ordering.** Engines differ on nulls-first/last per direction; if "no value" rows must land last both ways, sort by an explicit `(col IS NULL)` pre-key and add a key tiebreak for stable paging.

## Checklist for a new project

- [ ] One `StorageConfiguration`-style seam; provider chosen at the composition root from config, capability flags branch inside the storage layer only.
- [ ] Domain interfaces/records public; ORM entities `internal`; one mapper per entity; repositories speak domain types. Domain holds objects, storage holds ids.
- [ ] Design-time migration factory pinned to the production engine; migrations applied on startup; each migration documented with its backfill story.
- [ ] Every FK's delete behavior chosen deliberately; restrict-into-history + archive flow for high-volume references; model-metadata regression tests for cascade semantics.
- [ ] Highest-volume table: composite `(scope, time)` index, partial indexes for rare flags, scalar list projections, denormalized sort/preview columns with idempotent backfills.
- [ ] All aggregates server-side, locked by SQL-translation unit tests; no unbounded "materialize then filter" path reachable from a dashboard.
- [ ] Central optimistic-concurrency token on every entity; unique-violation-tolerant get-or-create on shared-row hot paths.
- [ ] Secrets encrypted at the store boundary; blind-index columns for any equality lookup on encrypted data (see security guide).
- [ ] A written list of exactly which guarantees the test provider does *not* enforce.
