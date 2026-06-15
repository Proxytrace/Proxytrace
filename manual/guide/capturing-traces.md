# Capturing Traces

A **trace** (internally an *Agent Call*) is one fully captured LLM interaction. Once your
client routes through the [proxy](/guide/proxy-setup), every call is recorded
automatically.

## What a trace contains

- The full **message history** sent to the model (system, user, assistant, tool messages).
- The **tool definitions** available to the agent for that call.
- **Model parameters** (model name, temperature, etc.).
- The **provider** the call was routed to.
- **Latency** and **token usage** (with per-token cost from the model endpoint).
- The model's **response**, including any tool requests.

## Exploring traces

Open **Traces** in the sidebar to browse captured calls. Real-time updates stream in via
Server-Sent Events, so new traces appear as your agents run — no refresh needed.

![The Traces view: the capture timeline, the page-summary stat cards, and the table of captured calls.](/screenshots/traces/list.png)

Typical things you can do:

- Inspect a single trace end to end: the conversation, the tools offered, and the response.
- Filter and search across captured calls to find specific behaviors or regressions.
- Identify traces worth promoting into a benchmark — see
  [Test Suites & Cases](/guide/test-suites-and-cases).

### Filtering, search, and paging

- **Page summary** is the band of stat cards just above the table: number of traces on the
  current page, total tokens (with the input/output split), total cost, average latency (with
  its ± spread), and the error rate (share of non-2xx calls). It rolls up only the traces on
  the *current page* and recomputes as you page, filter, or change the time range.
- **Agent filter** (the *Agent:* dropdown in the toolbar) focuses the table on one agent. Only
  agents that actually have traces in the selected time range are listed.
- **Search** matches anywhere inside captured message content (and the response), not just
  at the start of a word — searching `efund` finds a trace mentioning `refund`. You can also
  search by model name or the short trace ID.
- **Per page** lets you choose how many traces to show at once (20, 50, 100, or 200). The
  total trace count for the current filter is shown alongside the pager.

### The timeline

![The traces timeline strip — each bar's height is the trace count for that time slice, with failed calls marked in red along the bottom.](/screenshots/traces/timeline.png)

Above the table a **timeline strip** plots how many traces were captured over the selected
range, so you can spot ingestion hotspots at a glance. Each bar's height is the trace count
for that slice of time; the **red** portion at the bottom marks failed calls (HTTP errors),
making error spikes easy to find. A **time axis** along the bottom labels the window, and
hovering a bar shows its exact time, count, and error count.

- **Drag across the timeline** to zoom into that window. The view re-spans to your selection —
  the bars redraw at higher resolution *and* the table narrows to the same range, so you can
  drill straight into a spike.
- **Scroll up** over the timeline to zoom in toward the cursor; **scroll down** to step back
  out one level (each zoom-in is remembered, so you can drill in repeatedly and reverse out).
- **Click a bar** to focus its time bucket directly.

If you zoom into a window with no traces, the strip stays put (showing *"No traces in this
range"*) so you can always scroll back out.
- The timeline reflects the **same agent, search, and system-trace filters** as the table,
  so its shape always matches what you're looking at.

### The time-range picker

The **time-range picker** (the clock button in the toolbar) controls the window. It offers
one-click **quick ranges** (last 15 minutes through last 30 days) and a **custom range** with
explicit From/To date-times — the same picker used on the Error Log. Drag-zooming the timeline
simply sets a custom range, which the picker then shows. Use **Clear** (or the ✕) to return to
all-time.

When you **first** open Traces, the range automatically snaps to the smallest quick range that
still contains data, so you never land on an empty view. After that, your filter bar — time
range, agent, search, and the system-trace toggle — is **remembered in your browser**, so it
survives a refresh or navigating away and back. The auto-snap only runs until you have a saved
range; once you've picked one it is always restored. The agent filter is remembered **per
project** (agents belong to a project), while the time range, search, and toggle are shared
across projects.

### The trace detail panel

![The trace detail panel: latency, token and cost metrics above the Messages tab, which lays out the system, user, and assistant conversation.](/screenshots/traces/detail.png)

Click a trace to open its detail panel. The header shows the trace ID with a **copy**
button beside it that puts the full ID on your clipboard. The **Messages** tab lays out the
conversation as a stack of expandable blocks:

- **System messages** and **tool calls** start **collapsed** to keep long traces scannable —
  click a block's header to expand it. User and assistant messages start expanded.
- **Hover any message block** to reveal a **copy** button that puts that block's content on
  your clipboard (the message text, or the tool call's name, arguments, and result).
- **Switch how a message body is displayed** with the format dropdown in the top-right of
  each expanded user/assistant/system message header:
  - **RAW** — the captured text exactly as sent, preserving whitespace.
  - **JSON** — pretty-printed and syntax-highlighted (for JSON payloads).
  - **Markdown** — rendered prose (headings, lists, tables, code, links).
  - **HTML** — the content rendered as HTML. Markup is always sanitized first (scripts,
    event handlers, and unsafe links are stripped); a warning appears when anything was
    removed.

  When you expand a message, Proxytrace **auto-picks** the most useful format — valid JSON
  opens as JSON, content with Markdown syntax opens as Markdown, everything else as RAW
  (HTML is opt-in). If a body isn't valid for the chosen format (e.g. JSON that won't parse),
  a warning shows and the raw text is displayed instead.

Close the panel by pressing `Esc` or clicking outside it. Use the arrow buttons (or the
`←`/`→` keys) to step to the previous/next trace.

While a trace is open, its ID is written to the page URL (`?trace=…`), so the link is
shareable and the same trace re-opens after a refresh — even if it isn't on the current page,
Proxytrace fetches it by ID.

### Multi-turn conversations

![A multi-turn conversation expanded in the traces table — a "turns" group opened into its individual Turn 1, Turn 2, and Turn 3 calls.](/screenshots/traces/conversation.png)

Calls that share a conversation are grouped into a single collapsible row. The group's
leading **turns** badge shows how many calls it contains; click the row to expand the
individual turns. The group's status column shows the exact code (e.g. `200`) when every
turn shares it, `2xx` when all turns succeeded with differing 2xx codes, and `mixed` when
the turns disagree.

## From traces to everything else

Traces are the raw material for the rest of Proxytrace:

- **Agents** are detected from traces — see [Agents](/guide/agents).
- **Test cases** are curated from traces — see
  [Test Suites & Cases](/guide/test-suites-and-cases).
- **Optimization proposals** are grounded in trace and evaluation data — see
  [Optimization Proposals](/guide/optimization-proposals).
