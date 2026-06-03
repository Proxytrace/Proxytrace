import type { TraceySkill } from './types';

/**
 * The optimization-theory playbook. Loaded on demand when the user asks Tracey to optimize or
 * improve an agent. It walks Tracey through grounding a hypothesis in real evidence and
 * submitting it as an {@link TraceySkill} theory that the backend A/B-validates.
 */
export const optimizationSkill: TraceySkill = {
  id: 'optimize-agent',
  name: 'Optimize an agent',
  description:
    'Theorize a concrete improvement to an agent and A/B-test it. Use when the user asks to ' +
    'optimize, improve, or tune an agent.',
  instructions: `# Skill: Optimize an agent

You theorize ONE concrete, evidence-backed change to an agent, then submit it as an
**optimization theory**. The backend runs a baseline-vs-candidate A/B test in the background and
either promotes the theory to a reviewable proposal (it improved the pass rate) or rejects it.
You do not run the A/B test yourself — \`submit_optimization_theory\` kicks it off and the card
that tool renders shows the live result.

## Preconditions (check before theorizing)

1. **The agent exists.** Resolve it with \`get_agent\` (or \`list_agents\` if the user named it
   loosely). If it doesn't exist, say so and stop.
2. **The agent has a test suite.** Call \`list_suites\` and find the one whose \`agentId\` matches
   the target agent. A theory is validated against a suite, so this is required.
   - If there is **no** suite for the agent, explain that optimization needs a test suite to
     measure against, point them to create one, and stop. Do not submit a theory without a suite.
   - If there are several, ask the user which suite to validate against with \`ask_questions\`.

## Ground the theory in evidence

Don't guess. Look at how the agent is actually doing before proposing a change:

- \`get_agent_stats\` — token usage, cost, latency trends (last 30 days).
- \`list_runs\` / \`get_run\` — recent test runs against the suite; find failing cases.
- \`get_trace\` — inspect a specific failing call when you need the prompt/response detail.

Use what you find to choose ONE kind of change and to write a specific, honest rationale.

## Pick exactly one change kind

| Kind | When | What you author |
|------|------|-----------------|
| **System prompt** | Failures look like missing instructions, wrong tone/format, ignored constraints. | A full rewritten system message that keeps what works and fixes the observed gap. |
| **Model switch** | Quality ceiling, or cost/latency is the problem and a different model would help. | The id of another \`ModelEndpoint\` in the project (find it via \`get_agent\` / \`get_provider\`). |
| **Tool update** | The agent's tool definitions are wrong/missing/poorly described. | The full proposed tool list (name, description, JSON-schema parameters). |

Prefer the smallest change that addresses the evidence. One theory = one change.

## Submit the theory

Call \`submit_optimization_theory\` with:
- \`agentId\`, \`suiteId\` (from the steps above),
- \`priority\` (Low/Medium/High/Critical — judge by how strong the evidence is),
- a one-sentence \`rationale\` grounded in what you saw,
- \`details\` for the chosen kind:
  - System prompt → \`{ kind: 'SystemPrompt', currentSystemMessage, proposedSystemMessage }\`
  - Model switch → \`{ kind: 'ModelSwitchSeed', proposedEndpointId }\`
  - Tool update → \`{ kind: 'ToolUpdateSeed', proposedTools: [{ name, description, parametersJson }] }\`

The tool is confirm-gated (the app asks the user to approve the A/B run). After it returns, the
theory card it renders streams the status: **Validating** while the A/B test runs, then either a
link to the new **proposal** (it won) or **rejected** (no improvement). Add at most one sentence
of context — the card shows the rest. If the submission comes back as a duplicate or quota error,
explain it plainly instead of retrying.

## Guardrails

- Submit ONE theory per request unless the user explicitly asks for several.
- Never invent ids, model names, or numbers — read them with the tools first.
- If you can't find evidence or a suite, say so; don't submit a baseless theory.`,
};
