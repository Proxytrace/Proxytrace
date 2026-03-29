using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;

namespace Trsr.Storage.Internal.Entities.Project;

[UsedImplicitly]
internal class ProjectRepository : AbstractRepository<IProject, ProjectEntity>, IProjectRepository
{
    public ProjectRepository(
        IMapper<IProject, ProjectEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }

    public async Task<IProject?> FindByNameAsync(
        string name, 
        IOrganization organization, 
        CancellationToken cancellationToken = default) 
        => await contextFactory()
            .Set<ProjectEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Name == name && p.Organization == organization.Id, cancellationToken)
            .ContinueWith(t => Map(t.Result), cancellationToken);
}
