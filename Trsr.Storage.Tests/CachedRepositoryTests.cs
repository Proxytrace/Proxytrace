using System.Transactions;
using AwesomeAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Model;
using Trsr.Domain.User;
using Trsr.Storage.Internal;
using Trsr.Storage.Internal.Entities.Model;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

[TestClass]
public sealed class CachedRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task FindAsync_SecondCall_ReturnsCachedValueEvenIfDbChangedUnderneath()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IModel>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IModel>>();

        IModel created = await generator.CreateAsync(CancellationToken);

        // First read — populates the cache.
        IModel? first = await repository.FindAsync(created.Id, CancellationToken);
        first!.Name.Should().Be(created.Name);

        // Mutate the underlying row directly via a fresh DbContext, bypassing the cache.
        await using (var ctx = services.GetRequiredService<StorageDbContext>())
        {
            var stored = await ctx.Set<ModelEntity>().FirstAsync(e => e.Id == created.Id, CancellationToken);
            ctx.Entry(stored).CurrentValues.SetValues(stored with { Name = "CHANGED-IN-DB" });
            await ctx.SaveChangesAsync(CancellationToken);
        }

        // Second read — must come from the cache (proves the cache is actually serving reads).
        IModel? second = await repository.FindAsync(created.Id, CancellationToken);
        second!.Name.Should().Be(created.Name);
    }

    [TestMethod]
    public async Task UpdateAsync_AfterCachePopulated_ReturnsUpdatedValue()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IModel>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IModel>>();
        var createExisting = services.GetRequiredService<IModel.CreateExisting>();

        IModel created = await generator.CreateAsync(CancellationToken);
        // Populate cache.
        await repository.FindAsync(created.Id, CancellationToken);

        IModel updated = createExisting("renamed", created);
        await repository.UpdateAsync(updated, CancellationToken);

        IModel? after = await repository.FindAsync(created.Id, CancellationToken);
        after!.Name.Should().Be("renamed");
    }

    [TestMethod]
    public async Task RemoveAsync_AfterCachePopulated_SubsequentFindReturnsNull()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IModel>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IModel>>();

        IModel created = await generator.CreateAsync(CancellationToken);
        await repository.FindAsync(created.Id, CancellationToken);

        await repository.RemoveAsync(created.Id, CancellationToken);

        IModel? after = await repository.FindAsync(created.Id, CancellationToken);
        after.Should().BeNull();
    }

    [TestMethod]
    public async Task GetAllAsync_AfterPopulating_ReturnsCachedSnapshotEvenIfDbChanges()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IModel>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IModel>>();

        await generator.CreateAsync(CancellationToken);
        await generator.CreateAsync(CancellationToken);

        IReadOnlyList<IModel> first = await repository.GetAllAsync(CancellationToken);
        first.Should().HaveCount(2);

        // Insert directly via the DbContext so the repository (and its cache) don't observe it.
        await using (var ctx = services.GetRequiredService<StorageDbContext>())
        {
            var now = DateTimeOffset.UtcNow.AddSeconds(-1);
            ctx.Set<ModelEntity>().Add(new ModelEntity
            {
                Id = Guid.NewGuid(),
                Name = "smuggled",
                CreatedAt = now,
                UpdatedAt = now,
            });
            await ctx.SaveChangesAsync(CancellationToken);
        }

        IReadOnlyList<IModel> second = await repository.GetAllAsync(CancellationToken);
        second.Should().HaveCount(2);
    }

    [TestMethod]
    public async Task GetAllAsync_AfterAdd_ReturnsFreshSnapshotIncludingNewEntity()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IModel>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IModel>>();

        await generator.CreateAsync(CancellationToken);
        IReadOnlyList<IModel> first = await repository.GetAllAsync(CancellationToken);
        first.Should().HaveCount(1);

        await generator.CreateAsync(CancellationToken);

        IReadOnlyList<IModel> second = await repository.GetAllAsync(CancellationToken);
        second.Should().HaveCount(2);
    }

    [TestMethod]
    public async Task NonCacheableEntity_RoundTripsThroughRepositoryAsBefore()
    {
        // Users are not [Cacheable]. Verify the non-cached path still works end-to-end so
        // high-volume entities are unaffected by the caching changes.
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IUser>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var createExisting = services.GetRequiredService<IUser.CreateExisting>();

        IUser created = await generator.CreateAsync(CancellationToken);
        IUser? loaded = await repository.FindAsync(created.Id, CancellationToken);
        loaded!.Name.Should().Be(created.Name);

        await repository.UpdateAsync(createExisting("renamed", created), CancellationToken);
        IUser? updated = await repository.FindAsync(created.Id, CancellationToken);
        updated!.Name.Should().Be("renamed");

        await repository.RemoveAsync(created.Id, CancellationToken);
        (await repository.FindAsync(created.Id, CancellationToken)).Should().BeNull();
    }

    [TestMethod]
    public void NonCacheableEntity_HasNoCacheRegistered()
    {
        // Cache registration is opt-in via [Cacheable]. Sanity-check that non-cacheable
        // domain types resolve no IEntityCache<T> binding.
        IServiceProvider services = GetServices();
        services.GetService<IEntityCache<IUser>>().Should().BeNull();
        services.GetService<IEntityCache<IModel>>().Should().NotBeNull();
    }

    [TestMethod]
    public async Task FindAsync_InsideTransactionScope_DoesNotPopulateCache()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IModel>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IModel>>();
        var cache = services.GetRequiredService<IEntityCache<IModel>>();

        IModel created = await generator.CreateAsync(CancellationToken);
        // Be sure the cache is empty for this id (CreateAsync invalidates after the write).
        cache.TryGet(created.Id).Should().BeNull();

        // Read inside an ambient transaction that we explicitly do NOT complete.
        using (new TransactionScope(
                   TransactionScopeOption.Required,
                   new TransactionOptions { IsolationLevel = IsolationLevel.ReadCommitted },
                   TransactionScopeAsyncFlowOption.Enabled))
        {
            await repository.FindAsync(created.Id, CancellationToken);
        }

        // Cache must remain empty: a value loaded inside an uncompleted scope must never be
        // promoted to the singleton cache, otherwise rolled-back data could leak.
        cache.TryGet(created.Id).Should().BeNull();
    }

    [TestMethod]
    public void EntityCache_TtlExpiry_EvictsStaleEntriesAndSnapshots()
    {
        // Direct unit test of the cache itself with a fake clock.
        var clock = new FakeTimeProvider(new DateTimeOffset(2025, 1, 1, 0, 0, 0, TimeSpan.Zero));
        var cache = new EntityCache<IModel>(TimeSpan.FromMinutes(1), clock);
        var model = new StubModel(Guid.NewGuid(), "m1");

        cache.Set(model);
        cache.SetAll(new IModel[] { model });
        cache.TryGet(model.Id).Should().NotBeNull();
        cache.TryGetAll().Should().NotBeNull();

        clock.Advance(TimeSpan.FromMinutes(2));

        cache.TryGet(model.Id).Should().BeNull("entry exceeds TTL");
        cache.TryGetAll().Should().BeNull("snapshot exceeds TTL");
    }

    [TestMethod]
    public async Task UpdateAsync_InvalidatesCacheUnconditionally()
    {
        // Writes always invalidate (even though they run inside transaction.InvokeAsync's
        // ambient scope) — invalidation is monotonically safe under both commit and rollback,
        // and the post-write GetAsync reload runs inside the scope so it does not repopulate.
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<IModel>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IModel>>();
        var createExisting = services.GetRequiredService<IModel.CreateExisting>();
        var cache = services.GetRequiredService<IEntityCache<IModel>>();

        IModel created = await generator.CreateAsync(CancellationToken);
        await repository.FindAsync(created.Id, CancellationToken);
        cache.TryGet(created.Id).Should().NotBeNull();

        await repository.UpdateAsync(createExisting("after-update", created), CancellationToken);

        cache.TryGet(created.Id).Should().BeNull("the write must invalidate the cache entry");
    }

    private sealed class FakeTimeProvider : TimeProvider
    {
        private DateTimeOffset now;
        public FakeTimeProvider(DateTimeOffset start) => now = start;
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan by) => now = now.Add(by);
    }

    private sealed record StubModel(Guid Id, string Name) : IModel
    {
        public DateTimeOffset CreatedAt { get; } = DateTimeOffset.UtcNow.AddMinutes(-1);
        public DateTimeOffset UpdatedAt { get; } = DateTimeOffset.UtcNow.AddMinutes(-1);
        public IEnumerable<System.ComponentModel.DataAnnotations.ValidationResult> Validate(
            System.ComponentModel.DataAnnotations.ValidationContext validationContext) => [];
    }
}
