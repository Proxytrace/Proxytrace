# Configuration

Proxytrace is configured through standard ASP.NET Core settings files in the
`Proxytrace.Api` project.

## Settings files

- `Proxytrace.Api/appsettings.json` — default configuration.
- `Proxytrace.Api/appsettings.development.json` — development overrides.

Environment variables and the usual ASP.NET Core configuration providers also apply and
override file values.

## Common settings

### Database connection string

The provider is auto-detected from the connection string. Set it under
`ConnectionStrings:Default`:

```json
{
  "ConnectionStrings": {
    "Default": "Data Source=proxytrace.db"
  }
}
```

See [Database](/admin/database) for provider patterns and details.

### Frontend origin (CORS)

The API allows the frontend origin for CORS. By default it is `http://localhost:4201`;
override with `Frontend:AllowedOrigin`:

```json
{
  "Frontend": {
    "AllowedOrigin": "https://your-frontend-host"
  }
}
```

## Demo data

Local dev mode does not auto-seed in every flow. Use the **`/setup`** page (or the setup
endpoint) to populate demo data into an empty database.

## Security headers

The API emits a strict Content-Security-Policy and related headers on every response (the
nginx deployment sets equivalent headers). This is why the bundled manual is served from a
path the CSP explicitly allows — see [Deployment](/admin/deployment).

## Next step

Choose and configure a database — see [Database](/admin/database).
