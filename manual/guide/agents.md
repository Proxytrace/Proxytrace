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
