using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.ProjectSearchSettings;

namespace Proxytrace.Storage.Internal.Entities.ProjectSearchSettings;

[UsedImplicitly]
internal class ProjectSearchSettingsRepository
    : AbstractRepository<IProjectSearchSettings, ProjectSearchSettingsEntity>,
      IProjectSearchSettingsRepository
{
    public ProjectSearchSettingsRepository(
        IMapper<IProjectSearchSettings, ProjectSearchSettingsEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
    {
    }

    public async Task<IProjectSearchSettings?> FindByProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var stored = await contextFactory()
            .Set<ProjectSearchSettingsEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Project == projectId, cancellationToken);

        return stored is null ? null : await mapper.Map(stored, cancellationToken);
    }
}
