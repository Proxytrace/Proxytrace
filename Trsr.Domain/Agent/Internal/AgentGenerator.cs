using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;

namespace Trsr.Domain.Agent.Internal;

internal class AgentGenerator : DomainEntityGenerator<IAgent>
{
    private readonly IAgent.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;
    private readonly IDomainEntityGenerator<IModelEndpoint> endpointGenerator;

    public AgentGenerator(
        IAgent.CreateNew factory,
        IRepository<IAgent> repository,
        IDomainEntityGenerator<IProject> projectGenerator,
        IDomainEntityGenerator<IModelEndpoint> endpointGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
        this.endpointGenerator = endpointGenerator;
    }

    public override async Task<IAgent> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        var endpoint = await endpointGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            name: random.String(),
            systemMessage: new SystemMessage(random.String()),
            tools: [],
            endpoint: endpoint,
            project: project);
    }
}
