using System.ComponentModel;
using JetBrains.Annotations;
using Microsoft.Extensions.Logging;
using Trsr.Application.Optimization.Internal.Evidence;
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
    private readonly IOptimizerEvidenceBuilder evidenceBuilder;

    public UpdateToolDefinitionOptimizer(
        IOptimizationProposal.CreateNew factory,
        IPromptTemplateRepository prompts,
        IAgentRepository agents,
        IOptimizerEvidenceBuilder evidenceBuilder,
        ILogger<UpdateToolDefinitionOptimizer> logger)
    {
        this.factory = factory;
        this.prompts = prompts;
        this.agents = agents;
        this.evidenceBuilder = evidenceBuilder;
    }

    public async Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default)
    {
        var agent = testRunGroup.Suite.Agent;
        if (agent.Tools.Count == 0)
        {
            return [];
        }

        var currentRun = testRuns.FirstOrDefault(r => r.Endpoint.Id == agent.Endpoint.Id);
        if (currentRun is null || currentRun.Statistics.Failed == 0)
        {
            return [];
        }

        IPromptTemplate systemPrompt = await prompts.GetAsync(PromptName, cancellationToken);
        IAgent systemAgent = await agents.GetOrCreateAsync(
            systemPrompt: systemPrompt,
            tools: [],
            project: agent.Project,
            endpoint: agent.Project.SystemEndpoint,
            name: PromptName,
            isSystemAgent: true,
            cancellationToken: cancellationToken);

        OptimizerEvidence evidence = evidenceBuilder.Build(currentRun);
        ToolOptimizerOutput? completion = await systemAgent.CompleteAsync<ToolOptimizerOutput>(
            Message.CreateUserMessage(evidence.ToJson()),
            cancellationToken: cancellationToken);

        if (completion == null)
        {
            return [];
        }

        Priority priority = currentRun.Statistics.GetOptimizationPriority();
        string fullRationale =
            $"""
             {completion.Rationale}
             (Current run: {currentRun.Statistics.Failed}/{currentRun.Statistics.TestCases} failed.)";
             """;

        var proposal = factory(
            agent: agent,
            priority: priority,
            rationale: fullRationale,
            details: new ToolDetails(completion.Tools),
            evidenceTestRunIds: [currentRun.Id]);

        return [proposal];
    }

    [UsedImplicitly]
    private record ToolOptimizerOutput
    {
        [Description("the tool definitions that should be changed")]
        public required IReadOnlyList<ToolSpecification> Tools { get; init; }

        [Description("string (1-3 sentences explaining what changed and why)")]
        public required string Rationale { get; init; }
    }
}