using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.Evaluator;

namespace Trsr.Storage.Internal.Entities.Evaluator;

[UsedImplicitly]
internal class EvaluatorRepository : AbstractRepository<IEvaluator, EvaluatorEntity>, IEvaluatorRepository
{
    public EvaluatorRepository(
        IMapper<IEvaluator, EvaluatorEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }

    public Task<IReadOnlyList<IEvaluator>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
        => throw new NotImplementedException();
}
