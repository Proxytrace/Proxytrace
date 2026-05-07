using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.User;

namespace Trsr.Domain.Project.Internal;

internal class ProjectGenerator : DomainEntityGenerator<IProject>
{
    private readonly IProject.CreateNew factory;
    private readonly IDomainEntityGenerator<IModelEndpoint> endpointGenerator;

    public ProjectGenerator(
        IProject.CreateNew factory,
        IRepository<IProject> repository,
        IDomainEntityGenerator<IModelEndpoint> endpointGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.endpointGenerator = endpointGenerator;
    }

    public override async Task<IProject> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var endpoint = await endpointGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            name: random.String(),
            systemEndpoint: endpoint,
            members: Array.Empty<IUser>());
    }
}
