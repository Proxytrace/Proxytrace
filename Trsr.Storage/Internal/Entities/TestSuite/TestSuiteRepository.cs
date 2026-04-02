using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.TestSuite;

namespace Trsr.Storage.Internal.Entities.TestSuite;

[UsedImplicitly]
internal class TestSuiteRepository : AbstractRepository<ITestSuite, TestSuiteEntity>, ITestSuiteRepository
{
    public TestSuiteRepository(
        IMapper<ITestSuite, TestSuiteEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }

    public async Task<IReadOnlyList<ITestSuite>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        var stored = await contextFactory()
            .Set<TestSuiteEntity>()
            .AsNoTracking()
            .Where(e => e.Agent == agentId)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }
}
