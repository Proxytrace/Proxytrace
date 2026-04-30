using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.User;

namespace Trsr.Domain.Organization.Internal;

internal class OrganizationGenerator : DomainEntityGenerator<IOrganization>
{
    private readonly IOrganization.CreateNew factory;
    private readonly IDomainEntityGenerator<IUser> userGenerator;

    public OrganizationGenerator(
        IOrganization.CreateNew factory,
        IRepository<IOrganization> repository,
        IDomainEntityGenerator<IUser> userGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.userGenerator = userGenerator;
    }

    public override async Task<IOrganization> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var users = await Enumerable.Range(0, random.Int(max: 5))
            .Select(_ => userGenerator.CreateAsync(cancellationToken))
            .Await();
        return factory(name: random.String(), users: users.ToList());
    }
}
