using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.TestRunGroup;
using Trsr.Storage.Internal.Entities.Agent;
using Trsr.Storage.Internal.Entities.TestSuite;

namespace Trsr.Storage.Internal.Entities.TestRunGroup;

[UsedImplicitly]
internal class TestRunGroupRepository : AbstractRepository<ITestRunGroup, TestRunGroupEntity>, ITestRunGroupRepository
{
    public TestRunGroupRepository(
        IMapper<ITestRunGroup, TestRunGroupEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
    {
    }

    public async Task<IReadOnlyList<ITestRunGroup>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var stored = await context
            .Set<TestRunGroupEntity>()
            .AsNoTracking()
            .Join(context.Set<TestSuiteEntity>(),
                g => g.Suite,
                s => s.Id,
                (g, s) => new { Group = g, Suite = s })
            .Where(x => x.Suite.Agent == agentId)
            .Select(x => x.Group)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }

    public async Task<IReadOnlyList<ITestRunGroup>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var stored = await context
            .Set<TestRunGroupEntity>()
            .AsNoTracking()
            .Join(context.Set<TestSuiteEntity>(),
                g => g.Suite,
                s => s.Id,
                (g, s) => new { Group = g, Suite = s })
            .Join(context.Set<AgentEntity>(),
                gs => gs.Suite.Agent,
                a => a.Id,
                (gs, a) => new { gs.Group, Agent = a })
            .Where(x => x.Agent.Project == projectId)
            .Select(x => x.Group)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }
}
