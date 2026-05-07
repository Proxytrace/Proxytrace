using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Organization;

namespace Trsr.Domain.Project.Internal;

internal class ProjectGenerator : DomainEntityGenerator<IProject>
{
    private readonly IProject.CreateNew factory;
    private readonly IDomainEntityGenerator<IModelEndpoint> endpointGenerator;
    private readonly IDomainEntityGenerator<IOrganization> organizationGenerator;

    public ProjectGenerator(
        IProject.CreateNew factory,
        IRepository<IProject> repository,
        IDomainEntityGenerator<IModelEndpoint> endpointGenerator,
        IDomainEntityGenerator<IOrganization> organizationGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.endpointGenerator = endpointGenerator;
        this.organizationGenerator = organizationGenerator;
    }

    public override async Task<IProject> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var organization = await organizationGenerator.GetOrCreateAsync(cancellationToken);
        var endpoint = await endpointGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            name: random.String(),
            systemEndpoint: endpoint,
            organization: organization);
    }
}
