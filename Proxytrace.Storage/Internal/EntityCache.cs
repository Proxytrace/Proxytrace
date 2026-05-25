using System.Collections.Concurrent;
using JetBrains.Annotations;
using Proxytrace.Domain;

namespace Proxytrace.Storage.Internal;

[UsedImplicitly]
internal sealed class EntityCache<TDomainEntity> : IEntityCache<TDomainEntity>
    where TDomainEntity : IDomainEntity
{
    // Background safety net against missed invalidations from out-of-band writes
    // (e.g. a SQL migration, another process). Write-through invalidation is the
    // primary correctness mechanism; TTL just bounds staleness if that ever fails.
    private readonly TimeSpan defaultTtl = TimeSpan.FromMinutes(5);

    private readonly TimeSpan ttl;
    private readonly TimeProvider clock;
    private readonly ConcurrentDictionary<Guid, Entry> entries = new();
    private Snapshot? allSnapshot;

    // Single ctor so Autofac never has to choose. Defaults to the system clock and the
    // module-default TTL; tests construct directly with a fake TimeProvider/short TTL.
    public EntityCache(TimeProvider? clock = null, TimeSpan? ttl = null)
    {
        this.clock = clock ?? TimeProvider.System;
        this.ttl = ttl ?? defaultTtl;
    }

    public TDomainEntity? TryGet(Guid id)
    {
        if (!entries.TryGetValue(id, out Entry? entry))
        {
            return default;
        }

        if (IsExpired(entry.CachedAt))
        {
            entries.TryRemove(id, out _);
            return default;
        }

        return entry.Entity;
    }

    public void Set(TDomainEntity entity)
        => entries[entity.Id] = new Entry(entity, clock.GetUtcNow());

    public void Invalidate(Guid id)
    {
        entries.TryRemove(id, out _);
        Volatile.Write(ref allSnapshot, null);
    }

    public IReadOnlyList<TDomainEntity>? TryGetAll()
    {
        Snapshot? snap = Volatile.Read(ref allSnapshot);
        if (snap is null)
        {
            return null;
        }

        if (IsExpired(snap.CachedAt))
        {
            Volatile.Write(ref allSnapshot, null);
            return null;
        }

        return snap.Entities;
    }

    public void SetAll(IReadOnlyList<TDomainEntity> entities)
    {
        DateTimeOffset now = clock.GetUtcNow();
        foreach (TDomainEntity entity in entities)
        {
            entries[entity.Id] = new Entry(entity, now);
        }
        Volatile.Write(ref allSnapshot, new Snapshot(entities, now));
    }

    public void InvalidateAll() 
        => Volatile.Write(ref allSnapshot, null);

    private bool IsExpired(DateTimeOffset cachedAt)
        => clock.GetUtcNow() - cachedAt > ttl;

    private sealed record Entry(TDomainEntity Entity, DateTimeOffset CachedAt);
    private sealed record Snapshot(IReadOnlyList<TDomainEntity> Entities, DateTimeOffset CachedAt);
}
