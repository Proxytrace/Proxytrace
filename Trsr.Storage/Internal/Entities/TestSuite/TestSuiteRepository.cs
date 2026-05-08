using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Exceptions;
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

    public Task<IReadOnlyList<ITestSuite>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
        => throw new NotImplementedException();

    protected override async Task UpdateRelationsAsync(
        StorageDbContext context,
        TestSuiteEntity storedEntity,
        CancellationToken cancellationToken)
    {
        var existing = await context.Set<TestSuiteEntity>()
            .Include(s => s.TestSuiteEvaluators)
            .FirstOrDefaultAsync(s => s.Id == storedEntity.Id, cancellationToken);

        if (existing is null)
            throw new EntityNotFoundException(storedEntity.Id, typeof(ITestSuite));

        var newIds = storedEntity.TestSuiteEvaluators.Select(e => e.EvaluatorId).ToHashSet();
        var existingIds = existing.TestSuiteEvaluators.Select(e => e.EvaluatorId).ToHashSet();

        var toRemove = existing.TestSuiteEvaluators.Where(e => !newIds.Contains(e.EvaluatorId)).ToList();
        foreach (var item in toRemove)
            context.Set<TestSuiteEvaluatorEntity>().Remove(item);

        var toAdd = newIds.Except(existingIds)
            .Select(id => new TestSuiteEvaluatorEntity { TestSuiteId = storedEntity.Id, EvaluatorId = id });
        foreach (var item in toAdd)
            context.Set<TestSuiteEvaluatorEntity>().Add(item);
    }
}
