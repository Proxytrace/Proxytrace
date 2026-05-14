using Trsr.Common.Random;
using Trsr.Domain.Agent;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;

namespace Trsr.Domain.OptimizationProposal.Internal;

internal class ToolUpdateProposalGenerator : OptimizationProposalGeneratorBase<IToolUpdateProposal>
{
    private readonly IToolUpdateProposal.CreateNew factory;
    private readonly IDomainEntityGenerator<IAgent> agentGenerator;
    private readonly IDomainEntityGenerator<ITestRun> testRunGenerator;
    private readonly IRandom random;

    public ToolUpdateProposalGenerator(
        IToolUpdateProposal.CreateNew factory,
        IDomainEntityGenerator<IAgent> agentGenerator,
        IDomainEntityGenerator<ITestRun> testRunGenerator,
        IRepository<IOptimizationProposal> repository,
        IRandom random) : base(repository)
    {
        this.factory = factory;
        this.agentGenerator = agentGenerator;
        this.testRunGenerator = testRunGenerator;
        this.random = random;
    }

    public override async Task<IToolUpdateProposal> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var agent = await agentGenerator.GetOrCreateAsync(cancellationToken);
        var abTestRun = await testRunGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            agent: agent,
            priority: Priority.Medium,
            rationale: random.String(),
            proposedTools: [],
            evidenceTestRunIds: [],
            abTestRun: abTestRun);
    }
}
