using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Project.Internal;

internal class ProjectGenerator : DomainEntityGenerator<IProject>
{
    private readonly IProject.CreateNew factory;

    public ProjectGenerator(
        IProject.CreateNew factory,
        IRepository<IProject> repository,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
    }

    public override Task<IProject> GenerateAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(factory(name: random.String()));
}
