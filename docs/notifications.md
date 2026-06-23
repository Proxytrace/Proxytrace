# Notifications

This page covers the notification system architecture: the extensibility seam, the two built-in
channels, recipient resolution, the email settings store and at-rest encryption, and the SMTP
sender. See [`docs/sse-events.md`](sse-events.md) for the SSE broadcaster and event payload
shapes that the Dashboard channel uses.

## Architecture overview

```
AnomalyDetectionService (or any future producer)
        │
        ▼
INotificationService.NotifyAsync(NotificationRequest)
        │
        ├── [dedup check] FindActiveByTargetAsync → return early if duplicate
        │
        ├── DashboardNotificationChannel.DeliverAsync  ─→ DB persist + SSE broadcast
        └── EmailNotificationChannel.DeliverAsync      ─→ recipient resolution + SMTP send
```

### `INotificationChannel` — the extensibility seam

`Proxytrace.Application/Notifications/INotificationChannel.cs`

Every delivery channel implements this interface. Autofac registers all implementations and
`NotificationService` receives them as `IEnumerable<INotificationChannel>`. Adding a new channel
(webhook, Slack, etc.) requires only a new `INotificationChannel` registration — no changes to
the service or any caller.

```csharp
public interface INotificationChannel
{
    string Name { get; }
    Task DeliverAsync(NotificationRequest request, CancellationToken cancellationToken = default);
}
```

### `NotificationService` — fan-out and de-duplication

`Proxytrace.Application/Notifications/Internal/NotificationService.cs`

The single `NotifyAsync` entry point:

1. **De-duplicates** — if the request carries a `TargetKind`/`TargetId`, it checks whether an
   active notification already exists for that target. If one does, the request is dropped before
   any channel is called. De-duplication previously lived in `DashboardNotificationChannel`; it
   was moved here so all channels (including email) are guarded by the same check.

2. **Fan-outs** — calls `DeliverAsync` on each registered channel in sequence. A channel throwing
   is caught and logged; remaining channels still run. `OperationCanceledException` on the passed
   token is re-thrown to stop the loop cleanly.

### `DashboardNotificationChannel`

`Proxytrace.Application/Notifications/Internal/DashboardNotificationChannel.cs`

- Creates and persists a `Notification` domain entity via `INotificationRepository`.
- Publishes a `NotificationCreatedEvent` via `INotificationBroadcaster` so open browser sessions
  receive the live SSE push.
- De-duplication is handled upstream by `NotificationService`; this channel no longer checks.

See [`docs/sse-events.md`](sse-events.md) for the `notification-created` /
`notification-status-changed` event shapes and the `/api/notifications/stream` endpoint.

### `EmailNotificationChannel`

`Proxytrace.Application/Notifications/Internal/EmailNotificationChannel.cs`

Resolves recipients and sends one email per recipient with failure isolation:

1. Loads `EmailSettings` from `IEmailSettingsStore`. If settings are absent or `Enabled` is
   false, returns immediately.
2. Checks the operator-wide `MinSeverity` floor — if the notification's severity is below it,
   returns.
3. Resolves candidates:
   - **Project-scoped** (`request.ProjectId` is set): loads the project and uses its `Members`.
   - **Global** (`ProjectId` is null): loads all users via `IRepository<IUser>`.
4. Filters candidates to those whose `EmailNotificationsEnabled` is true, whose
   `EmailNotificationMinSeverity` the notification's severity meets, and who have an email
   address.
5. Builds a multipart HTML+text email (title/message HTML-encoded; a "View details" link added
   when `settings.AppBaseUrl` and `request.TargetKind`/`TargetId` are present).
6. Calls `IEmailSender.SendAsync` per recipient. A send failure is logged and skipped; remaining
   recipients still receive their email.

Target deep links route to `/runs?id=`, `/agents?id=`, or `/proposals?id=` depending on
`NotificationTargetKind`.

