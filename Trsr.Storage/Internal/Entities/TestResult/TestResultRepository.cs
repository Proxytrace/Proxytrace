using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.TestResult;

namespace Trsr.Storage.Internal.Entities.TestResult;

[UsedImplicitly]
internal class TestResultRepository : AbstractRepository<ITestResult, TestResultEntity>, ITestResultRepository
{
    public TestResultRepository(
        IMapper<ITestResult, TestResultEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
    {
    }

    public async Task<ITestResult?> GetLatestByTestCaseAsync(Guid testCaseId, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var stored = await context
            .Set<TestResultEntity>()
            .AsNoTracking()
            .Where(r => r.TestCase == testCaseId)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }
}
