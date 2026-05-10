using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Application.Statistics;
using Trsr.Application.Statistics.TestRun;
using Trsr.Domain;
using Trsr.Domain.Usage;
using Trsr.Storage.Internal.Entities.Statistics;

namespace Trsr.Storage.Internal.Statistics;

[UsedImplicitly]
internal class TestRunStatsStore : IStatsReader<TestRunStats, TestRunStats.Filter>, IStatsWriter<TestRunStats>
{
    private readonly Func<StorageDbContext> contextFactory;
    private readonly ITransaction transaction;

    public TestRunStatsStore(Func<StorageDbContext> contextFactory, ITransaction transaction)
    {
        this.contextFactory = contextFactory;
        this.transaction = transaction;
    }

    public Task UpsertAsync(TestRunStats stats, CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            try
            {
                await UpsertCoreAsync(stats, cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Lost an insert race with a concurrent projector run. Retry as update if the
                // row now exists; otherwise the failure is real — rethrow.
                if (!await ExistsAsync(stats.TestRunId, cancellationToken))
                {
                    throw;
                }
                await UpsertCoreAsync(stats, cancellationToken);
            }
        });

    private async Task UpsertCoreAsync(TestRunStats stats, CancellationToken cancellationToken)
    {
        StorageDbContext context = contextFactory();
        DbSet<TestRunStatsEntity> set = context.Set<TestRunStatsEntity>();

        TestRunStatsEntity? existing = await set
            .FirstOrDefaultAsync(e => e.TestRunId == stats.TestRunId, cancellationToken);

        DateTimeOffset now = DateTimeOffset.UtcNow;

        if (existing is null)
        {
            TestRunStatsEntity entity = ToEntity(stats, id: Guid.NewGuid(), createdAt: now, updatedAt: now);
            set.Add(entity);
        }
        else
        {
            TestRunStatsEntity updated = ToEntity(stats, id: existing.Id, createdAt: existing.CreatedAt, updatedAt: now);
            context.Entry(existing).CurrentValues.SetValues(updated);
        }

        await context.SaveChangesAsync(cancellationToken);
    }

    private Task<bool> ExistsAsync(Guid testRunId, CancellationToken cancellationToken)
        => contextFactory().Set<TestRunStatsEntity>()
            .AsNoTracking()
            .AnyAsync(e => e.TestRunId == testRunId, cancellationToken);

    public Task RemoveAsync(Guid testRunId, CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            StorageDbContext context = contextFactory();
            DbSet<TestRunStatsEntity> set = context.Set<TestRunStatsEntity>();
            TestRunStatsEntity? existing = await set
                .FirstOrDefaultAsync(e => e.TestRunId == testRunId, cancellationToken);
            if (existing is null)
            {
                return;
            }
            set.Remove(existing);
            await context.SaveChangesAsync(cancellationToken);
        });

    public async Task<TestRunStats?> FindAsync(Guid testRunId, CancellationToken cancellationToken = default)
    {
        TestRunStatsEntity? entity = await contextFactory()
            .Set<TestRunStatsEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.TestRunId == testRunId, cancellationToken);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<IReadOnlyList<TestRunStats>> QueryAsync(TestRunStats.Filter filter, CancellationToken cancellationToken = default)
    {
        IQueryable<TestRunStatsEntity> q = contextFactory()
            .Set<TestRunStatsEntity>()
            .AsNoTracking();

        if (filter.AgentId.HasValue)
        {
            q = q.Where(e => e.AgentId == filter.AgentId.Value);
        }
        if (filter.AgentIds is { Count: > 0 } agentIds)
        {
            q = q.Where(e => agentIds.Contains(e.AgentId));
        }
        if (filter.EndpointId.HasValue)
        {
            q = q.Where(e => e.EndpointId == filter.EndpointId.Value);
        }
        if (filter.GroupId.HasValue)
        {
            q = q.Where(e => e.GroupId == filter.GroupId.Value);
        }
        if (filter.SuiteId.HasValue)
        {
            q = q.Where(e => e.SuiteId == filter.SuiteId.Value);
        }
        if (filter.From.HasValue)
        {
            q = q.Where(e => e.RunCompletedAt >= filter.From.Value);
        }
        if (filter.To.HasValue)
        {
            q = q.Where(e => e.RunCompletedAt <= filter.To.Value);
        }

        List<TestRunStatsEntity> rows = await q.ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToArray();
    }

    private static TestRunStatsEntity ToEntity(TestRunStats stats, Guid id, DateTimeOffset createdAt, DateTimeOffset updatedAt)
        => new()
        {
            Id = id,
            TestRunId = stats.TestRunId,
            AgentId = stats.AgentId,
            EndpointId = stats.EndpointId,
            GroupId = stats.GroupId,
            SuiteId = stats.SuiteId,
            TestCases = stats.TestCases,
            Passed = stats.Passed,
            InputTokens = (long?)stats.Usage?.InputTokenCount,
            OutputTokens = (long?)stats.Usage?.OutputTokenCount,
            TotalDurationMicroseconds = stats.TotalDuration.HasValue ? (long?)stats.TotalDuration.Value.TotalMicroseconds : null,
            Cost = stats.Cost,
            RunCompletedAt = stats.RunCompletedAt,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt,
        };

    private static TestRunStats ToDto(TestRunStatsEntity entity)
    {
        TokenUsage? usage = entity.InputTokens.HasValue && entity.OutputTokens.HasValue
            ? new TokenUsage((ulong)entity.InputTokens.Value, (ulong)entity.OutputTokens.Value)
            : null;

        TimeSpan? duration = entity.TotalDurationMicroseconds.HasValue
            ? TimeSpan.FromMicroseconds(entity.TotalDurationMicroseconds.Value)
            : null;

        return new TestRunStats(
            TestRunId: entity.TestRunId,
            AgentId: entity.AgentId,
            EndpointId: entity.EndpointId,
            GroupId: entity.GroupId,
            SuiteId: entity.SuiteId,
            TestCases: entity.TestCases,
            Passed: entity.Passed,
            TotalDuration: duration,
            Usage: usage,
            Cost: entity.Cost,
            RunCompletedAt: entity.RunCompletedAt);
    }
}
