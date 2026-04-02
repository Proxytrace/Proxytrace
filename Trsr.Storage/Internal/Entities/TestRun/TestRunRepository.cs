using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.TestRun;

namespace Trsr.Storage.Internal.Entities.TestRun;

[UsedImplicitly]
internal class TestRunRepository : AbstractRepository<ITestRun, TestRunEntity>, ITestRunRepository
{
    public TestRunRepository(
        IMapper<ITestRun, TestRunEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }

    public async Task<IReadOnlyList<ITestRun>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        var stored = await contextFactory()
            .Set<TestRunEntity>()
            .AsNoTracking()
            .Where(e => e.Agent == agentId)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }
}
