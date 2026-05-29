# Database

Proxytrace uses **PostgreSQL** for all persistent deployments and an **in-memory** store for
kiosk (single-process demo) mode and unit tests. SQLite and SQL Server are no longer supported.

## Storage modes

| Mode | Selected when | Notes |
|---|---|---|
| **PostgreSQL** | non-kiosk runs (connection string in `Proxytrace.Api/appsettings.json`) | Schema applied via EF Core migrations on startup. |
| **In-memory** | `Kiosk:Enabled=true` | No connection string needed; data lost on shutdown. |

### PostgreSQL

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=proxytrace;Username=proxytrace;Password=proxytrace"
  }
}
```

The repository's `docker-compose.yml` ships a ready-to-use PostgreSQL service.

### In-memory (kiosk mode)

Set `Kiosk:Enabled=true` (see [Configuration](/admin/configuration)). No database connection is
required; all data is discarded when the process stops.

## Migrations

Migrations target **PostgreSQL only** and are applied automatically on API startup
(`MigrateAsync`). To create or apply them manually, supply a PostgreSQL connection string at
design time:

```bash
ConnectionStrings__Default="Host=localhost;Port=5432;Database=proxytrace;Username=proxytrace;Password=proxytrace" \
  dotnet ef migrations add MigrationName \
  --project Proxytrace.Storage --startup-project Proxytrace.Api

dotnet ef database update --project Proxytrace.Storage --startup-project Proxytrace.Api
```

::: tip
For local experimentation without a database, run in kiosk mode — it uses in-memory storage and
needs no migrations.
:::
