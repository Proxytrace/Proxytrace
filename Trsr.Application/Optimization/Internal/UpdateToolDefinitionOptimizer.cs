using System.Text.Json;
using JetBrains.Annotations;
using Microsoft.Extensions.Logging;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Prompt;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;
using Trsr.Domain.Tools;

namespace Trsr.Application.Optimization.Internal;

[UsedImplicitly]
internal sealed class UpdateToolDefinitionOptimizer : IOptimizerImplementation
{
    internal const string PromptName = "update_tool_definition_optimizer";

    private readonly IOptimizationProposal.CreateNew factory;
    private readonly IPromptTemplateRepository prompts;
    private readonly IAgentRepository agents;
    private readonly ILogger<UpdateToolDefinitionOptimizer> logger;

    public UpdateToolDefinitionOptimizer(
        IOptimizationProposal.CreateNew factory,
        IPromptTemplateRepository prompts,
        IAgentRepository agents,
        ILogger<UpdateToolDefinitionOptimizer> logger)
    {
        this.factory = factory;
        this.prompts = prompts;
        this.agents = agents;
        this.logger = logger;
    }

    public async Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default)
    {
        IAgent agent = testRunGroup.Suite.Agent;
        if (agent.Tools.Count == 0)
        {
            return [];
        }

        ITestRun? currentRun = testRuns.FirstOrDefault(r => r.Endpoint.Id == agent.Endpoint.Id);
        if (currentRun is null)
        {
            return [];
        }

        if (currentRun.Statistics.Failed == 0)
        {
            return [];
        }

        OptimizerEvidence evidence = OptimizerEvidenceBuilder.Build(currentRun);
        string userPayload = OptimizerEvidenceBuilder.RenderToJson(agent, evidence);

        string responseText;
        try
        {
            IPromptTemplate systemPrompt = await prompts.GetAsync(PromptName, cancellationToken);
            IAgent systemAgent = await agents.GetOrCreateAsync(
                systemPrompt: systemPrompt,
                tools: [],
                project: agent.Project,
                endpoint: agent.Project.SystemEndpoint,
                name: PromptName,
                isSystemAgent: true,
                cancellationToken: cancellationToken);

            var completion = await systemAgent.CompleteAsync(
                Message.CreateUserMessage(userPayload),
                cancellationToken: cancellationToken);
            responseText = completion.Response.GetTextResponse();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UpdateToolDefinitionOptimizer LLM call failed for agent {AgentId}", agent.Id);
            return [];
        }

        if (!TryBuildTools(responseText, agent.Tools, out IReadOnlyList<ToolSpecification> proposedTools, out string rationale))
        {
            return [];
        }

        var details = new ToolDetails(proposedTools);
        Priority priority = OptimizerPriority.FromFailRate(currentRun.Statistics);
        string fullRationale = $"{rationale} (Current run: {currentRun.Statistics.Failed}/{currentRun.Statistics.TestCases} failed.)";

        var proposal = factory(
            agent: agent,
            priority: priority,
            rationale: fullRationale,
            details: details,
            evidenceTestRunIds: [currentRun.Id]);

        return [proposal];
    }

    private bool TryBuildTools(
        string text,
        IReadOnlyList<ToolSpecification> currentTools,
        out IReadOnlyList<ToolSpecification> proposedTools,
        out string rationale)
    {
        proposedTools = [];
        rationale = string.Empty;

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(text);
        }
        catch (JsonException ex)
        {
            LogParseFailure(text, ex.Message);
            return false;
        }

        using (doc)
        {
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                LogParseFailure(text, "root is not an object");
                return false;
            }

            if (!root.TryGetProperty("tools", out JsonElement toolsEl) || toolsEl.ValueKind != JsonValueKind.Array)
            {
                LogParseFailure(text, "missing tools array");
                return false;
            }

            var expectedNames = currentTools.Select(t => t.Name).ToHashSet();
            var seenNames = new HashSet<string>();
            var built = new List<ToolSpecification>();

            foreach (JsonElement toolEl in toolsEl.EnumerateArray())
            {
                if (toolEl.ValueKind != JsonValueKind.Object)
                {
                    LogParseFailure(text, "tool entry is not an object");
                    return false;
                }

                if (!toolEl.TryGetProperty("name", out JsonElement nameEl)
                    || nameEl.ValueKind != JsonValueKind.String)
                {
                    LogParseFailure(text, "tool missing name");
                    return false;
                }

                string? name = nameEl.GetString();
                if (string.IsNullOrWhiteSpace(name) || !expectedNames.Contains(name))
                {
                    LogParseFailure(text, $"unknown tool name: {name}");
                    return false;
                }

                if (!seenNames.Add(name))
                {
                    LogParseFailure(text, $"duplicate tool name: {name}");
                    return false;
                }

                if (!toolEl.TryGetProperty("description", out JsonElement descEl)
                    || descEl.ValueKind != JsonValueKind.String)
                {
                    LogParseFailure(text, $"tool {name} missing description");
                    return false;
                }

                string? description = descEl.GetString();
                if (string.IsNullOrWhiteSpace(description))
                {
                    LogParseFailure(text, $"tool {name} description is empty");
                    return false;
                }

                ToolArguments arguments;
                if (toolEl.TryGetProperty("parameters", out JsonElement paramsEl)
                    && paramsEl.ValueKind == JsonValueKind.Object)
                {
                    try
                    {
                        arguments = ToolArguments.FromJsonSchema(paramsEl);
                    }
                    catch (Exception ex)
                    {
                        LogParseFailure(text, $"tool {name} parameters parse failed: {ex.Message}");
                        return false;
                    }
                }
                else
                {
                    arguments = ToolArguments.None;
                }

                built.Add(new ToolSpecification(name, description, arguments));
            }

            if (built.Count != currentTools.Count || seenNames.Count != expectedNames.Count)
            {
                LogParseFailure(text, $"tool count mismatch (got {built.Count}, expected {currentTools.Count})");
                return false;
            }

            proposedTools = built;
            rationale = root.TryGetProperty("rationale", out JsonElement rEl)
                && rEl.ValueKind == JsonValueKind.String
                ? rEl.GetString() ?? string.Empty
                : string.Empty;

            return true;
        }
    }

    private void LogParseFailure(string text, string reason)
    {
        var snippet = text.Length > 500 ? text[..500] : text;
        logger.LogWarning(
            "UpdateToolDefinitionOptimizer failed to parse LLM response ({Reason}): {Snippet}",
            reason,
            snippet);
    }
}
