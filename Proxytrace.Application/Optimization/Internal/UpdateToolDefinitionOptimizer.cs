using System.ComponentModel;
using JetBrains.Annotations;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.Optimization.Internal.Evidence;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.Tools;

namespace Proxytrace.Application.Optimization.Internal;

[UsedImplicitly]
internal sealed class UpdateToolDefinitionOptimizer : IOptimizerImplementation
{
    internal const string PromptName = "update_tool_definition_optimizer";

    private readonly IToolUpdateProposal.CreateNew factory;
    private readonly IPromptTemplateRepository prompts;
    private readonly IAgentRepository agents;
    private readonly IOptimizerEvidenceBuilder evidenceBuilder;
    private readonly Lazy<ITestRunnerService> testRunnerService;
    private readonly IAgent.CreateNew agentFactory;
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;

    public UpdateToolDefinitionOptimizer(
        IToolUpdateProposal.CreateNew factory,
        IPromptTemplateRepository prompts,
        IAgentRepository agents,
        IOptimizerEvidenceBuilder evidenceBuilder,
        Lazy<ITestRunnerService> testRunnerService,
        IAgent.CreateNew agentFactory,
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats,
        ILogger<UpdateToolDefinitionOptimizer> logger)
    {
        this.factory = factory;
        this.prompts = prompts;
        this.agents = agents;
        this.evidenceBuilder = evidenceBuilder;
        this.testRunnerService = testRunnerService;
        this.agentFactory = agentFactory;
        this.runStats = runStats;
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
        if (currentRun is null)
        {
            return [];
        }

        TestRunStats? stats = await runStats.FindAsync(currentRun.Id, cancellationToken);
        if (stats is null || stats.Failed == 0)
        {
            return [];
        }

        IPromptTemplate systemPrompt = await prompts.GetAsync(PromptName, cancellationToken);
        IAgent optimizer = await agents.GetOrCreateAsync(
            systemPrompt: systemPrompt,
            tools: [],
            project: agent.Project,
            endpoint: agent.Project.SystemEndpoint,
            name: PromptName,
            isSystemAgent: true,
            cancellationToken: cancellationToken);

        OptimizerEvidence evidence = evidenceBuilder.Build(currentRun);
        ToolOptimizerOutput? completion = await optimizer
            .CreateClient()
            .CompleteAsync<ToolOptimizerOutput>(
                Message.CreateUserMessage(evidence.ToJson()),
                cancellationToken: cancellationToken);

        if (completion is null)
        {
            return [];
        }

        if (completion.Tools.Count != agent.Tools.Count)
        {
            return [];
        }

        var existingNames = agent.Tools.Select(t => t.Name).ToHashSet();
        if (completion.Tools.Any(t => !existingNames.Contains(t.Name)))
        {
            return [];
        }

        IReadOnlyList<ToolSpecification> proposedTools;
        try
        {
            proposedTools = completion.Tools
                .Select(t => new ToolSpecification(
                    t.Name,
                    t.Description,
                    ToolArguments.FromJsonSchema(t.JsonSchema)))
                .ToList();
        }
        catch (Exception)
        {
            return [];
        }

        // create updated agent with the proposed tools
        var updatedAgent = agentFactory(
            name: agent.Name,
            systemPrompt: agent.SystemPrompt,
            tools: proposedTools,
            endpoint: agent.Endpoint,
            project: agent.Project,
            modelParameters: agent.ModelParameters,
            isSystemAgent: agent.IsSystemAgent);

        var abTestRunGroup = await testRunnerService.Value.RunInForegroundAsync(
            suite: testRunGroup.Suite,
            endpoints: [updatedAgent.Endpoint],
            customAgent: updatedAgent,
            isSystemTestRun: true,
            cancellationToken: cancellationToken);
        var abTestRuns = await abTestRunGroup.GetTestRuns(cancellationToken);
        if (abTestRuns.Count == 0)
        {
            return [];
        }

        ITestRun abRun = abTestRuns.First();
        TestRunStats? abStats = await runStats.FindAsync(abRun.Id, cancellationToken);

        Priority priority = stats.GetOptimizationPriority();
        string fullRationale =
            $"{completion.Rationale} (Current run: {stats.Failed}/{stats.TestCases} failed.)";

        var proposal = factory(
            agent: agent,
            priority: priority,
            rationale: fullRationale,
            proposedTools: proposedTools,
            currentPassRate: stats.PassRate,
            proposedPassRate: abStats?.PassRate,
            evidenceTestRunIds: [currentRun.Id],
            abTestRun: abRun);

        return [proposal];
    }

    [UsedImplicitly]
    private record ToolOptimizerOutput
    {
        [Description("the tool definitions that should be changed")]
        public required IReadOnlyList<ProposedTool> Tools { get; [UsedImplicitly] init; }

        [Description("1-3 sentences explaining what changed and why")]
        public required string Rationale { get; [UsedImplicitly] init; }
    }

    [UsedImplicitly]
    private record ProposedTool
    {
        [Description("the tool name; must match an existing tool name on the agent")]
        public required string Name { get; [UsedImplicitly] init; }

        [Description("the proposed tool description")]
        public required string Description { get; [UsedImplicitly] init; }

        [Description("the proposed JSON schema for the tool's arguments, as a JSON-encoded string (a JSON object with 'type', 'properties', and 'required' fields)")]
        public required string JsonSchema { get; [UsedImplicitly] init; }
    }
}
