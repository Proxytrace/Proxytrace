# User Management

The **Users** page is an admin-only screen for managing who can access Proxytrace, what they can
do, and which projects they belong to. It is reached from the sidebar under **Configure → Users**
and is only visible to users with the **Admin** role. The underlying `/api/users` endpoints
enforce the same restriction — client-side gating is convenience only.

## Roles

Every user holds exactly one role:

| Role | Capabilities |
| --- | --- |
| **Member** | Standard read/write access to project data. |
| **Admin** | Everything a Member can do, plus user management (this page). |

Change a user's role with the inline **Role** dropdown on their row — this promotes or demotes
them immediately.

::: warning The last Admin is protected
You cannot demote or delete the **last remaining Admin**, and you cannot change or delete **your
own** account from this page. Those actions are disabled in the UI and rejected by the API
(HTTP 409), so the instance can never be locked out of administration.
:::

## Adding users (local mode)

When Proxytrace uses local username/password authentication, users are onboarded by invitation —
there is no self-service sign-up:

1. Under **Invite a user**, enter the person's **email**, pick their initial **role**, and click
   **Create invite**.
2. Proxytrace generates a single-use invite link (valid for 7 days). **Copy the link and share it
   yourself** — Proxytrace does not send email.
3. The recipient opens the link, sets a password, and is signed in. They now appear in the
   **All users** list.

Outstanding invitations are listed under **Pending invites** with their status (Pending, Used, or
Expired). Use **Revoke** to cancel one that hasn't been used yet.

::: warning Free tier is single-user
The **Free** tier is limited to a **single user**. Once that seat is taken, creating an invite is
rejected with an upgrade prompt — user management is effectively disabled until you upgrade. See
[Licensing](/admin/licensing).
:::

## Assigning users to projects

Click **Projects** on a user's row to open the project assignment editor. Tick a project to add
the user as a member; untick to remove them. The same membership can also be managed from the
project side under **Settings → Projects**.

## How this works with OIDC (SSO)

When Proxytrace is configured against an external **OIDC** identity provider, account creation is
delegated to that provider:

- **No invitations or passwords.** The invite form and pending-invites list are hidden, and the
  invite/sign-up/login endpoints are disabled — your IdP owns authentication.
- **Just-in-time provisioning.** A user record is created automatically the first time someone
  signs in through the IdP. The **very first** user to sign in becomes an **Admin**; everyone
  after that starts as a **Member**.
- **Roles still live in Proxytrace.** Promotions and demotions you make here are persisted and
  survive subsequent logins — the IdP does not overwrite them.
- **Removal is local.** Deleting an SSO user removes their Proxytrace record (and project
  memberships), but does **not** disable them at the identity provider. If their IdP account is
  still active, they will be re-provisioned as a **Member** the next time they sign in. To remove
  someone permanently, deactivate them at the IdP (optionally also deleting the local record to
  revoke their current role and project access right away).

The **Sign-in** column shows each user's source — **Local** for password accounts, **SSO** for
OIDC-provisioned ones.

See [Configuration](/admin/configuration) for how to switch between local and OIDC authentication.
