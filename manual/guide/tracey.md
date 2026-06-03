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
the top bar (near the health indicator and your avatar). The page is a single chat column;
plots, tables, entity cards, and question widgets render **inline in the conversation** as
Tracey produces them. Your conversation is remembered per project on this device until you
clear it.

## Asking questions

Type a request and press **Enter** (use **Shift+Enter** for a newline). Examples:

- "List my agents."
- "Plot the token usage per agent."
- "Which proposals are waiting for review?"
- "Take me to the test runs page."

Tracey fetches live data before answering. If a request is ambiguous (for example, several
agents match a name) or she needs a few decisions from you before acting, she asks with an
inline **questions widget** rather than guessing — see *Inline components* below.

## Answers from the manual

Tracey also uses **this manual** as a knowledge base. For how-to, what-is, and setup
questions about Proxytrace itself — "How do I set up the proxy?", "What does a numeric-match
evaluator do?", "How does agent versioning work?" — she searches the user guide and answers
from it, rather than guessing.

When her answer draws on the manual, she **cites the source as a clickable link** back to the
exact guide section, so you can open the full page and read more. The split is simple:
questions about *your data* (agents, runs, stats) are answered from live project state;
questions about *how the product works* are answered from the manual, with citations.

## The opening view

When a conversation is empty, Tracey opens in a centered "initial view": the message box sits
toward the middle of the panel with **starter chips** above it. Send your first message and the
box glides down to the bottom and the chips disappear; start a **new conversation** and it
glides back up. This is purely presentational — your history still persists per project.

## Quick actions, chips, and the "/" menu

In the opening view, **chips** surface common quick actions (e.g. *List agents*, *Plot token
usage*, *Summarize failing runs*). Click one to prefill the message box; edit it if you like,
then send. The chips show only while the conversation is empty.

Type **`/`** at the start of a message to open a picker: curated quick actions on top and the
full list of tools below. Use **↑/↓** to move, **Enter** to choose, **Esc** to dismiss.
Choosing a quick action prefills its full prompt; choosing a tool inserts a `/tool_name`
slash command — send it as-is to invoke that tool directly.

Tracey **streams** her replies as they are generated and renders them as Markdown (headings,
lists, tables, and code blocks).

## Inline components

Tracey renders rich UI **directly in the chat thread** rather than dumping raw numbers:

- **Charts** — bar, line, or area plots of your data, with gridlines, a max/min/avg/last
  summary, and hover for the exact value of any point.
- **Tables** — tabular comparisons; numeric columns are right-aligned for easy scanning, and a
  footer reports the row and column count.
- **Text cards** — longer markdown (fully rendered), JSON, or code. Code and JSON include a
  copy button and expand when long.
- **Entity cards** — a single agent, test suite, test run, proposal, provider, or trace shown
  as a card. Click a card to jump straight to that entity's page in the app.
- **List cards** — *List agents/suites/runs/proposals* render as a titled, counted list. Each
  row links to its entity, and **View all** (or **+N more**) opens the full page.
- **Stats cards** — *dashboard stats* and per-agent stats render as a grid of key figures
  (calls, tokens, latency, cost, pass rate) with an **Open** link to the matching page.
- **Questions widget** — when Tracey needs to ask you something, she shows a stepped widget
  that walks you through one question at a time (with a *Step 1 of N* indicator when there's
  more than one). Each question is a **vertical list of options** plus a static
  **"Something else…"** free-text field for a custom answer. Some questions allow **multiple**
  selections; others only one, and the free-text field is exclusive with the option picks.
  Click **Next** to move on (**Submit** on the last one); the widget then collapses into a
  read-only summary of your questions and answers, which are sent back as your next message.

## Tool calls

For tools without a dedicated component (such as navigation), the call appears as a collapsed
row showing the **tool name**, its **execution duration**, and a **status** — *Running*
(pulsing), *Done*, or *Failed*. Click the row to expand it and inspect the tool's **Input** and
its **Output** (or **Error** if it failed), each with a copy button.

## Running actions

