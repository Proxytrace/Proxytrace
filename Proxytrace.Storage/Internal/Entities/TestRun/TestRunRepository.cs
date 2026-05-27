using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Paging;
using Proxytrace.Domain.TestRun;
using Proxytrace.Storage.Internal.Entities.TestRunGroup;
using Proxytrace.Storage.Internal.Entities.TestSuite;

namespace Proxytrace.Storage.Internal.Entities.TestRun;

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

    public async Task<PagedResult<ITestRun>> GetByAgentPagedAsync(
        Guid agentId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Paging.Clamp(page, pageSize);
        var context = contextFactory();
        var query = context
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
            .Select(x => x.Run);

        int total = await query.CountAsync(cancellationToken);
        var stored = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<ITestRun>(await Map(stored, cancellationToken), total, page, pageSize);
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
