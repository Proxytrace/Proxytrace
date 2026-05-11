using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.ProjectSearchSettings;

namespace Trsr.Storage.Internal.Entities.ProjectSearchSettings;

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
        var stored = await ContextFactory()
            .Set<ProjectSearchSettingsEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Project == projectId, cancellationToken);

        return stored is null ? null : await Mapper.Map(stored, cancellationToken);
    }
}
