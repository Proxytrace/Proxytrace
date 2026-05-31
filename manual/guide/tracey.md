# Tracey — the In-App AI Assistant

Tracey is a conversational assistant that lives in a chat drawer on the right edge of the
app. She understands plain-language requests, reads your project's live state (agents, test
suites, runs, proposals, dashboard stats), navigates you around the UI, and can run a small
set of actions on your behalf.

Tracey is itself an AI agent running on your project's **system endpoint**. Her own
reasoning calls are routed back through the Proxytrace proxy, so every step she takes is
captured as a trace — she is the platform's first dogfood agent.

## Opening the drawer

Click the **Tracey** button in the top bar (near the health indicator and your avatar). The
drawer slides in and stays open as you navigate, so the conversation persists across pages.
Your conversation is also remembered per project on this device until you clear it.

## Asking questions

Type a request and press **Enter** (use **Shift+Enter** for a newline). Examples:

- "List my agents."
- "Show me the token usage for the Customer Support Agent."
- "Which proposals are waiting for review?"
- "Take me to the test runs page."

Tracey fetches live data before answering and shows compact result previews with
**"Open full view"** deep-links that jump you to the relevant page. If a request is
ambiguous (for example, several agents match a name), she asks a brief clarifying question
rather than guessing.

## Running actions

Two actions change state and are therefore **confirmation-gated**:

| Action | What it does |
|--------|--------------|
| **Start a test run** | Runs a suite against an agent's endpoint. |
| **Approve / reject a proposal** | Sets an optimization proposal's status. |

By default Tracey shows a **Confirm / Cancel** card summarizing the action before anything
happens. Nothing is executed until you confirm.

### Auto-approve

The drawer header has an **Auto-approve** toggle (default **off**). When you turn it on,
Tracey performs write actions immediately without showing the confirmation card. Turn it off
again to return to the confirm-first behavior.

## Clearing the conversation

Use **Clear conversation** in the drawer header to start fresh. This wipes the locally
stored thread for the current project.

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
