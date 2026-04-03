using Trsr.Common.Random;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;

namespace Trsr.Domain.OptimizationProposal.Internal;

internal class OptimizationProposalGenerator : DomainEntityGenerator<IOptimizationProposal>
{
    private readonly IOptimizationProposal.CreateNew factory;
    private readonly IDomainEntityGenerator<IAgent> agentGenerator;

    public OptimizationProposalGenerator(
        IOptimizationProposal.CreateNew factory,
        IRepository<IOptimizationProposal> repository,
        IDomainEntityGenerator<IAgent> agentGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.agentGenerator = agentGenerator;
    }

    public override async Task<IOptimizationProposal> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var agent = await agentGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            agent: agent,
            kind: ProposalKind.SystemPrompt,
            rationale: random.String(),
            proposedSystemMessage: new SystemMessage(random.String()),
            proposedTools: [],
            evidenceTestRunIds: []);
    }
}
