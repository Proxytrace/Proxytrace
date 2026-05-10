using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Events;

namespace Trsr.Storage.Internal.Entities.Evaluator;

[UsedImplicitly]
internal class EvaluatorRepository : AbstractRepository<IEvaluator, EvaluatorEntity>, IEvaluatorRepository
{
    public EvaluatorRepository(
        IMapper<IEvaluator, EvaluatorEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
    {
    }

    public async Task<IReadOnlyList<IEvaluator>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var stored = await contextFactory()
            .Set<EvaluatorEntity>()
            .AsNoTracking()
            .Where(e => e.Project == projectId)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }
}
