using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent.Internal;

internal class AgentGenerator : DomainEntityGenerator<IAgent>
{
    private readonly IAgent.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;

    public AgentGenerator(
        IAgent.CreateNew factory,
        IRepository<IAgent> repository,
        IDomainEntityGenerator<IProject> projectGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
    }

    public override async Task<IAgent> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            systemMessage: new SystemMessage(random.String()),
            project: project.Id,
            tools: Array.Empty<ToolSpecification>());
    }
}
