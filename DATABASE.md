# Database Configuration

The Trsr API supports multiple database providers. The database provider is automatically detected based on the connection string format.

## Supported Database Providers

### SQLite (Recommended for Development)

SQLite is a lightweight, file-based database that requires no separate server installation.

**Connection String Examples:**
```json
{
  "ConnectionStrings": {
    "Default": "Data Source=trsr.db"
  }
}
```

Or for in-memory database (data is lost when application stops):
```json
{
  "ConnectionStrings": {
    "Default": "Data Source=:memory:"
  }
}
```

**Advantages:**
- No server installation required
- Simple file-based storage
- Fast for development and testing
- Zero configuration

**Detection:** Connection strings containing `Data Source=` with `.db`, `.sqlite`, or `:memory:`

### SQL Server (Default)

Microsoft SQL Server is the default database provider.

**Connection String Example:**
```json
{
  "ConnectionStrings": {
    "Default": "Server=localhost;Database=Trsr;Trusted_Connection=True;TrustServerCertificate=True;"
  }
}
```

**Detection:** Connection strings not matching PostgreSQL or SQLite patterns

### PostgreSQL

Open-source relational database with advanced features.

**Connection String Example:**
```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=Trsr;Username=postgres;Password=yourpassword"
  }
}
```

**Detection:** Connection strings containing `Host=` or `Port=`

## Configuration File Location

Update the connection string in:
- `Trsr.Api/appsettings.json` (default configuration)
- `Trsr.Api/appsettings.development.json` (development override)

## Migrations

To create and apply database migrations:

```bash
# Create a new migration (from Trsr.Storage directory)
cd Trsr.Storage
dotnet ef migrations add MigrationName

# Apply migrations (automatic on API startup, or manual)
dotnet ef database update
```

The API automatically applies pending migrations on startup for all database providers that support migrations (SQL Server, PostgreSQL, and SQLite).

## Quick Start with SQLite

1. Update `Trsr.Api/appsettings.json`:
```json
{
  "ConnectionStrings": {
    "Default": "Data Source=trsr.db"
  }
}
```

2. Run the API:
```bash
cd Trsr.Api
dotnet run
```

The database file `trsr.db` will be created automatically in the API directory.

