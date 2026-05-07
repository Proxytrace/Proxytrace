using System.ComponentModel;
using JetBrains.Annotations;
using Trsr.Application.Optimization.Internal.Evidence;
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
    private readonly IOptimizerEvidenceBuilder evidenceBuilder;

    public UpdateSystemPromptOptimizer(
        IOptimizationProposal.CreateNew factory,
        IPromptTemplateRepository prompts,
        IAgentRepository agents,
        IOptimizerEvidenceBuilder evidenceBuilder)
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

        SystemPromptOptimizerOutput? output = await systemAgent.CompleteAsync<SystemPromptOptimizerOutput>(
            Message.CreateUserMessage(evidence.ToJson()),
            cancellationToken: cancellationToken);

        if (output is null)
        {
            return [];
        }

        var details = new SystemPromptDetails(output.ProposedSystemPrompt);
        Priority priority = currentRun.Statistics.GetOptimizationPriority();
        string fullRationale =
            $"{output.Rationale} (Current run: {currentRun.Statistics.Failed}/{currentRun.Statistics.TestCases} failed.)";

        var proposal = factory(
            agent: agent,
            priority: priority,
            rationale: fullRationale,
            details: details,
            evidenceTestRunIds:
            [
                currentRun.Id
            ]);

        return [proposal];
    }

    [UsedImplicitly]
    private record SystemPromptOptimizerOutput
    {
        [Description("the full new system prompt")]
        public required string ProposedSystemPrompt { get; init; }

        [Description("1-3 sentences explaining what changed and why, citing patterns observed in the failing cases")]
        public required string Rationale { get; set; }
    }
}