using System.ComponentModel;
using JetBrains.Annotations;
using Proxytrace.Application.Optimization.Internal.Evidence;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

[UsedImplicitly]
internal sealed class UpdateSystemPromptOptimizer : IOptimizerImplementation
{
    internal const string PromptName = "update_system_prompt_optimizer";

    private readonly ISystemPromptTheory.CreateNew factory;
    private readonly IPromptTemplateRepository prompts;
    private readonly IAgentRepository agents;
    private readonly IOptimizerEvidenceBuilder evidenceBuilder;
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;

    public UpdateSystemPromptOptimizer(
        ISystemPromptTheory.CreateNew factory,
        IPromptTemplateRepository prompts,
        IAgentRepository agents,
        IOptimizerEvidenceBuilder evidenceBuilder,
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats)
    {
        this.factory = factory;
        this.prompts = prompts;
        this.agents = agents;
        this.evidenceBuilder = evidenceBuilder;
        this.runStats = runStats;
    }

    public async Task<IReadOnlyList<IOptimizationTheory>> DiscoverTheories(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default)
    {
        var agent = testRunGroup.Suite.Agent;
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
        IAgent systemAgent = await agents.GetOrCreateAsync(
            systemPrompt: systemPrompt,
            tools: [],
            project: agent.Project,
            endpoint: agent.Project.SystemEndpoint,
            name: PromptName,
            isSystemAgent: true,
            cancellationToken: cancellationToken);

        OptimizerEvidence evidence = evidenceBuilder.Build(currentRun);

        SystemPromptOptimizerOutput? output = await systemAgent
            .CreateClient()
            .CompleteAsync<SystemPromptOptimizerOutput>(
                Message.CreateUserMessage(evidence.ToJson()),
                cancellationToken: cancellationToken);

        if (output is null || string.IsNullOrWhiteSpace(output.ProposedSystemPrompt))
        {
            return [];
        }

        Priority priority = stats.GetOptimizationPriority();
        string fullRationale =
            $"{output.Rationale} (Current run: {stats.Failed}/{stats.TestCases} failed.)";

        var theory = factory(
            agent: agent,
            suite: testRunGroup.Suite,
            source: TheorySource.Optimizer,
            priority: priority,
            rationale: fullRationale,
            proposedSystemMessage: output.ProposedSystemPrompt,
            evidenceTestRunIds: [currentRun.Id]);

        return [theory];
    }

    [UsedImplicitly]
    private record SystemPromptOptimizerOutput
    {
        [Description("the full new system prompt")]
        public required string ProposedSystemPrompt { get; [UsedImplicitly] init; }

        [Description("1-3 sentences explaining what changed and why, citing patterns observed in the failing cases")]
        public required string Rationale { get; [UsedImplicitly] set; }
    }
}
