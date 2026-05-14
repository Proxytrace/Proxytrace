using Trsr.Common.Random;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Proposal;

namespace Trsr.Domain.OptimizationProposal.Internal;

internal class ModelSwitchProposalGenerator : OptimizationProposalGeneratorBase<IModelSwitchProposal>
{
    private readonly IModelSwitchProposal.CreateNew factory;
    private readonly IDomainEntityGenerator<IAgent> agentGenerator;
    private readonly IDomainEntityGenerator<IModelEndpoint> endpointGenerator;
    private readonly IRandom random;

    public ModelSwitchProposalGenerator(
        IModelSwitchProposal.CreateNew factory,
        IDomainEntityGenerator<IAgent> agentGenerator,
        IDomainEntityGenerator<IModelEndpoint> endpointGenerator,
        IRepository<IOptimizationProposal> repository,
        IRandom random) : base(repository)
    {
        this.factory = factory;
        this.agentGenerator = agentGenerator;
        this.endpointGenerator = endpointGenerator;
        this.random = random;
    }

    public override async Task<IModelSwitchProposal> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var agent = await agentGenerator.GetOrCreateAsync(cancellationToken);
        var endpoint = await endpointGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            agent: agent,
            priority: Priority.Medium,
            rationale: random.String(),
            proposedEndpoint: endpoint,
            expectedPassRateDelta: 0.1,
            expectedCostDelta: null,
            expectedLatencyDelta: null,
            evidenceTestRunIds: []);
    }
}
