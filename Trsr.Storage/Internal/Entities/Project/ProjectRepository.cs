using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.Project;

namespace Trsr.Storage.Internal.Entities.Project;

[UsedImplicitly]
internal class ProjectRepository : AbstractRepository<IProject, ProjectEntity>
{
    public ProjectRepository(
        IMapper<IProject, ProjectEntity> mapper, 
        Func<StorageDbContext> contextFactory, 
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }
}