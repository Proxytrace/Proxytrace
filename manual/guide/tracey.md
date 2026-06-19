# Tracey — the In-App AI Assistant

::: tip Enterprise feature
Tracey is part of the **Enterprise** tier. On the Free tier the **Tracey AI** sidebar entry
is locked and the page shows an upgrade prompt. See [Licensing](/admin/licensing).
:::

Tracey is a conversational assistant with her own full-page **Tracey AI** view. She
understands plain-language requests, reads your project's live state (agents, test suites,
runs, proposals, dashboard stats), navigates you around the UI, and can run a small set of
actions on your behalf.

Tracey is itself an AI agent running on your project's **system endpoint**. Her own
reasoning calls are routed back through the Proxytrace proxy, so every step she takes is
captured as a trace — she is the platform's first dogfood agent.

## Opening Tracey AI

Open **Tracey AI** from the sidebar (under *Overview*). The page is a single chat column;
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

![Tracey's opening view: a centered "How can I help?" prompt with starter action chips above the message box.](/screenshots/tracey/opening-view.png)

When a conversation is empty, Tracey opens in a centered "initial view": the message box sits
toward the middle of the panel with **starter chips** above it. Send your first message and the
box glides down to the bottom and the chips disappear; start a **new conversation** and it
glides back up. This is purely presentational — your history still persists per project.

## Quick actions, chips, and the "/" menu

![The Tracey "/" menu: curated Quick Actions (List agents, Plot token usage, Run a suite, Review proposals, Optimize an agent) above the Tools list.](/screenshots/tracey/menu.png)

In the opening view, **chips** surface common quick actions (e.g. *List agents*, *Plot token
usage*, *Improve failing runs*). Click one to prefill the message box; edit it if you like,
then send. The chips show only while the conversation is empty.

Type **`/`** at the start of a message to open a picker: curated quick actions on top and the
full list of tools below. Use **↑/↓** to move, **Enter** to choose, **Esc** to dismiss.
Choosing a quick action prefills its full prompt; choosing a tool inserts a `/tool_name`
slash command — send it as-is to invoke that tool directly.

Tracey **streams** her replies as they are generated and renders them as Markdown (headings,
lists, tables, and code blocks).

While Tracey is thinking or replying, the **send** button turns into a **Stop** button — press it
to cancel the response. Stopping halts her generation immediately (the in-flight model call is
cancelled, not left running in the background) and ends the turn. If she was waiting on a
long-running action you started — a test run or an optimization theory — stopping only ends her
*waiting*; that action keeps running on the server, and you'll still find its result on the Runs or
Proposals page.

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

Tracey doesn't show a card for everything she looks up. When she's gathering information on the way
to an answer — listing your runs, checking a failure, comparing two runs — those reads appear as a
quiet **collapsed row** showing the **tool name**, its **execution duration**, and a **status** —
*Running* (pulsing), *Done*, or *Failed*. A full card appears only when that card *is* the answer
you asked to see, so the thread stays clean instead of stacking a card per step. Click any collapsed
row to expand it and inspect the tool's **Input** and its **Output** (or **Error** if it failed),
each with a copy button. (Navigation and other plumbing tools always show as this collapsed row.)

## Running actions

These actions change state and are therefore **confirmation-gated**:

| Action | What it does |
|--------|--------------|
| **Start a test run** | Runs a suite against an agent's endpoint, then shows a **live progress card** (see below). |
| **Cancel a test run** | Stops an in-progress run you started by mistake or no longer want. |
| **Build a suite from traces** | Creates a new test suite for an agent, seeded from captured traces you point her at (see *Curating suites from traces*). |
| **Add traces to a suite** | Adds more captured traces to an existing suite as new test cases. |
| **Edit a suite's cases** | Sets a case's expected answer, or removes a case. |
| **Approve / reject a proposal** | Sets an optimization proposal's status. |
| **Submit an optimization theory** | Theorizes a change to an agent and kicks off an A/B test (see *Optimizing an agent*). |

With **Auto-approve** off (see below), Tracey shows a **Confirm / Cancel** card summarizing the
action before anything happens, and nothing is executed until you confirm. With Auto-approve on
(the default), the action runs immediately.

Once a **test run** starts, the chat shows a **live run-progress card**: a progress bar that
fills as cases complete, a running case count, and a pass-rate badge — all streaming in real time
(*queued → running → completed*). When the run finishes the card settles on the final pass/fail
tally; a **View run** link opens the full run page at any point.

After starting a run (or submitting an optimization theory), Tracey **always waits for the result
and reacts in the same reply** — she comes back with an analysis once the run completes, rather
than leaving you to ask. If she's waiting on several runs at once, she waits for all of them and
summarizes together. Very long runs are capped: if one hasn't finished in time she'll tell you it's
still going so you can check back.

### Curating suites from traces

Proxytrace captures every LLM interaction as a trace — and Tracey can turn those real
interactions into a **benchmark test suite**, the same loop the product is built around. Point her
at the traces you care about and she'll do the curation:

- **"Find the failed calls for my support agent and make a suite from them."** Tracey searches the
  captured traces, then **creates a new suite** seeded from them — each trace becomes a test case,
  and the suite is runnable straight away.
- **"Add these traces to the regression suite."** She **adds** them to an existing suite as new
  cases.
- **"Set the expected answer for that case to …"** A captured response isn't always the *ideal*
  answer, so she can **set a case's expected output** — what the case is scored against — or
  **remove** a case that isn't useful.

Each of these is a confirmation-gated write, and the resulting suite renders as a card you can open.
A natural flow: find notable traces → build or extend a suite → refine the key cases → start a run.

### Auto-approve

Below the message box sits an **Auto-approve** toggle (default **on**). While it is on, Tracey
performs write actions immediately without showing the confirmation card. Turn it off to get a
**Confirm / Cancel** card before every write action. Your choice is remembered in the browser.

## Skills

For richer, multi-step jobs, Tracey has **skills** — built-in playbooks she loads **on demand**.
Her everyday instructions stay lean; when your request matches a skill, she pulls in that skill's
detailed steps just for that task and follows them. You don't invoke skills directly — just ask
for what you want in plain language (e.g. "optimize my support agent") and Tracey loads the right
skill herself.

A skill also **unlocks the specialist tools** that task needs. To keep her everyday toolset
focused — and her tool selection sharp — Tracey carries only a lean core by default (navigation,
manual search, the inline renderers, the question widget, and reading your agents). The tools for a
particular area come in *with* its skill, so the first time a request touches that area she loads
the matching skill, which brings both the playbook and its tools. A loaded skill stays loaded for
the rest of the conversation, so she only loads each one once. This is automatic and changes
nothing about how you talk to her; you may just notice a brief "loading skill" step.

Her skills cover:

| Skill | Loads when you ask about… |
|-------|---------------------------|
| **Test suites & runs** | your suites, test runs, results/pass rates, why a run failed, comparing two runs, or starting/cancelling a run |
| **Suite curation** | building a suite from captured traces, or adding/removing/editing a suite's test cases |
| **Review proposals** | listing or reviewing proposals, or approving/rejecting one |
| **Project insights** | overall stats/usage/cost, a provider, or finding/inspecting captured traces |
| **Optimize an agent** | optimizing, improving, or tuning an agent (below) |

## Optimizing an agent

Ask Tracey to **optimize, improve, or tune an agent** and she runs a complete optimization loop
for you. There's an **Optimize an agent** starter chip for it, too.

She needs two things: the agent must **exist** and it must have a **test suite** (the benchmark
the change is measured against). If the agent has no suite, Tracey tells you and stops — create a
suite first.

The flow:

1. **Theory.** Tracey grounds a hypothesis in real evidence before proposing anything: she checks
   which theories were **already tried** (so an invalidated idea isn't re-submitted), digs into
   the latest run's **failing cases** — each test's actual response and every evaluator's verdict
   and reasoning — **compares runs** to see which cases a previous change fixed or regressed, and
   can **search the agent's captured traces** for errors or suspicious calls. From that she
   theorizes **one** concrete change — a rewritten **system prompt**, a **model switch**, or a
   **tool update** — with a rationale that cites what she found. After you confirm, she submits
   it as an **optimization theory**.
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
button) — use it to start fresh. This wipes the locally stored thread for the current project —
along with any cached result data Tracey kept in your browser for that project — and returns
Tracey to her opening view.

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

If a turn needed more tool steps than Tracey's per-turn budget allows, the row shows a
**"Step limit reached"** notice — she ran out of steps before she could answer. Just ask her
to continue.

Very long conversations stay fully visible in the chat, but Tracey only *considers* the most
recent stretch of the thread when answering (this keeps long sessions fast and affordable). If
she seems to have forgotten something from much earlier, restate it or start a fresh
conversation.

## Privacy & security

Tracey's chat runs **same-origin**: the browser calls the Proxytrace API with your normal
session (JWT), and the API forwards each request to your model provider server-side. Your
upstream provider credentials never reach the browser.

> Tracey makes real model calls, so she needs a configured provider with a valid key.
> Interactive features including Tracey are unavailable in read-only kiosk mode (no
> `Kiosk:Endpoint` configured); they are fully enabled in interactive kiosk mode.
