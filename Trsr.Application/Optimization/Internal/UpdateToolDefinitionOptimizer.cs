using System.ComponentModel;
using JetBrains.Annotations;
using Microsoft.Extensions.Logging;
using Trsr.Application.Optimization.Internal.Evidence;
using Trsr.Application.Statistics;
using Trsr.Application.Statistics.TestRun;
using Trsr.Application.TestRun;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
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
        // TODO: Re-enable UpdateToolDefinitionOptimizerTests.DiscoverOptimizations_HappyPath_ProducesToolProposal
        //       once this has been implemented.
        return [];
//         var agent = testRunGroup.Suite.Agent;
//         if (agent.Tools.Count == 0)
//         {
//             return [];
//         }
//
//         var currentRun = testRuns.FirstOrDefault(r => r.Endpoint.Id == agent.Endpoint.Id);
//         if (currentRun is null)
//         {
//             return [];
//         }
//
//         TestRunStats? stats = await runStats.FindAsync(currentRun.Id, cancellationToken);
//         if (stats is null || stats.Failed == 0)
//         {
//             return [];
//         }
//
//         IPromptTemplate systemPrompt = await prompts.GetAsync(PromptName, cancellationToken);
//         IAgent systemAgent = await agents.GetOrCreateAsync(
//             systemPrompt: systemPrompt,
//             tools: [],
//             project: agent.Project,
//             endpoint: agent.Project.SystemEndpoint,
//             name: PromptName,
//             isSystemAgent: true,
//             cancellationToken: cancellationToken);
//
//         OptimizerEvidence evidence = evidenceBuilder.Build(currentRun);
//         ToolOptimizerOutput? completion = await systemAgent
//             .CreateClient()
//             .CompleteAsync<ToolOptimizerOutput>(
//                 Message.CreateUserMessage(evidence.ToJson()),
//                 cancellationToken: cancellationToken);
//
//         if (completion == null)
//         {
//             return [];
//         }
//
//         if (completion.Tools.Count != agent.Tools.Count)
//         {
//             return [];
//         }
//
//         var existingNames = agent.Tools.Select(t => t.Name).ToHashSet();
//         if (completion.Tools.Any(t => !existingNames.Contains(t.Name)))
//         {
//             return [];
//         }
//
//         // create updated agent with the proposed tools
//         var updatedAgent = agentFactory(
//             name: agent.Name,
//             systemPrompt: agent.SystemPrompt,
//             tools: completion.Tools,
//             endpoint: agent.Endpoint,
//             project: agent.Project,
//             modelParameters: agent.ModelParameters,
//             isSystemAgent: agent.IsSystemAgent);
//
//         var abTestRunGroup = await testRunnerService.Value.RunInForegroundAsync(
//             suite: testRunGroup.Suite,
//             endpoints: [updatedAgent.Endpoint],
//             customAgent: updatedAgent,
//             cancellationToken: cancellationToken);
//         var abTestRuns = await abTestRunGroup.GetTestRuns(cancellationToken);
//         if (abTestRuns.Count == 0)
//         {
//             return [];
//         }
//
//         Priority priority = stats.GetOptimizationPriority();
//         string fullRationale =
//             $"""
//              {completion.Rationale}
//              (Current run: {stats.Failed}/{stats.TestCases} failed.)";
//              """;
//
//         var proposal = factory(
//             agent: agent,
//             priority: priority,
//             rationale: fullRationale,
//             proposedTools: completion.Tools,
//             evidenceTestRunIds: [currentRun.Id],
//             abTestRun: abTestRuns.First());
//
//         return [proposal];
    }

    [UsedImplicitly]
    private record ToolOptimizerOutput
    {
        [Description("the tool definitions that should be changed")]
        public required IReadOnlyList<ToolSpecification> Tools { get; [UsedImplicitly] init; }

        [Description("string (1-3 sentences explaining what changed and why)")]
        public required string Rationale { get; [UsedImplicitly] init; }
    }
}
