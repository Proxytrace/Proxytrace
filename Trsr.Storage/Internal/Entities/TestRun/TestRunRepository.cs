using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.TestRun;
using Trsr.Storage.Internal.Entities.TestSuite;

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
        var context = contextFactory();
        var stored = await context
            .Set<TestRunEntity>()
            .AsNoTracking()
            .Join(context.Set<TestSuiteEntity>(),
                r => r.Suite,
                s => s.Id, 
                (r, s) => new { Run = r, Suite = s })
            .Where(x => x.Suite.Agent == agentId)
            .Select(x => x.Run)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }
}
