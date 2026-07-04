# Anomaly Dashboard

The **Anomaly dashboard** is the one place to watch for calls that don't look right — across
every agent in the project, in real time. Where the [Traces](/guide/capturing-traces) list is a
firehose of everything captured and the [outlier chip](/guide/outliers) flags individual rows,
this page steps back and answers "**is anything going wrong right now, and where?**". Open it from
**Anomalies** in the sidebar (just after Traces).

It brings together two kinds of signal:

- **Statistical outliers** — the automatic, per-agent flags (high tokens, high latency, low cache
  hit, many tool calls) described under [Finding Outliers](/guide/outliers). Every plan gets these.
- **Custom detector flags** — anomalies raised by your own [custom detectors](#custom-anomaly-detectors)
  (an Enterprise feature), where an LLM reviews a call against instructions you wrote.

## The Overview

![The Anomalies overview: the recent-anomalies table on the left, with the timeline, summary tiles, and most-flagged-agents ranking on the right](/screenshots/anomaly-dashboard/overview.png)

The Overview tab puts the work list and the statistics side by side: the left column is the table
of [recently flagged calls](#recent-flagged-calls), and the right column gives you the shape of the
window at a glance:

- **Anomaly timeline** — a stacked chart of flagged calls over time, split per agent (the legend
  below the chart names each color), so a spike in one agent stands out from the background. Switch
  the bucket size between **five minutes**, **hourly**, and **daily** to zoom from "what just
  happened" out to "how has this week looked".
- **Summary tiles** — four numbers for the selected window: total **flagged calls**, how many came
  from the built-in **statistical** checks vs. your **custom detectors**, and how many **agents**
  are affected.
- **Most flagged agents** — a ranking of the agents with the most anomalies in the window, each with
  a share bar sized against the worst agent, so the noisiest agent is always at the top of the list
  rather than buried. Click an agent to filter the whole page to it.

The page updates **live** as new calls are captured and as detectors flag them — you don't need to
refresh to see a fresh spike appear.

## Recent flagged calls

The main table lists the **most recently flagged calls**, newest first. Each row shows the agent,
a preview of the user message, why the call was flagged, and when it landed. Calls flagged by a
custom detector carry a **custom-detector chip**; hover it to see which trigger fired and the
reviewer's reasoning for calling the call anomalous.

![The recent-anomalies table: each row names the agent, previews the message, and shows the flags that caught it](/screenshots/anomaly-dashboard/recent-anomalies.png)

- **Filter by agent** to narrow the list to a single agent when you're chasing one problem.
- **Click a row** to open the call's full detail panel right here on the dashboard — the same
  panel as in the [Traces list](/guide/capturing-traces#the-trace-detail-panel), with the
  conversation, tokens, timing, and a warning banner explaining why the call was flagged. Use the
  arrows in the panel header (or your keyboard) to step through the flagged calls one by one.

## Custom anomaly detectors

::: info Enterprise feature
Custom anomaly detectors require an **Enterprise** license. Without one, the dashboard still shows
statistical outliers, but the detector management UI is hidden. See
[Licensing](/admin/licensing).
:::

A **custom detector** lets you describe, in plain language, what "anomalous" means for *your*
agents — something the built-in statistical flags can't know. For example: "flag any reply that
promises a refund", "flag answers that leak an internal system name", or "flag responses that sound
angry". An LLM then reviews matching calls and decides whether each one is anomalous.

Each detector has:

- **A name** and an **enable toggle** — turn a detector on or off without deleting it.
- **Review instructions** — the prompt that tells the reviewing model what to look for and what
  counts as anomalous. This is the heart of the detector.
- **A review model** — the model endpoint the reviewer runs on. Cheaper, faster models keep costs
  down; stronger models catch subtler cases.
- **Triggers** (1–20) — the gate that decides *which* calls are worth reviewing. A trigger is either
  a **phrase** (a plain, case-insensitive word or phrase to look for) or a **regular expression**
  for more precise matching. Only calls whose newest turn contains at least one trigger are sent for
  review.
- **Scope** — apply the detector to **all agents** in the project, or pick specific agents.
- **Block matching requests at the proxy** — an optional real-time mode: instead of only reviewing a
  call *after* it went through, the proxy rejects a matching request **before it reaches the
  provider**. See [Blocking detectors](#blocking-detectors).

![The New detector dialog: name, review instructions, judge model, triggers, and the all-agents and enabled toggles](/screenshots/anomaly-dashboard/new-detector-dialog.png)

### How a review happens

When a new call is captured, each enabled detector in scope checks the new turn against its
triggers. If a trigger matches, the detector sends that turn to its review model with your
instructions. If the model's verdict is **anomalous**, the call is flagged: it gets the
**Custom detector** chip in the Traces list, appears in the recent-flagged list here, and raises a
[notification](/guide/notifications) that deep-links to the trace. If nothing matches a trigger, or
the review comes back clean, nothing happens — the call flows through as normal.

::: warning Triggers keep review costs down
Every trigger match starts **one LLM call** — per matched turn, per detector. That's the point of
triggers: they keep reviews (and their cost) targeted at the calls that could plausibly be a
problem, instead of reviewing every single trace. Write triggers that are specific enough to gate
narrowly, and keep an eye on how often broad phrases match.
:::

### Blocking detectors

Sometimes flagging after the fact is too late — the canonical example is a **secret leak**: once a
password or API key has been sent to the upstream LLM provider, no review can un-send it. Turn on
**Block matching requests at the proxy** and the detector becomes a real-time guard: the proxy
checks every incoming request body against the detector's triggers *before* forwarding it, and on a
match the request is **rejected instead of forwarded** — it never reaches the provider.

For example, a blocking detector with the regex trigger `pass(word)?\s*[:=]\s*\S+` stops requests
that carry something that looks like a credential.

What the caller sees: the proxy answers with **HTTP 403** and an OpenAI-compatible error body whose
`code` is `proxytrace_blocked` and whose message names the detector (never the matched text), so
SDKs fail cleanly with a non-retryable permission error.

What you see: the blocked call still shows up as a **trace**, flagged **Blocked at proxy**, with a
banner in the trace detail explaining that it never reached the provider and which detector and
trigger stopped it. It appears on this dashboard's recent-flagged list live and raises a
[notification](/guide/notifications) — so blocking never hides traffic, it just stops it.

Things to know:

- **Trigger match only.** Blocking uses the detector's phrase/regex triggers — the LLM review never
  runs in the request path (it would add seconds to every call), and blocked calls are not reviewed
  afterwards (there is no reply to review).
- **Matching runs on the raw request JSON** — system prompt, messages, and tool definitions are all
  covered. A pattern that spans quotes or line breaks must match their JSON-escaped form (`\"`,
  `\n`); typical secret patterns are unaffected.
- **Scoped detectors need the agent header.** The proxy can only attribute a request to an agent
  when the client sends the `x-proxytrace-agent` header. A detector scoped to specific agents only
  blocks requests that name one of them; **all-agents** detectors always apply.
- **Changes take effect within about 30 seconds** — the proxy caches the blocking rules briefly.
- **Best-effort, not a hard guarantee.** If the proxy cannot load the rules (for example the
  database is briefly unreachable), it fails open and forwards rather than taking your LLM traffic
  down; the post-hoc review pipeline still flags what slipped through.
- Blocking is part of the same **Enterprise** feature as custom detectors.

### Managing detectors

The **Detectors** tab is a two-column view, like the Evaluators page: the left column lists the
project's detectors (searchable, with a status dot per detector), and the right column shows the
selected detector in full — its review instructions, its triggers, and which agents it applies to.

![The Detectors tab: the detector list on the left, and the selected detector's instructions, triggers, and agent scope on the right](/screenshots/anomaly-dashboard/detectors.png)

- **Create** a detector with **New detector** at the top of the list.
- **Enable or disable** the selected detector with the toggle in the detail header — no need to
  open the edit dialog to pause one.
- **Edit** opens the full form (name, instructions, review model, triggers, scope).
- **Delete** removes the detector *and* its past flags and the hidden reviewer it used — it's a
  clean removal, not a soft disable (use the enable toggle if you only want to pause it).
