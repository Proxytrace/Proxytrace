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
- **Click a row** to jump straight to that call in the Traces list (it opens focused on the flagged
  trace), where you can read the full conversation, tokens, and timing.

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

### Managing detectors

Create, edit, enable/disable, and delete detectors from the dashboard's detector management area.
Deleting a detector also removes its past flags and the hidden reviewer it used — it's a clean
removal, not a soft disable (use the enable toggle if you only want to pause it).
