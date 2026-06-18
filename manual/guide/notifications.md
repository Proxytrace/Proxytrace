# Notifications

The **Notifications** section on the [Dashboard](/guide/dashboard) surfaces alerts and
updates for the current project in one place. Today it is driven by **anomaly detection** —
Proxytrace automatically watches your test runs and raises an alert when something goes
wrong — but the section is multi-purpose and will carry other kinds of notifications over
time.

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

An unread count is shown on the section header so you can see at a glance whether anything
needs attention.

## Scope

Notifications are scoped to the currently selected **project** (plus any system-wide
notifications). Switch projects from the sidebar selector to see another project's
notifications.

::: tip Coming soon
The notification system is built to be extendable. Future releases will surface additional
notification kinds (such as a ready optimization proposal) in this same section, and add
delivery channels beyond the dashboard — for example email.
:::
