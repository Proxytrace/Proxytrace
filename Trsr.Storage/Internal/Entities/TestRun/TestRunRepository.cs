using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.TestRun;
using Trsr.Storage.Internal.Entities.TestRunGroup;
using Trsr.Storage.Internal.Entities.TestSuite;

namespace Trsr.Storage.Internal.Entities.TestRun;

[UsedImplicitly]
internal class TestRunRepository : AbstractRepository<ITestRun, TestRunEntity>, ITestRunRepository
{
    public TestRunRepository(
        IMapper<ITestRun, TestRunEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
    {
    }

    public async Task<IReadOnlyList<ITestRun>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var stored = await context
            .Set<TestRunEntity>()
            .AsNoTracking()
            .Join(context.Set<TestRunGroupEntity>(),
                r => r.Group,
                g => g.Id,
                (r, g) => new { Run = r, Group = g })
            .Join(context.Set<TestSuiteEntity>(),
                x => x.Group.Suite,
                s => s.Id,
                (x, s) => new { x.Run, Suite = s })
            .Where(x => x.Suite.Agent == agentId)
            .Select(x => x.Run)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }

    public async Task<IReadOnlyList<ITestRun>> GetByGroupAsync(Guid groupId, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var stored = await context
            .Set<TestRunEntity>()
            .AsNoTracking()
            .Where(r => r.Group == groupId)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }
}
