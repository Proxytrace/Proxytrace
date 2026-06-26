# Two-Factor Authentication

Two-factor authentication (2FA) adds a second step to signing in: after your password, Proxytrace
asks for a short code from an **authenticator app** on your phone. Even if someone learns your
password, they can't get in without your device. It's optional, free, and you turn it on yourself.

> 2FA applies to password (local) sign-in. If your organization signs in through a company identity
> provider (SSO), two-factor authentication is handled there instead, and this page won't apply.

## What you'll need

An authenticator app on your phone, such as **Google Authenticator**, **Microsoft Authenticator**,
**Authy**, or **1Password**. Any app that supports standard time-based codes (TOTP) works.

## Turning it on

1. Open the **account menu** from the avatar button in the top-right corner and choose
   **Account security**.
2. Under **Two-factor authentication**, click **Set up two-factor authentication**.
3. **Scan the QR code** with your authenticator app. (Can't scan? Enter the key shown beneath the
   code manually instead.)
4. Your app now shows a **6-digit code** that changes every 30 seconds. Type the current code into
   **Authentication code** and click **Verify & enable**.
5. Proxytrace shows your **backup codes** — save them now (see below). Click **Done**.

That's it: the status changes to **Enabled**, and your next sign-in will ask for a code.

## Your backup codes

When you enable 2FA you're given **10 one-time backup codes**. Each one works **once** and lets you
sign in if you ever lose access to your authenticator app.

- **Save them somewhere safe** — a password manager, or printed and stored securely.
- They are shown **only once**. Use **Copy** or **Download** before closing the dialog.
- Each code is single-use; once used, it can't be used again.

## Signing in with 2FA

After you enter your email and password, Proxytrace asks for your **authentication code**. Open your
authenticator app and type the current 6-digit code. Lost your phone? Enter one of your **backup
codes** in the same box instead.

## Turning it off

On the **Account security** page, click **Disable two-factor authentication** and confirm with your
password. Your backup codes are discarded. You can set 2FA up again at any time (you'll get a fresh
secret and a new set of backup codes).

## Locked out?

If you've lost both your authenticator app **and** your backup codes, ask an administrator to reset
two-factor authentication for your account. Once they do, you can sign in with just your password and
set 2FA up again.
