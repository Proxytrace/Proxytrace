# Update System Prompt + Update Tool Definition Optimizers

**Date:** 2026-05-07
**Branch:** `feature/optimizations`
**Issue:** TBD (issue-based flow per CLAUDE.md — link before merge)

## Goal

Add two new `IOptimizerImplementation`s that generate `IOptimizationProposal`s for an `IAgent` from `ITestRun` evidence:

1. **`UpdateSystemPromptOptimizer`** — proposes a rewritten system prompt.
2. **`UpdateToolDefinitionOptimizer`** — proposes refined `ToolSpecification`s (description + arguments only; same names, same count).

Both are LLM-driven: they call a system agent on `IProject.SystemEndpoint`, feeding it failing test evidence and asking for a structured JSON proposal. They return `[]` when there is nothing to propose.

## Context (existing state)

- `IOptimizerImplementation` (`Trsr.Application/Optimization/Internal/IOptimizerImplementation.cs`): contract — `Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(ITestRunGroup, IReadOnlyList<ITestRun>, CancellationToken)`.
- `CompositeOptimizer` aggregates all registered implementations and persists the proposals.
- `SwitchModelOptimizer` is registered and complete.
- `RebuildPromptOptimizer` is a stub (throws `NotImplementedException`, not registered) — will be **renamed** to `UpdateSystemPromptOptimizer` and filled in.
- `ProposalDetails` already has the records we need:
  - `SystemPromptDetails(SystemMessage ProposedSystemMessage)`
  - `ToolDetails(IReadOnlyCollection<ToolSpecification> ProposedTools)`
- LLM-call pattern is established in `Trsr.Application/Agent/AgentNameGenerator.cs`: get-or-create a system agent (`isSystemAgent: true`) on `project.SystemEndpoint`, prompt template loaded by name from `Trsr.Application/Prompts.resx`, call `agent.CompleteAsync(UserMessage)`.
- `ToolArguments.FromJsonSchema(JsonElement)` is public and is the same path `OpenAiCallParser` uses to construct `ToolSpecification` from external JSON schema input.

## Out of scope

- New `ProposalKind`s — both kinds (`SystemPrompt`, `Tool`) already exist.
- New `ProposalDetails` records.
- Auto-application of proposals (proposals remain human-reviewed per `IOptimizationProposal` doc comment).
- Rebuilding/regenerating the prompt from scratch (kept as future work — different concern from "update").
- Adding/removing tools — Tool optimizer keeps name set fixed.
- Optimizing the system endpoint or its agent's own behaviour.

## Architecture

### New files

| File | Purpose |
|---|---|
| `Trsr.Application/Optimization/Internal/UpdateSystemPromptOptimizer.cs` | Replaces `RebuildPromptOptimizer.cs` (rename file/class). Implements `IOptimizerImplementation`. |
| `Trsr.Application/Optimization/Internal/UpdateToolDefinitionOptimizer.cs` | New. Implements `IOptimizerImplementation`. |
| `Trsr.Application/Optimization/Internal/OptimizerEvidenceBuilder.cs` | Shared utility. Picks failing + a small sample of passing `ITestResult`s, renders them to text the LLM can reason over. |
| `Trsr.Application.Tests/UpdateSystemPromptOptimizerTests.cs` | Unit tests. |
| `Trsr.Application.Tests/UpdateToolDefinitionOptimizerTests.cs` | Unit tests. |

### Modified files

| File | Change |
|---|---|
| `Trsr.Application/Optimization/Module.cs` | Register `UpdateSystemPromptOptimizer` and `UpdateToolDefinitionOptimizer` as `IOptimizerImplementation`. |
| `Trsr.Application/Prompts.resx` (+ generated `Prompts.Designer.cs`) | Add two prompt resources: `update_system_prompt_optimizer`, `update_tool_definition_optimizer`. |

### Removed files

- `Trsr.Application/Optimization/Internal/RebuildPromptOptimizer.cs` — replaced by `UpdateSystemPromptOptimizer.cs`.

## Common flow (both optimizers)

