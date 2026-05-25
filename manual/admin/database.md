# Database

Proxytrace supports multiple database providers. The provider is **auto-detected** from the
connection string format in `Proxytrace.Api/appsettings.json` (see
[Configuration](/admin/configuration)).

## Supported providers

| Provider | Detected when the connection string… | Notes |
|---|---|---|
| **SQLite** | contains `Data Source=` with `.db`, `.sqlite`, or `:memory:` | Zero-config; default for local dev. |
| **PostgreSQL** | contains `Host=` or `Port=` | |
| **SQL Server** | matches neither of the above | The default fallback provider. |

### SQLite (recommended for development)

File-based, no server to install.

```json
{
  "ConnectionStrings": {
    "Default": "Data Source=proxytrace.db"
  }
}
```

In-memory (data lost on shutdown):

```json
{
  "ConnectionStrings": {
    "Default": "Data Source=:memory:"
  }
}
```

The `proxytrace.db` file is created automatically in the API directory on first run.

### PostgreSQL

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=Proxytrace;Username=postgres;Password=yourpassword"
  }
}
```

### SQL Server

```json
{
  "ConnectionStrings": {
    "Default": "Server=localhost;Database=Proxytrace;Trusted_Connection=True;TrustServerCertificate=True;"
  }
}
```

## Migrations

The API automatically applies pending migrations on startup for all providers that support
them (SQL Server, PostgreSQL, and SQLite). To create and apply migrations manually, run
from the `Proxytrace.Storage` directory:

```bash
cd Proxytrace.Storage
dotnet ef migrations add MigrationName
dotnet ef database update
```

::: tip
SQLite uses code-first initialization in addition to migration support; for local
development you generally don't need to touch migrations at all.
:::

## Quick start with SQLite

1. Set `ConnectionStrings:Default` to `Data Source=proxytrace.db`.
2. Run the API: `cd Proxytrace.Api && dotnet run`.

The database file is created automatically.
