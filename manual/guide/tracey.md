# Tracey — the In-App AI Assistant

Tracey is a conversational assistant with her own full-page **Tracey AI** view. She
understands plain-language requests, reads your project's live state (agents, test suites,
runs, proposals, dashboard stats), navigates you around the UI, and can run a small set of
actions on your behalf.

Tracey is itself an AI agent running on your project's **system endpoint**. Her own
reasoning calls are routed back through the Proxytrace proxy, so every step she takes is
captured as a trace — she is the platform's first dogfood agent.

## Opening Tracey AI

Open **Tracey AI** from the sidebar (under *Overview*), or click the **Tracey** button in
the top bar (near the health indicator and your avatar). The page has a chat column on the
left and an **artifact panel** that opens on the right when she produces a plot, table, or
document. Your conversation is remembered per project on this device until you clear it.

## Asking questions

Type a request and press **Enter** (use **Shift+Enter** for a newline). Examples:

- "List my agents."
- "Plot the token usage per agent."
- "Which proposals are waiting for review?"
- "Take me to the test runs page."

Tracey fetches live data before answering. If a request is ambiguous (for example, several
agents match a name), she asks a brief clarifying question rather than guessing.

## Quick actions, chips, and the "/" menu

Above the message box, **chips** surface common quick actions (e.g. *List agents*, *Plot
token usage*, *Summarize failing runs*). Click one to prefill the message box; edit it if you
like, then send.

Type **`/`** at the start of a message to open a picker: curated quick actions on top and the
full list of tools below. Use **↑/↓** to move, **Enter** to choose, **Esc** to dismiss.
Choosing a quick action prefills its full prompt; choosing a tool inserts a `/tool_name`
slash command — send it as-is to invoke that tool directly.

Tracey **streams** her replies as they are generated and renders them as Markdown (headings,
lists, tables, and code blocks).

## Artifacts (the right panel)

When Tracey visualizes data, she renders an **artifact** in the right panel instead of
dumping raw numbers into the chat — a **chart** (bar/line/area), a **table**, or a **text**
document (markdown, JSON, or code). You can also **Pin to panel** any tool result shown in
the conversation. Switch between multiple artifacts with the tabs in the panel header, and
close the panel with its **✕** button.

## Running actions

Two actions change state and are therefore **confirmation-gated**:

| Action | What it does |
|--------|--------------|
| **Start a test run** | Runs a suite against an agent's endpoint. |
| **Approve / reject a proposal** | Sets an optimization proposal's status. |

By default Tracey shows a **Confirm / Cancel** card summarizing the action before anything
happens. Nothing is executed until you confirm.

### Auto-approve

Below the message box sits an **Auto-approve** toggle (default **off**). When you turn it on,
Tracey performs write actions immediately without showing the confirmation card. Turn it off
again to return to the confirm-first behavior.

## Clearing the conversation

The controls below the message box include a **trash** icon (next to the **send** button) —
use it to start fresh. This wipes the locally stored thread for the current project and clears
any artifacts in the panel.

## Where Tracey's traces appear

Because Tracey runs through the proxy, her LLM calls show up in **Traces** like any other
agent, attributed to the built-in **Tracey** system agent for your project. You can filter
traces to system agents to review exactly what she did and how many tokens it cost.

## Privacy & security

Tracey's chat runs **same-origin**: the browser calls the Proxytrace API with your normal
session (JWT), and the API forwards each request to your model provider server-side. Your
upstream provider credentials never reach the browser.

> Tracey makes real model calls, so she needs a configured provider with a valid key and is
> unavailable in read-only demo (kiosk) mode.
