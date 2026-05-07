using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
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
        CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory()
            .Set<ProjectEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Name == name, cancellationToken);
        return await Map(entity, cancellationToken);
    }
}
