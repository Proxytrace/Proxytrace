# Agents

An **Agent** is a definition of an AI agent: its **system prompt**, its **tools**, the
**model endpoint** (model + provider) it runs on, and the **project** it belongs to.
Proxytrace detects agents automatically from captured traces and versions them as they
evolve.

## How agents are detected

As traces flow in, Proxytrace extracts the recurring shape of each agent — the system
prompt, the set of tool definitions, and the model endpoint — and records it as an Agent.
When you change a prompt or tool set in production, that change is captured as a new
version, giving you a history of how the agent evolved.

### Versioning rule

For every incoming call, Proxytrace decides whether the (system prompt, tool-set) pair
matches an existing agent or represents a brand-new one:

1. **Exact match** — the prompt and tool-set are byte-for-byte identical to an existing
   version. The call attaches to that version, no new row is created.
2. **Similar match** — the tool-set is identical when compared by tool name + parameter
   JSON schema (descriptions stripped), and the system prompt is at least 85 % similar
   (normalized Levenshtein ratio). The call creates a **new version** under the existing
   agent, and that version becomes the agent's current version.
3. **No match** — neither rule fires, so Proxytrace creates a brand-new agent with v1.

**Continuation calls.** A follow-up call within the same conversation (same `SessionId`) that
omits tools *and* sends the identical system prompt inherits the previous call's version
without re-evaluating the rules above. If the system prompt changes, the rules apply.

The similarity threshold is configurable via `AgentVersioningOptions.SimilarityThreshold`;
the candidate-cap before Levenshtein is `AgentVersioningOptions.MaxCandidates` (default 32).

### Naming an agent explicitly

A client can skip the matching rules entirely and tell Proxytrace which agent a call belongs
to by sending the **`X-Proxytrace-Agent`** header with the agent's name. When present:

- The call attaches to the named agent in your project, creating that agent the first time
  the name is seen.
- Its version (system prompt + tools) is captured straight from the request — no similarity
  comparison runs, so unrelated prompt or tool changes never split it into a separate agent.

This is how the built-in [Tracey](/guide/tracey) assistant always attributes cleanly to her
own agent. Use it for any client where you already know the agent's identity and want stable
grouping regardless of prompt drift.

### Fixing a misclassification

If Proxytrace created a new agent for what should have been a new version of an existing
one, you can re-parent the version from the agent's detail page:

1. Open the redundant agent.
2. Under **Versions**, click **Move…** on the offending version.
3. Pick the target agent. The version is renumbered to `max(target.versions) + 1`;
   every `AgentCall` referencing the version follows it automatically.
4. If the source agent has no versions left, it is deleted. The whole move runs in a
   single database transaction.

Moving versions into or out of a **system agent** is not allowed.

## The agent detail view

Pick an agent from the searchable list on the left to open its detail panel:

- **Header card** — the agent avatar, name, current version, a *proposals ready* badge
  (when the agent has open [proposals](/guide/optimization-proposals)), and metadata
  (project, trace count, when it was last used). Controls on the right switch the model
  endpoint, **Run** the agent against its test suites, open an overflow (**⋯**) menu —
  open in the [Playground](/guide/capturing-traces), view traces, or view proposals — or
  delete the agent.
- **Performance** — a dedicated card with all key stats as compact tiles, each with a mini
  sparkline: **pass rate** (and its change in percentage points over the window), **traces**,
  **tokens** (with the input/output split), **cost**, and **avg latency**. A `1h / 24h / 7d / 30d`
  selector sets the window, and a **live** indicator marks that the figures update as traces arrive.
- **Definition** (main column) — the **system prompt** (with its word/line count, a copy
  button, and — when a previous version exists — a **Diff vs v*N*** comparison against the
  prior revision), followed by the **tools** list (click a tool to expand its parameters,
  types, and enum values inline).
- **Version history** (right rail) — a timeline of every captured version, newest first,
  each showing its date and tool count with the current version highlighted; use **Move…**
  to re-parent a version (see [Fixing a misclassification](#fixing-a-misclassification)).
  Below it, **suite pass rates** show how the agent scores per test suite, and the full
  model-parameter set sits in a collapsible panel that summarises temperature and max
  tokens when collapsed.

The performance stats and suite pass rates update live as new traces arrive.

## What you can do with agents

- **Review the current definition** — system prompt, tool specifications, and model
  endpoint.
- **Compare versions** to see what changed between deployments.
- **Run evaluations against a specific agent version** — see
  [Running Tests](/guide/running-tests).
- **Act on proposals** that target an agent — see
  [Optimization Proposals](/guide/optimization-proposals).

## System agents

Some agents are **system agents** (flagged `IsSystemAgent`). These are built-in agents
Proxytrace uses internally — for example, to generate agent names or to power optimizers.
They use the project's configured **system endpoint** rather than your application traffic.

## Related

- [Capturing Traces](/guide/capturing-traces) — where agent definitions come from.
- [Test Suites & Cases](/guide/test-suites-and-cases) — what you run against an agent.
