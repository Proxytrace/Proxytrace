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
  `ResponseToolRequestCount`. The full payload is loaded per-selection via `FindAsync`. (Rows written
  before these columns existed show no preview until they age out via retention.)

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

The `AddTestRunScheduling` migration adds the `TestRunScheduleEntity` table and its
`TestRunScheduleEndpointEntity` join table (the endpoints a schedule runs against), plus a nullable
`TestRunGroupEntity.ScheduleId` column + FK (`OnDelete(Restrict)`) linking a run group back to the
schedule that triggered it.

## Quick start

Bring up a PostgreSQL instance (the repo's `docker-compose.yml` ships one) and run the API:

```bash
docker compose up -d postgres
cd Proxytrace.Api && dotnet run
```

For a zero-dependency local demo, enable kiosk mode (`Kiosk:Enabled=true`) to use in-memory storage
with no database at all.
