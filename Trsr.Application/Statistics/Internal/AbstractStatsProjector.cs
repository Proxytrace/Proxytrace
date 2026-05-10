using Trsr.Domain;
using Trsr.Domain.Events;

namespace Trsr.Application.Statistics.Internal;

internal abstract class AbstractStatsProjector<TDomainEntity, TStats> : IStatsProjector 
    where TDomainEntity : IDomainEntity
    where TStats : IStats
{
    private readonly IStatsWriter<TStats> writer;
    private readonly IRepository<TDomainEntity> repository;
    
    public Type EntityType => typeof(TDomainEntity);

    protected AbstractStatsProjector(
        IStatsWriter<TStats> writer,
        IRepository<TDomainEntity> repository)
    {
        this.writer = writer;
        this.repository = repository;
    }
    
    public async Task ProjectAsync(Guid entityId, EntityChangeType change, CancellationToken cancellationToken)
    {
        var entity = await repository.FindAsync(entityId, cancellationToken);
        if (entity == null)
        {
            await writer.RemoveAsync(entityId, cancellationToken);
            return;
        }
        
        var stats = await ComputeStatsAsync(entity, cancellationToken);
        await writer.UpsertAsync(stats, cancellationToken);
    }
    
    protected abstract Task<TStats> ComputeStatsAsync(TDomainEntity entity, CancellationToken cancellationToken);
}