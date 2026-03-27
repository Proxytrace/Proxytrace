using Trsr.Common.Async;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Organization.Internal;

internal class OrganizationGenerator : DomainEntityGenerator<IOrganization>
{
    private readonly IOrganization.CreateNew factory;

    public OrganizationGenerator(
        IOrganization.CreateNew factory,
        IRepository<IOrganization> repository) : base(repository)
    {
        this.factory = factory;
    }

    public override Task<IOrganization> GenerateAsync(CancellationToken cancellationToken = default) 
        => factory(Guid.NewGuid().ToString(), Array.Empty<Guid>()).ToTaskResult();
}