```
DiscoverOptimizations(testRunGroup, testRuns, ct):
  agent = testRunGroup.Suite.Agent
  currentRun = testRuns.FirstOrDefault(r => r.Endpoint.Id == agent.Endpoint.Id)
  if currentRun is null: return []
  if currentRun.Statistics.Failed == 0: return []                     # 100% pass — nothing to fix
  if (Tool optimizer only) agent.Tools.Count == 0: return []

  evidence = OptimizerEvidenceBuilder.Build(currentRun)                # failing + 3 passing
  systemAgent = await agentRepository.GetOrCreateAsync(
      name: PromptName,
      systemPrompt: await prompts.GetAsync(PromptName, ct),
      project: agent.Project,
      endpoint: agent.Project.SystemEndpoint,
      tools: [],
      isSystemAgent: true,
      cancellationToken: ct)

  userPayload = renderPayload(agent, evidence)                         # JSON, see below
  completion = await systemAgent.CompleteAsync(
      Message.CreateUserMessage(userPayload), cancellationToken: ct)
  text = completion.Response.GetTextResponse()

  parsed = tryParseJson(text)
  if parsed is null: log warning; return []

  details = buildDetails(parsed, agent)                                # may return null on validation fail
  if details is null: return []

  priority = priorityFor(currentRun.Statistics)
  rationale = parsed.rationale + " " + summary(currentRun.Statistics)

  return [factory(agent, priority, rationale, details, [currentRun.Id])]
```

## Evidence sampling

`OptimizerEvidenceBuilder` (static or single-instance helper):

```csharp
internal sealed record OptimizerEvidence(
    IReadOnlyList<ITestResult> Failing,
    IReadOnlyList<ITestResult> PassingSample);

internal static class OptimizerEvidenceBuilder
{
    public const int MaxFailing = 20;
    public const int PassingSampleSize = 3;

    public static OptimizerEvidence Build(ITestRun run);
    public static string RenderToJson(IAgent agent, OptimizerEvidence evidence);
}
```

- `Failing`: all `r.Passed == false`, ordered by `OverallScore` ascending (lowest scoring first), capped at `MaxFailing`.
- `PassingSample`: up to `PassingSampleSize` results where `r.Passed == true`, deterministic order (e.g. by `Id` to keep tests stable).
- `RenderToJson(...)` produces a single JSON document the LLM consumes:

```json
{
  "agent": {
    "name": "...",
    "system_prompt": "...",                  // current prompt template text (raw)
    "tools": [ { "name": "...", "description": "...", "parameters": {/* schema */} } ]
  },
  "failing": [
    {
      "input": [ /* serialized Conversation */ ],
      "expected": { /* AssistantMessage */ },
      "actual":   { /* AssistantMessage */ },
      "evaluations": [ { "evaluator": "...", "score": 0.0, "passed": false, "reasoning": "..." } ]
    }
  ],
  "passing": [ /* same shape, smaller sample */ ]
}
```

Use `System.Text.Json` with default options. Serialization of `Conversation`/`AssistantMessage`/`ToolSpecification` already works elsewhere in the codebase (the API DTO layer and the OpenAI proxy round-trip them).

## LLM I/O contracts

### `UpdateSystemPromptOptimizer`

Resx key: `update_system_prompt_optimizer`.

System prompt (resx content) instructs the LLM to:
- Read `agent.system_prompt`, `failing[]`, `passing[]`.
- Produce a single revised system prompt that fixes the failing patterns without breaking the passing ones.
- Reply with **only** JSON, no commentary.

Expected response shape:

```json
{
  "proposed_system_prompt": "string (non-empty)",
  "rationale": "string (1–3 sentences explaining the change)"
}
```

Mapping:

```csharp
var details = new SystemPromptDetails(new SystemMessage(parsed.proposed_system_prompt));
```

### `UpdateToolDefinitionOptimizer`

Resx key: `update_tool_definition_optimizer`.

System prompt instructs the LLM to:
- Keep `tools[]` length and `name` set identical to input.
- Refine `description` and `parameters` (JSON Schema object) so failing test calls would succeed.
- Reply with **only** JSON.

Expected response shape:

```json
{
  "tools": [
    {
      "name": "<must match an input tool name exactly>",
      "description": "string (non-empty)",
      "parameters": { /* full JSON Schema object */ }
    }
  ],
  "rationale": "string"
}
```

Validation (drop proposal — return `[]` — on any failure):
- `tools.Length == agent.Tools.Count`.
- Name set equals input name set (no new names, no duplicates, no missing).
- Each `description` non-empty.
- Each `parameters` is a JSON Schema object parseable by `ToolArguments.FromJsonSchema`.

Mapping:

```csharp
var newTools = parsed.tools
    .Select(t => new ToolSpecification(
        t.name,
        t.description,
        ToolArguments.FromJsonSchema(t.parametersElement)))
    .ToList();
var details = new ToolDetails(newTools);
```