> **Default thresholds.** A new user's `EmailNotificationMinSeverity` defaults to `Info` (surfaced as
> the **All** option in the account-menu control). Net email volume is bounded by the operator-level
> `EmailSettings.MinSeverity` floor (step 2), which the admin form defaults to `Warning` — so a
> default install emails only `Warning` + `Critical`. The per-user control exposes **All** /
> **Critical** / **None** only (there is no per-user `Warning`); see
> `frontend/src/components/layout/EmailNotificationMenuItems.tsx`.

## Email settings store

### `EmailSettings` record

`Proxytrace.Application/Notifications/EmailSettings.cs`

An immutable record holding the operator SMTP configuration. `Password` is plaintext **in
memory**; it is encrypted at rest by the store. The store mirrors the `StoredLicense` single-row
pattern: at most one row exists in the database.

Fields: `Enabled`, `SmtpHost`, `SmtpPort`, `Security` (`SmtpSecurity` enum — maps to MailKit's
`SecureSocketOptions`), `Username`, `Password`, `FromAddress`, `FromName`, `AppBaseUrl`,
`MinSeverity`.

### `IEmailSettingsStore`

`Proxytrace.Application/Notifications/IEmailSettingsStore.cs`

```csharp
Task<EmailSettings?> GetAsync(CancellationToken cancellationToken = default);
Task SaveAsync(EmailSettings settings, CancellationToken cancellationToken = default);
```

`GetAsync` returns the password already decrypted. `SaveAsync` encrypts before writing.
Implemented by `Proxytrace.Storage/Internal/Entities/EmailSettings/EmailSettingsStore.cs`.

### `ISecretProtector` — at-rest encryption

`Proxytrace.Application/Security/ISecretProtector.cs`

A reusable seam for reversible at-rest encryption, backed by ASP.NET Data Protection:

```csharp
public interface ISecretProtector
{
    string Protect(string plaintext);
    string Unprotect(string ciphertext);
}
```

`DataProtectionSecretProtector` (`Proxytrace.Application/Security/Internal/`) creates a
protector with purpose `"Proxytrace.Secrets.v1"`. The key ring is stored under
`PROXYTRACE_DATA_DIR` in container deployments — without a persistent volume the keys are
ephemeral and a restart invalidates any stored ciphertext.

`ISecretProtector` is a general seam. The email SMTP password is the first secret encrypted
through it. Retrofitting at-rest encryption to **other existing secrets** is tracked as
[GitHub issue #181](https://github.com/Proxytrace/Proxytrace/issues/181).

## SMTP sender

### `IEmailSender`

`Proxytrace.Application/Notifications/IEmailSender.cs`

```csharp
Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
```

`EmailMessage` is a simple record: `To`, `ToName?`, `Subject`, `HtmlBody`, `TextBody`.

### `SmtpEmailSender`

`Proxytrace.Application/Notifications/Internal/SmtpEmailSender.cs`

Implemented with **MailKit**. Reads `EmailSettings` per call via `IEmailSettingsStore`, so SMTP
configuration changes take effect immediately without a restart. Opens a fresh `SmtpClient`
connection per send (30 s connect timeout), authenticates if `Username` is set, sends, and
disconnects cleanly.

`SmtpSecurity` values map to MailKit's `SecureSocketOptions`:

| `SmtpSecurity` | `SecureSocketOptions` |
|---|---|
| `None` | `None` |
| `StartTls` | `StartTls` |
| `SslOnConnect` | `SslOnConnect` |
| `Auto` | `Auto` |

## Adding a new notification channel

1. Create a class implementing `INotificationChannel` in
   `Proxytrace.Application/Notifications/Internal/`.
2. Register it in `Proxytrace.Application/Module.cs` (alongside the existing Dashboard and Email
   registrations).
3. De-duplication and fan-out are handled by `NotificationService` — no changes needed there.
4. If the channel needs per-user opt-in fields, add them to the `IUser` domain interface and the
   `User` entity (following the `EmailNotificationsEnabled` / `EmailNotificationMinSeverity`
   pattern added in `Proxytrace.Storage/Migrations/20260621070146_AddUserEmailNotificationPreferences`).
5. Update the user manual (`manual/guide/notifications.md`) and, if it requires operator config,
   add an admin page under `manual/admin/`.
