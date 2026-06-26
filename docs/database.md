# Database Configuration

Storage is **PostgreSQL** for all persistent deployments (debug, release, and e2e) and an
**in-memory** store for unit tests and kiosk (single-process demo) mode. SQLite and SQL Server are
no longer supported.

| Mode | Selected when | Schema init |
|------|---------------|-------------|
| PostgreSQL | non-kiosk (connection string from `Proxytrace.Api/appsettings.json`) | EF migrations (`MigrateAsync`) on startup |
| In-memory | `Kiosk:Enabled=true`, and all unit tests | `EnsureCreatedAsync` (no migrations) |

Transactions use a single shared EF `IDbContextTransaction` per logical unit (`AmbientDbContext` +
`Transaction`), so writes never promote to a 2-phase transaction.

## Supported storage modes

### PostgreSQL (persistent — debug / release / e2e)

The only supported persistent provider. The schema is created and kept up to date by applying EF
Core migrations on startup (`MigrateAsync`).

**Connection string example:**
```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=proxytrace;Username=proxytrace;Password=proxytrace"
  }
}
```

The provider is selected unconditionally for non-kiosk runs; the connection string is passed
straight to `StorageConfiguration.Postgres`.

### In-memory (unit tests / kiosk mode)

When `Kiosk:Enabled=true`, storage uses the EF Core in-memory provider. No connection string is
required and all data is lost when the process stops. Unit tests use the same in-memory provider
via `Proxytrace.Storage.Tests.Module`. The in-memory provider does not support migrations; the
schema is created from the EF model via `EnsureCreatedAsync`.

> **Gotcha — queries execute synchronously.** The in-memory provider runs `ToListAsync` /
> `FirstOrDefaultAsync` inline without yielding the thread. Code that fans several independent
> queries out with `Task.WhenAll` therefore runs them *sequentially* here (it overlaps only on a
> relational provider that does real async I/O). Where that fan-out latency matters under in-memory
> mode — e.g. the dashboard's ~11-query aggregation — offload each query with `Task.Run` to restore
> concurrency; it is harmless on relational providers.

## Configuration file location

Set the connection string in:
- `Proxytrace.Api/appsettings.json` (default configuration)
- `Proxytrace.Api/appsettings.development.json` (development override)

## High-volume tables (AgentCall)

`AgentCallEntity` is the highest-volume table and is tuned for read-at-scale:

- **Composite index `(AgentVersionId, CreatedAt)`** serves the agent/project-scoped trace list and
  the dashboard time-series (filter by version, then order/range by `CreatedAt`) from one index; its
  leading column still covers the agent-version foreign key. There are also single-column indexes on
  `CreatedAt`, `EndpointId` and `ConversationId`.
- **Statistics aggregate in the database.** `AgentCallStatsQueries` buckets time-series with an
  integer-slot `GROUP BY` (`floor((CreatedAt - epoch) / width)`) so only one row per non-empty
  bucket crosses the wire — never `O(rows)`. Latency percentiles use `percentile_cont` on relational
  providers (raw SQL), with a materialise-and-sort fallback for the in-memory provider.
- **The traces list reads a lightweight projection.** `GetFilteredListAsync` selects scalar columns
  only and returns `AgentCallListItem`, so a page never reads or deserialises the `Request`,
  `Response` or `ModelParameters` payload columns. Two denormalised columns populated at write time
  back this: `RequestPreview` (first user message, collapsed + truncated) and
  `ResponseToolRequestCount`. The full payload is loaded per-selection via `FindAsync`. The shared
  `AgentCallPreview.Build` computes the preview, used both at ingestion (`AgentCallConfig`) and by the
  backfill below. (Rows written before `RequestPreview` existed start with it `null`; a one-time,
  idempotent startup backfill — `AgentCallPreviewBackfillService`, registered after the DB initializer
  — recomputes their preview in bounded batches `WHERE RequestPreview IS NULL`, so they regain it on
  the next boot. A request with no user message is marked with an empty string rather than `null` so
  the candidate set strictly shrinks and a re-run is a no-op; the client renders an empty preview as
  the same em-dash placeholder as `null`. `ResponseToolRequestCount` is not backfilled — older rows
  keep its `0` default.)
- **Outlier flag + partial index.** `OutlierFlags` (a byte bitmask, `0` = not an outlier) is written at
  ingestion by the outlier detector. A **partial index** (`WHERE "OutlierFlags" <> 0`) backs the
  "outliers only" trace filter cheaply — outliers are a small fraction of this high-volume table. The
  filter is relational metadata; the in-memory provider ignores it. See [`domain-concepts.md`](domain-concepts.md).