These actions change state and are therefore **confirmation-gated**:

| Action | What it does |
|--------|--------------|
| **Start a test run** | Runs a suite against an agent's endpoint. |
| **Approve / reject a proposal** | Sets an optimization proposal's status. |
| **Submit an optimization theory** | Theorizes a change to an agent and kicks off an A/B test (see *Optimizing an agent*). |

By default Tracey shows a **Confirm / Cancel** card summarizing the action before anything
happens. Nothing is executed until you confirm.

### Auto-approve

Below the message box sits an **Auto-approve** toggle (default **off**). When you turn it on,
Tracey performs write actions immediately without showing the confirmation card. Turn it off
again to return to the confirm-first behavior.

## Skills

For richer, multi-step jobs, Tracey has **skills** — built-in playbooks she loads **on demand**.
Her everyday instructions stay lean; when your request matches a skill, she pulls in that skill's
detailed steps just for that task and follows them. You don't invoke skills directly — just ask
for what you want in plain language (e.g. "optimize my support agent") and Tracey loads the right
skill herself. The first skill is **Optimize an agent**, below.

## Optimizing an agent

Ask Tracey to **optimize, improve, or tune an agent** and she runs a complete optimization loop
for you. There's an **Optimize an agent** starter chip for it, too.

She needs two things: the agent must **exist** and it must have a **test suite** (the benchmark
the change is measured against). If the agent has no suite, Tracey tells you and stops — create a
suite first.

The flow:

1. **Theory.** Tracey inspects the agent and its recent results, then theorizes **one** concrete
   change — a rewritten **system prompt**, a **model switch**, or a **tool update** — with a short
   rationale. After you confirm, she submits it as an **optimization theory**.
2. **A/B test.** The theory is validated in the background: Proxytrace runs the suite against the
   current agent (baseline) and against the proposed change (candidate), back to back. Tracey
   shows a **theory card** in the chat that streams the status — *Running A/B test…* while it
   works.
3. **Result.** The card resolves to one of two outcomes:
   - **Improved** — the change raised the pass rate, so it becomes a reviewable **optimization
     proposal**. The card shows a **View proposal** link; from there you can approve or reject it
     (and Tracey can do that for you too).
   - **Rejected** — the change didn't improve the agent, so the theory is discarded (kept for
     provenance, visible in the optimization pipeline).

Theories Tracey submits appear alongside optimizer- and user-submitted ones in the project's
optimization pipeline, tagged **via Tracey AI**. Identical theories are de-duplicated and a
project has a cap on how many can be validating at once, so if a submission is a duplicate or the
queue is full, Tracey tells you instead of running it again.

## Clearing the conversation

The controls below the message box include a **New conversation** icon (next to the **send**
button) — use it to start fresh. This wipes the locally stored thread for the current project
and returns Tracey to her opening view.

## Where Tracey's traces appear

Because Tracey runs through the proxy, her LLM calls show up in **Traces** like any other
agent, attributed to the built-in **Tracey** system agent for your project. You can filter
traces to system agents to review exactly what she did and how many tokens it cost.

Each finished Tracey response carries a subtle **status row** beneath it. Because a single
answer can involve several model calls (Tracey calling tools, then answering), the row shows
the **total tokens** and **response time** for the whole turn — the token total matches the
figure the Traces page shows for that turn's conversation group — plus two actions:

- a **copy** button that puts the response text on your clipboard, and
- a **trace icon** that jumps straight to that turn's captured traces in the **Traces** view,
  without hunting for them in the list.

The row appears once the reply has finished streaming, with the totals shown immediately. If
you click the trace icon before the capture has finished saving (ingestion is asynchronous),
you'll see a brief "still being captured" note — try again in a second.

## Privacy & security

Tracey's chat runs **same-origin**: the browser calls the Proxytrace API with your normal
session (JWT), and the API forwards each request to your model provider server-side. Your
upstream provider credentials never reach the browser.

> Tracey makes real model calls, so she needs a configured provider with a valid key and is
> unavailable in read-only demo (kiosk) mode.
