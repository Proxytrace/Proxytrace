# Configuring Email (SMTP)

Proxytrace can send notification alerts by email. Operators configure the outgoing SMTP
connection from the admin-only **Settings** hub — open **Settings** from the sidebar, then
choose **Email notifications** (direct link: `/settings/email`).

::: info Admin only
The Email notifications settings page is accessible only to users with the Admin role. Users
manage their own per-account email preferences from the account menu (see
[Email notifications](/guide/notifications.html#email-notifications) in the user guide).
:::

## Fields

### Enable

The **Enable email notifications** toggle must be on for any emails to be sent. Turn it off to
suspend delivery without losing your SMTP configuration.

### SMTP host

The hostname or IP address of your SMTP server (e.g. `smtp.example.com`).

### SMTP port

The port your SMTP server listens on. Common values:

| Port | Typical use |
|------|-------------|
| `25` | Unencrypted relay (uncommon for SaaS) |
| `465` | SSL/TLS (implicit) |
| `587` | STARTTLS (recommended) |

### Security

How the SMTP connection is secured:

| Option | Meaning |
|--------|---------|
| **None** | No encryption. Suitable only on trusted internal networks. |
| **STARTTLS** | Upgrades to TLS after the initial connection. Most common for port 587. |
| **Auto** | MailKit picks the best option the server offers. |
| **SSL** | Implicit TLS from the start. Typically used with port 465. |

### Username and password

Credentials for SMTP authentication. Leave username blank if your server does not require
authentication.

The password is **write-only**: once saved, it is never shown again — the field displays
"Password is set" instead of the value. To change the password, type a new one into the field
and save. Leaving the field blank keeps the previously stored password, so you can edit the
other settings without re-entering it.

**Passwords are encrypted at rest** using ASP.NET Data Protection. The encryption key ring is
stored in `PROXYTRACE_DATA_DIR` (the Docker `appdata` volume). If `PROXYTRACE_DATA_DIR` is not
set, keys are ephemeral and a container restart will invalidate the stored password, requiring
you to re-enter it. Always mount a persistent volume in production.

### From name and from address

The display name and email address that appear in the **From** field of every notification email
(e.g. `Proxytrace Alerts <alerts@example.com>`). Most SMTP servers require the from address to
match an authenticated sender domain.

### App URL

The base URL of your Proxytrace installation (e.g. `https://proxytrace.example.com`). This is
used to build deep links inside notification emails — clicking "View details" in an email opens
the relevant run, agent, or proposal. Leave blank if you do not want deep links included.

### Minimum severity

The operator-wide floor for email delivery. Notifications below this severity are never emailed,
regardless of individual user settings:

| Value | Effect |
|-------|--------|
| **Info** | All notifications may be emailed. |
| **Warning** | Only Warning and Critical notifications are emailed. |
| **Critical** | Only Critical notifications are emailed. |

Individual users can raise this threshold further from their own account preferences, but they
cannot lower it below the operator floor.

## Send test email

The **Send test email** button sends a test message to the email address of the currently
signed-in admin. Use it to verify your SMTP settings are correct after saving. Any connection
or authentication error is displayed inline so you can diagnose the problem without checking
server logs.

## Production checklist

- Mount a persistent volume at `PROXYTRACE_DATA_DIR` so the Data Protection key ring survives
  restarts and the stored SMTP password stays decryptable.
- Use a dedicated SMTP sender address on an authenticated domain to avoid deliverability issues.
- Set **App URL** so that deep links in emails resolve correctly.
- Set a **Minimum severity** appropriate for your noise tolerance — **Warning** is a sensible
  default for most teams.
