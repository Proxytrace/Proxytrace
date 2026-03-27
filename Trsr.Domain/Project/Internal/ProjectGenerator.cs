using Trsr.Common.Async;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Project.Internal;

internal class ProjectGenerator : DomainEntityGenerator<IProject>
{
    private readonly IProject.CreateNew factory;

    public ProjectGenerator(
        IProject.CreateNew factory,
        IRepository<IProject> repository) : base(repository)
    {
        this.factory = factory;
    }

    public override Task<IProject> GenerateAsync(CancellationToken cancellationToken = default) 
        => factory(Guid.NewGuid().ToString(), Guid.NewGuid()).ToTaskResult();
}