> **Gotcha — keep planner statistics fresh on AgentCallEntity (issue #246).** The dashboard/statistics
> aggregates (`AgentCallStatsQueries`) translate to server-side `GROUP BY` / `sum` / `percentile_cont` —
> they do **not** client-evaluate. (The token columns are `ulong?` → `numeric(20,0)`; `Queryable.Sum`
> has no `ulong` overload, so they cast inside the aggregate, e.g.
> `g.Sum(c => (long?)c.InputTokens ?? 0L)` → `sum(coalesce("InputTokens"::bigint,0))`. That casts to
> bigint server-side and is fine — `(decimal?)` translates too but sums as the slower `numeric`.) The
> real cliff is **stale planner statistics**: right after a bulk load/restore the table has no stats, so
> Postgres defaults to a wildly low row estimate and flips the windowed aggregate from a parallel
> seq-scan aggregate to a **nested loop that random-reads the whole table** — ~3.5s at 1M vs
> ~270-480ms once analyzed (*same SQL*, confirmed by `EXPLAIN ANALYZE`). A production database accrues
> rows incrementally and autovacuum keeps stats current; a one-shot bulk import does not. **Rules:** run
> `ANALYZE` after any bulk import/restore (the perf seeder does); `autovacuum_analyze_scale_factor` is
> lowered on this table (migration `TuneAgentCallAutovacuum`) so growth keeps stats fresh; and when a
> server-side aggregate is unexpectedly slow, `EXPLAIN (ANALYZE)` it and compare the planner's **estimated
> vs actual** row counts before assuming the query itself is wrong.

## Migrations

Migrations are **PostgreSQL-only**. The design-time factory
(`Proxytrace.Storage/StorageDbContextFactory.cs`) builds the context against PostgreSQL using the
`ConnectionStrings:Default` value, so generated migrations always emit native PostgreSQL types
(`uuid`, `boolean`, `timestamp with time zone`).

```bash
# Create a new migration (supply a PostgreSQL connection string at design time)
ConnectionStrings__Default="Host=localhost;Port=5432;Database=proxytrace;Username=proxytrace;Password=proxytrace" \
  dotnet ef migrations add <MigrationName> \
  --project Proxytrace.Storage \
  --startup-project Proxytrace.Api \
  --context StorageDbContext

# Apply migrations (also applied automatically on API startup)
dotnet ef database update --project Proxytrace.Storage --startup-project Proxytrace.Api
```

To regenerate the consolidated history from scratch, delete `Proxytrace.Storage/Migrations/*.cs`
and run `dotnet ef migrations add Initial` with the env-var connection string above.

The `AddUserLanguage` migration adds a non-nullable `UserEntity.Language` column with a SQL default
of `'en'` (configured via `HasDefaultValue("en")` in `UserConfig`), which backfills existing rows to
English — see [`i18n.md`](i18n.md).

The `AddApiKeyScopes` migration adds a non-nullable `ApiKeyEntity.Scopes` column (an `ApiKeyScopes`
flags enum stored as `int`) with a SQL default of `1` (`Ingestion`), backfilling existing keys to
ingestion-only so no legacy key silently gains MCP capabilities — see [`mcp.md`](mcp.md).

The `AddOutlierDetection` migration adds the non-nullable `AgentCallEntity.OutlierFlags` byte column
(default `0`) plus its partial index, and the single-row `OutlierSettingsEntity` table (the
admin-tunable detection sensitivity). Detection is going-forward only — existing rows keep `0`.

The `AddApiKeyOwner` migration adds a non-nullable `ApiKeyEntity.Owner` FK to `UserEntity`
(`OnDelete: Cascade` — a key cannot outlive its owner). Since there is no sensible owner to backfill
onto pre-existing keys, the migration first **deletes all existing `ApiKeyEntity` rows** (installations
were test-only at the time); admins re-mint keys, choosing an owner. Every MCP call is attributed to
the key's owner — see [`mcp.md`](mcp.md).

The `AddTestRunScheduling` migration adds the `TestRunScheduleEntity` table and its
`TestRunScheduleEndpointEntity` join table (the endpoints a schedule runs against), plus a nullable
`TestRunGroupEntity.ScheduleId` column + FK (`OnDelete(Restrict)`) linking a run group back to the
schedule that triggered it.

The `AddCachedInputTokens` migration adds four **nullable** columns for the cached-input-token
feature, all backward-compatible (existing rows read as no cache): `AgentCallEntity.CachedInputTokens`
(`numeric(20,0)`) and `TestResultEntity.CachedInputTokens` / `TestRunStatsEntity.CachedInputTokens`
(`bigint`) record the cached subset of the input tokens (cached ≤ input), while
`ModelEndpointEntity.CachedInputTokenCost` (`numeric(18,6)`) holds the per-endpoint cached-input price
(EUR / 1M tokens), auto-fetched from the LiteLLM catalog (the resolver reads `cache_read_input_token_cost`).
`IModelEndpoint.CalculateCost` prices the cached subset at this rate, falling back to the input rate when
it is null. The cached price is **not** user-editable — the pricing editor's update request omits it, and
the controller preserves the auto-fetched value on a manual input/output edit.

The `CascadeSuiteDelete` migration flips two foreign keys from `Restrict` to `Cascade` so a test
suite can be deleted once it has been used: `OptimizationTheoryEntity.Suite → TestSuiteEntity` and
`OptimizationProposalEntity.ABTestRun → TestRunEntity`. Previously these `Restrict` FKs blocked the
delete — directly (a theory pinned the suite) and transitively (the suite → run group → test run
cascade hit a proposal that pinned the run). With both as `Cascade`, deleting a suite removes its
run groups, runs, schedules, theories, and the proposals produced from those runs. Note the wider
effect: deleting an individual test run now also deletes any proposal that used it as its A/B run.
The `Restrict` semantics were not enforced by the in-memory provider, so this class of bug only
surfaces on PostgreSQL — unit tests cannot reproduce it.

The `RestrictEndpointProviderCascadeDelete` migration flips two foreign keys from `Cascade` to
`Restrict` so a config row can no longer cascade-wipe the high-volume traces table:
`AgentCallEntity.EndpointId → ModelEndpointEntity` and `ModelEndpointEntity.Provider →
ModelProviderEntity`. Previously a single hard delete of a `ModelProvider` cascaded through its
endpoints to **every** `AgentCall` (trace) recorded against them — irreversible telemetry loss.
Endpoints/providers are removed via the archive flow (`ArchivableRepository`), never hard-deleted, so
`Restrict` blocks only the accidental hard delete (or manual SQL) while leaving the supported path
untouched; it also matches the existing `AgentVersion → AgentCall` restriction. Like the
`CascadeSuiteDelete` FK change above, `Restrict`/`Cascade` is not enforced by the in-memory provider,
so the regression test (`CascadeDeleteBehaviorModelTests`) asserts on the EF model metadata that
drives the PostgreSQL DDL rather than on a delete round-trip. (The sibling `TestRun → ModelEndpoint`
FK was flipped to `Restrict` in the `RestrictTestRunEndpointCascadeDelete` migration — see below.)

The `RestrictTestRunEndpointCascadeDelete` migration flips one foreign key from `Cascade` to
`Restrict`: `TestRunEntity.Endpoint → ModelEndpointEntity`. Previously a hard delete of a
`ModelEndpoint` cascaded through to **every** `TestRun` recorded against it — wiping its test-run
history (issue #221). As with the traces vector above, endpoints are removed via the archive flow,
never hard-deleted, so `Restrict` blocks only the accidental hard delete (or manual SQL) while
leaving the supported path untouched. The sibling `TestRun → TestRunGroup` FK intentionally stays
`Cascade` — `CascadeSuiteDelete` relies on the suite → run group → run cascade to delete a used
suite. The regression lives in `CascadeDeleteBehaviorModelTests` and, like the other cascade tests,
asserts on the EF model metadata rather than a delete round-trip, because `Restrict`/`Cascade` is not
enforced by the in-memory provider.

The `AddOptimisticConcurrencyToken` migration marks every entity's `UpdatedAt` column as an EF
concurrency token (see [Optimistic concurrency](#optimistic-concurrency)). It changes only the SQL
EF generates — no PostgreSQL schema change — so its `Up`/`Down` are empty; it exists to keep the
model snapshot in sync for future migration diffs.

The `AddSampleCount` migration adds two non-nullable columns for test-run **sampling** (running each
endpoint N times and averaging): `TestRunGroupEntity.SampleCount` (default `1`, via `HasDefaultValue(1)`
so pre-existing groups backfill to single-sample) and `TestRunEntity.SampleIndex` (default `0`). The
per-run `TestRunStats` projection is unchanged; "one result per endpoint per group" readers collapse the
sample dimension at read time via `TestRunStatsCohortExtensions.AggregateSamples` (see
[`optimization-loop.md`](optimization-loop.md)).

## Optimistic concurrency

Every entity derives from `Entity` and carries an `UpdatedAt` timestamp that `AbstractRepository`
stamps on each write and uses as an optimistic-concurrency version stamp.

`UpdatedAt` is configured as an **EF concurrency token** centrally in
`StorageDbContext.OnModelCreating` (which loops the model and marks the `UpdatedAt` property of every
entity type). EF therefore emits `UPDATE/DELETE … WHERE Id = @id AND UpdatedAt = @original` and
checks the affected row count: if a concurrent writer already moved the row on, zero rows match and
EF raises `DbUpdateConcurrencyException`. `UpdateCoreAsync` translates that into the domain
`OptimisticConcurrencyException`; `RemoveAsync` treats it as "not removed by us" and returns `false`.
This enforces the guarantee **atomically at the database** — the in-app pre-check in
`UpdateCoreAsync` (comparing the caller's token via `MatchesConcurrencyToken`) is only a fast-fail
that avoids a round-trip for an obviously stale token; it cannot catch a genuine read-read-write-write
race on its own.

Two precision details (see `ConcurrencyTokenExtensions`):

- PostgreSQL `timestamptz` stores **microsecond** precision, but a token carried in memory keeps
  .NET's 100-nanosecond precision. Before saving, `RealignConcurrencyToken` realigns the token's EF
  *original value* to microseconds (`TruncateToMicroseconds`) so a row inserted earlier in the
  **same** context — still tracked at 100ns — does not spuriously mismatch the value the database
  actually persisted. **This truncation is gated on `Database.IsRelational()`**: the EF in-memory
  provider stores the full 100ns value verbatim, so truncating the original there would make EF's own
  in-memory token check compare a truncated original against the full-precision stored value and throw
  `DbUpdateConcurrencyException` on every ordinary single-actor update (regression #202).
- The in-app pre-check compares at microsecond granularity (`MatchesConcurrencyToken`) for the same
  reason — the entity returned by `AddAsync` before any DB round-trip carries the un-truncated token.

> **Gotcha — partial enforcement in-memory.** The EF in-memory provider does **not** emit the
> `WHERE … AND UpdatedAt = @original` rowcount check, so a genuine lost-update race cannot be
> reproduced by unit tests — that guarantee only holds on PostgreSQL. It *does*, however, perform its
> own value-equality concurrency-token check on save, which is why the microsecond realignment above
> must be skipped on the in-memory provider. Like the `Restrict`/`Cascade` FK semantics above, treat
> lost-update enforcement as Postgres-only.
The `AddEmailSettings` migration adds the `EmailSettingsEntity` table: the single-row operator
SMTP/email configuration (mirrors the `StoredLicenseEntity` single-row pattern). Columns: `Id` uuid
PK, `Enabled` boolean, `SmtpHost` / `FromAddress` / `FromName` non-nullable text, `SmtpPort`
integer, `Security` integer (the `SmtpSecurity` enum — `None=0`, `StartTls=1`, `Auto=2`,
`SslOnConnect=3`), `Username` / `Password` / `AppBaseUrl` nullable text, `MinSeverity` integer (the
`NotificationSeverity` enum), plus the standard `CreatedAt` / `UpdatedAt` `timestamp with time zone`
columns. The `Password` column holds ciphertext only; `EmailSettingsStore` encrypts via
`ISecretProtector.Protect` on save and decrypts via `Unprotect` on read. No FK constraints; no
`[StoredDomainEntity]` attribute (registered manually in `Storage.Module`, like
`StoredLicenseStore`).

The `TuneAgentCallAutovacuum` migration lowers `autovacuum_analyze_scale_factor` (to `0.02`, plus an
`autovacuum_analyze_threshold` of `5000`) on the high-volume `AgentCallEntity` table via raw
`ALTER TABLE … SET (…)`. The default scale factor (`0.10`) only re-analyzes after ~10% of rows change,
which lets planner statistics lag during rapid ingestion and can flip the statistics aggregates onto a
nested-loop plan (issue #246 — see the gotcha under [High-volume tables](#high-volume-tables-agentcall)).
It is PostgreSQL-only relational metadata, so its `Up`/`Down` are raw SQL and the in-memory provider
ignores it.

## Quick start

Bring up a PostgreSQL instance (the repo's `docker-compose.yml` ships one) and run the API:

```bash
docker compose up -d postgres
cd Proxytrace.Api && dotnet run
```

For a zero-dependency local demo, enable kiosk mode (`Kiosk:Enabled=true`) to use in-memory storage
with no database at all.
