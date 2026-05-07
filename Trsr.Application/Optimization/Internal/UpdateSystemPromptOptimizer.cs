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

namespace Trsr.Application.Optimization.Internal;

[UsedImplicitly]
internal sealed class UpdateSystemPromptOptimizer : IOptimizerImplementation
{
    internal const string PromptName = "update_system_prompt_optimizer";

    private readonly IOptimizationProposal.CreateNew factory;
    private readonly IPromptTemplateRepository prompts;
    private readonly IAgentRepository agents;
    private readonly ILogger<UpdateSystemPromptOptimizer> logger;

    public UpdateSystemPromptOptimizer(
        IOptimizationProposal.CreateNew factory,
        IPromptTemplateRepository prompts,
        IAgentRepository agents,
        ILogger<UpdateSystemPromptOptimizer> logger)
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
            logger.LogWarning(ex, "UpdateSystemPromptOptimizer LLM call failed for agent {AgentId}", agent.Id);
            return [];
        }

        if (!TryParseResponse(responseText, out string proposedPrompt, out string rationale))
        {
            return [];
        }

        var details = new SystemPromptDetails(new SystemMessage(proposedPrompt));
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

    private bool TryParseResponse(string text, out string proposedPrompt, out string rationale)
    {
        proposedPrompt = string.Empty;
        rationale = string.Empty;

        try
        {
            using JsonDocument doc = JsonDocument.Parse(text);
            JsonElement root = doc.RootElement;

            if (root.ValueKind != JsonValueKind.Object)
            {
                LogParseFailure(text, "root is not an object");
                return false;
            }

            if (!root.TryGetProperty("proposed_system_prompt", out JsonElement promptEl)
                || promptEl.ValueKind != JsonValueKind.String)
            {
                LogParseFailure(text, "missing proposed_system_prompt");
                return false;
            }

            string? prompt = promptEl.GetString();
            if (string.IsNullOrWhiteSpace(prompt))
            {
                LogParseFailure(text, "proposed_system_prompt is empty");
                return false;
            }

            proposedPrompt = prompt;
            rationale = root.TryGetProperty("rationale", out JsonElement rEl)
                && rEl.ValueKind == JsonValueKind.String
                ? rEl.GetString() ?? string.Empty
                : string.Empty;

            return true;
        }
        catch (JsonException ex)
        {
            LogParseFailure(text, ex.Message);
            return false;
        }
    }

    private void LogParseFailure(string text, string reason)
    {
        var snippet = text.Length > 500 ? text[..500] : text;
        logger.LogWarning(
            "UpdateSystemPromptOptimizer failed to parse LLM response ({Reason}): {Snippet}",
            reason,
            snippet);
    }
}
