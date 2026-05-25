# Database Configuration

The Proxytrace API supports multiple database providers. The database provider is automatically detected based on the connection string format.

## Supported Database Providers

### SQLite (Recommended for Development)

SQLite is a lightweight, file-based database that requires no separate server installation.

**Connection String Examples:**
```json
{
  "ConnectionStrings": {
    "Default": "Data Source=proxytrace.db"
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
    "Default": "Server=localhost;Database=Proxytrace;Trusted_Connection=True;TrustServerCertificate=True;"
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
    "Default": "Host=localhost;Database=Proxytrace;Username=postgres;Password=yourpassword"
  }
}
```

**Detection:** Connection strings containing `Host=` or `Port=`

## Configuration File Location

Update the connection string in:
- `Proxytrace.Api/appsettings.json` (default configuration)
- `Proxytrace.Api/appsettings.development.json` (development override)

## Migrations

To create and apply database migrations:

```bash
# Create a new migration (from Proxytrace.Storage directory)
cd Proxytrace.Storage
dotnet ef migrations add MigrationName

# Apply migrations (automatic on API startup, or manual)
dotnet ef database update
```

The API automatically applies pending migrations on startup for all database providers that support migrations (SQL Server, PostgreSQL, and SQLite).

## Quick Start with SQLite

1. Update `Proxytrace.Api/appsettings.json`:
```json
{
  "ConnectionStrings": {
    "Default": "Data Source=proxytrace.db"
  }
}
```

2. Run the API:
```bash
cd Proxytrace.Api
dotnet run
```

The database file `proxytrace.db` will be created automatically in the API directory.

