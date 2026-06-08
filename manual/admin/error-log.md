# Error Log

The **Error Log** is an admin-only page that shows the latest application errors captured
across the backend — exception message, type, source, and full stacktrace — so operators can
diagnose failures without shelling into a container or wiring an external log stack.

It is reached from the sidebar under **Configure → Error Log**, and is only visible to users
with the **Admin** role. The underlying API (`/api/error-log`) is likewise restricted to
admins, because stacktraces can contain sensitive runtime detail.

## What gets captured

Every log entry at **Error** or **Critical** severity is captured, from anywhere in the
backend — request handling, background services, the ingestion consumer, the optimizer, and so
on. This is broader than just failed HTTP requests: errors that never surface as a response are
still recorded.

Each entry stores:

- **Message** — the log/exception message.
- **Level** — `Error` or `Critical`.
- **Source** — the logger category (typically the fully-qualified type that logged it).
- **Exception type** and **Stacktrace** — present when an exception was logged.
- **Timestamp** — when the error occurred.

Errors are persisted to the database, so they survive restarts and are shared across replicas.
Entries from Entity Framework Core and the error-log pipeline itself are deliberately excluded
to avoid feedback loops.

::: tip Client-side error reports are separate
The in-app "report this error" action (`POST /api/errors`) logs a **warning**, not an error,
so client-reported issues do not appear in the Error Log.
:::

## Using the page

- The list is newest-first and paginated.
- The **All / Error / Critical** toggle filters by severity.
- Selecting a row opens a detail panel with the full stacktrace (copyable).
- The page refetches when you return to the tab; there is no live stream.

## Automatic rotation & cleanup

A scheduled background service prunes the table automatically so it never grows unbounded:

- **Age-based rotation** — errors older than the retention window are deleted.
- **Count cap** — only the newest *N* errors are kept, bounding the table during an error storm.

Configure it under the `ErrorLogCleanup` section of `appsettings.json`:

```json
{
  "ErrorLogCleanup": {
    "RetentionDurationDays": 14,
    "CleanupIntervalHours": 6,
    "MaxRetained": 10000
  }
}
```

| Setting | Default | Meaning |
| --- | --- | --- |
| `RetentionDurationDays` | `14` | Errors older than this are removed. |
| `CleanupIntervalHours` | `6` | How often the cleanup pass runs. |
| `MaxRetained` | `10000` | Hard cap on the number of newest errors kept. |

See [Configuration](/admin/configuration) for how settings files and environment variables are
applied.
