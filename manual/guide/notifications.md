# Notifications

Open the **Notifications** inbox from the bell icon in the top bar — a badge shows the unread
count, and clicking it opens a panel listing alerts and updates for the current project in one
place. Today it is driven by **anomaly detection** — Proxytrace automatically watches your test
runs and raises an alert when something goes wrong — but the inbox is multi-purpose and will
carry other kinds of notifications over time.

![The notifications inbox open from the top-bar bell icon, listing anomaly alerts and a ready optimization proposal](/screenshots/notifications/inbox.png)

## Anomaly alerts

After every test run, Proxytrace compares the result against that suite's recent history and
raises a notification when it detects a **negative anomaly**:

- **Test run failed** — the run could not complete, most often because the model endpoint was
  unavailable. Flagged as **Critical**.
- **Pass-rate drop** — the suite's pass rate fell sharply compared with its recent baseline.
  Flagged **Warning**, or **Critical** for a large drop.
- **Latency increase** — average response latency rose well above the recent baseline.
  Flagged **Warning**.

The pass-rate and latency checks only fire once a suite has enough run history to form a
reliable baseline, so a brand-new suite won't produce false alarms — a failed run is always
reported.

## Working with notifications

- Notifications appear **live**, without refreshing the page.
- Each alert is colour-coded by **severity** (Info, Warning, Critical) and shows when it was
  raised.
- **View details** deep-links to the run, agent, or proposal the notification is about.
- **Mark as read** keeps a notification in the list but clears it from the unread count.
- **Dismiss** removes it from the list.

An unread count is shown on the bell badge and the panel header so you can see at a glance
whether anything needs attention. When there's nothing to report the panel shows a short
placeholder explaining where notifications will appear.

![Close-up of the notifications panel — severity-coded alerts, relative timestamps, and per-item mark-read and dismiss actions](/screenshots/notifications/inbox-panel.png)

## Scope

Notifications are scoped to the currently selected **project** (plus any system-wide
notifications). Switch projects from the sidebar selector to see another project's
notifications.

::: tip Coming soon
The notification system is built to be extendable. Future releases will surface additional
notification kinds in this same inbox, and add delivery channels beyond the in-app inbox —
for example email.
:::