## Priority heuristic

Same shape as `SwitchModelOptimizer`. Driver is the **current run's fail rate**:

```csharp
double failRate = currentRun.Statistics.TestCases > 0
    ? currentRun.Statistics.Failed / (double)currentRun.Statistics.TestCases
    : 0.0;
var priority = failRate switch
{
    >= 0.50 => Priority.Critical,
    >= 0.25 => Priority.High,
    >= 0.10 => Priority.Medium,
    _       => Priority.Low,
};
```

## Dependencies (constructor injection)

Both optimizers take:

```csharp
IOptimizationProposal.CreateNew factory
IPromptTemplateRepository prompts
IAgentRepository agents
ILogger<TOptimizer> logger
```

Registered in `Trsr.Application/Optimization/Module.cs`:

```csharp
builder.RegisterType<UpdateSystemPromptOptimizer>().As<IOptimizerImplementation>();
builder.RegisterType<UpdateToolDefinitionOptimizer>().As<IOptimizerImplementation>();
```

`SwitchModelOptimizer` registration unchanged. `CompositeOptimizer` already takes `IReadOnlyCollection<IOptimizerImplementation>` so it picks them up automatically.

## Error handling

- Missing prompt template: `IPromptTemplateRepository.GetAsync` throws `PromptNotFoundException` → log error, return `[]` (do not crash the optimizer pipeline; `CompositeOptimizer` runs all optimizers in parallel via `.Await()`).
- LLM call exception (network, rate limit): catch in optimizer, log warning, return `[]`. The `OptimizerService.ExecuteAsync` already swallows per-job exceptions, but per-optimizer failures must not poison sibling optimizers' results.
- JSON parse failure: log warning with first 500 chars of response, return `[]`.
- Tool name mismatch: log warning, return `[]`.

## Testing

In `Trsr.Application.Tests/`, both new test classes extend `BaseTest<Module>` and override `ConfigureContainer` to:
- Replace `IAgentRepository` with a fake whose `GetOrCreateAsync` returns a pre-stubbed `IAgent` whose `CompleteAsync` returns canned `ICompletion` JSON.
- Replace `IPromptTemplateRepository` with a fake returning a no-op template (the prompt content does not matter for these tests; only the path through the optimizer does).

`UpdateSystemPromptOptimizerTests`:
- Skips when no run for current endpoint.
- Skips when current run has zero failures.
- Happy path: produces exactly one proposal; `Details is SystemPromptDetails`; rationale non-empty; evidenceTestRunIds == `[currentRun.Id]`.
- Priority bucket transitions: stub statistics for failRate ∈ {0.05, 0.15, 0.30, 0.60} and assert Low/Medium/High/Critical.
- Malformed JSON from LLM → returns `[]`.

`UpdateToolDefinitionOptimizerTests`:
- All of the above (skip-no-run, skip-100%-pass, priority buckets, malformed JSON).
- Skips when `agent.Tools` is empty.
- Happy path: produces proposal with `ToolDetails`; tool count matches input; name set matches input; argument schema parses.
- Drops proposal when LLM returns wrong tool count.
- Drops proposal when LLM renames a tool.
- Drops proposal when a `parameters` block is malformed JSON Schema.

Per CLAUDE.md, write failing tests first before implementation.

## Acceptance criteria

- `dotnet build Trsr.sln` succeeds.
- `dotnet test Trsr.sln` succeeds.
- `Trsr.Application.Optimization.Module` registers both optimizers.
- Running `OptimizerService` against a `TestRunGroup` with at least one failing test against the agent's current endpoint produces, in addition to any `ModelSwitchDetails` proposal:
  - One `IOptimizationProposal` with `Kind == ProposalKind.SystemPrompt`.
  - One `IOptimizationProposal` with `Kind == ProposalKind.Tool` (only if the agent has tools).
- Both proposals have `Status == Pending`, non-empty `Rationale`, and `EvidenceTestRunIds` containing the current run's id.
- No proposal is produced when the current-endpoint run is 100% pass.
- No `Tool` proposal is produced when `agent.Tools.Count == 0`.

## Open follow-ups (not in this spec)

- Prompt-engineering iteration on the two resx prompts after we see real outputs.
- Add a `RebuildSystemPromptOptimizer` later (different from "update": full regeneration from test cases without using the existing prompt as anchor).
- Tool-add/remove optimizer.
- Streaming/structured-output mode (when the system endpoint supports JSON mode natively) instead of relying on the LLM to obey "JSON only".
