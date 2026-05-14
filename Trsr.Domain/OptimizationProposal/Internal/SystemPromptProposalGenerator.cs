using Trsr.Common.Random;
using Trsr.Domain.Agent;
using Trsr.Domain.Proposal;

namespace Trsr.Domain.OptimizationProposal.Internal;

internal class SystemPromptProposalGenerator : OptimizationProposalGeneratorBase<ISystemPromptProposal>
{
    private readonly ISystemPromptProposal.CreateNew factory;
    private readonly IDomainEntityGenerator<IAgent> agentGenerator;
    private readonly IRandom random;

    public SystemPromptProposalGenerator(
        ISystemPromptProposal.CreateNew factory,
        IDomainEntityGenerator<IAgent> agentGenerator,
        IRepository<IOptimizationProposal> repository,
        IRandom random) : base(repository)
    {
        this.factory = factory;
        this.agentGenerator = agentGenerator;
        this.random = random;
    }

    public override async Task<ISystemPromptProposal> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var agent = await agentGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            agent: agent,
            priority: Priority.Medium,
            rationale: random.String(),
            proposedSystemMessage: random.String(),
            evidenceTestRunIds: []);
    }
}
