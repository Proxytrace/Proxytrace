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
