using System.Collections.Concurrent;
using JetBrains.Annotations;
using Trsr.Domain;

namespace Trsr.Storage.Internal;

[UsedImplicitly]
internal sealed class EntityCache<TDomainEntity> : IEntityCache<TDomainEntity>
    where TDomainEntity : IDomainEntity
{
    private readonly ConcurrentDictionary<Guid, TDomainEntity> entries = new();
    private volatile IReadOnlyList<TDomainEntity>? allSnapshot;

    public TDomainEntity? TryGet(Guid id)
        => entries.TryGetValue(id, out var entity) ? entity : default;

    public void Set(TDomainEntity entity)
        => entries[entity.Id] = entity;

    public void Invalidate(Guid id)
    {
        entries.TryRemove(id, out _);
        allSnapshot = null;
    }

    public IReadOnlyList<TDomainEntity>? TryGetAll() => allSnapshot;

    public void SetAll(IReadOnlyList<TDomainEntity> entities)
    {
        foreach (var entity in entities)
        {
            entries[entity.Id] = entity;
        }
        allSnapshot = entities;
    }

    public void InvalidateAll() => allSnapshot = null;
}
