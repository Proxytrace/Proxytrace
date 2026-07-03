using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.CustomAnomaly;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Exceptions;

namespace Proxytrace.Storage.Internal.Entities.CustomAnomalyDetector;

[UsedImplicitly]
internal class CustomAnomalyDetectorRepository
    : AbstractRepository<ICustomAnomalyDetector, CustomAnomalyDetectorEntity>,
      ICustomAnomalyDetectorRepository
{
    public CustomAnomalyDetectorRepository(
        IMapper<ICustomAnomalyDetector, CustomAnomalyDetectorEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        AmbientDbContext ambient) : base(mapper, contextFactory, transaction, entityEvents, ambient)
    {
    }

    public async Task<IReadOnlyList<ICustomAnomalyDetector>> GetByProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken = default)
    {
        var stored = await contextFactory()
            .Set<CustomAnomalyDetectorEntity>()
            .AsNoTracking()
            .Where(e => e.Project == projectId)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }

    public async Task<IReadOnlyList<ICustomAnomalyDetector>> GetEnabledByProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken = default)
    {
        var stored = await contextFactory()
            .Set<CustomAnomalyDetectorEntity>()
            .AsNoTracking()
            .Where(e => e.Project == projectId && e.IsEnabled)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }

    protected override async Task UpdateRelationsAsync(
        StorageDbContext context,
        CustomAnomalyDetectorEntity storedEntity,
        CancellationToken cancellationToken)
    {
        var existing = await context.Set<CustomAnomalyDetectorEntity>()
            .Include(d => d.ScopedAgents)
            .FirstOrDefaultAsync(d => d.Id == storedEntity.Id, cancellationToken);

        if (existing is null)
            throw new EntityNotFoundException(storedEntity.Id, typeof(ICustomAnomalyDetector));

        var newIds = storedEntity.ScopedAgents.Select(e => e.AgentId).ToHashSet();
        var existingIds = existing.ScopedAgents.Select(e => e.AgentId).ToHashSet();

        var toRemove = existing.ScopedAgents.Where(e => !newIds.Contains(e.AgentId)).ToList();
        foreach (var item in toRemove)
            context.Set<CustomAnomalyDetectorAgentEntity>().Remove(item);

        var toAdd = newIds.Except(existingIds)
            .Select(id => new CustomAnomalyDetectorAgentEntity { DetectorId = storedEntity.Id, AgentId = id });
        foreach (var item in toAdd)
            context.Set<CustomAnomalyDetectorAgentEntity>().Add(item);
    }
}
