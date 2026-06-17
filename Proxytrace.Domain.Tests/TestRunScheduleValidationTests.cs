using System.Collections.Concurrent;
using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestRunSchedule;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class TestRunScheduleValidationTests : DomainTest<Module>
{
    // The storage (five-file) implementation for ITestRunSchedule is out of scope for this phase,
    // so there is no real IRepository<ITestRunSchedule> registration yet. These domain tests
    // isolate the entity from persistence with an in-memory substitute repository (per the test
    // skill's "substitute IRepository<T> to isolate the SUT from persistence" guidance).
    private static IRepository<ITestRunSchedule> BuildRepository(ConcurrentDictionary<Guid, ITestRunSchedule> store)
    {
        var repo = Substitute.For<IRepository<ITestRunSchedule>>();
        repo.AddAsync(Arg.Any<ITestRunSchedule>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var entity = call.Arg<ITestRunSchedule>();
                store[entity.Id] = entity;
                return Task.FromResult(entity);
            });
        repo.UpdateAsync(Arg.Any<ITestRunSchedule>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var entity = call.Arg<ITestRunSchedule>();
                store[entity.Id] = entity;
                return Task.FromResult(entity);
            });
        repo.GetAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(call => Task.FromResult(store[call.Arg<Guid>()]));
        return repo;
    }

    private IServiceProvider GetServicesWithRepository()
    {
        var backing = new ConcurrentDictionary<Guid, ITestRunSchedule>();
        return GetServices(builder =>
            builder.RegisterInstance(BuildRepository(backing)).As<IRepository<ITestRunSchedule>>());
    }

    // ── factory / construction ────────────────────────────────────────────────

    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesSchedule()
    {
        IServiceProvider services = GetServicesWithRepository();
        var factory = services.GetRequiredService<ITestRunSchedule.CreateNew>();
        var suite = await GetOrCreate<ITestSuite>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        var schedule = factory("Nightly", suite, [endpoint], TimeSpan.FromHours(1), true);

        schedule.Should().NotBeNull();
        schedule.Name.Should().Be("Nightly");
        schedule.Suite.Should().Be(suite);
        schedule.Endpoints.Should().ContainSingle().Which.Should().Be(endpoint);
        schedule.Interval.Should().Be(TimeSpan.FromHours(1));
        schedule.IsEnabled.Should().BeTrue();
        schedule.LastRunAt.Should().BeNull();
        schedule.NextRunAt.Should().BeCloseTo(schedule.CreatedAt + TimeSpan.FromHours(1), TimeSpan.FromSeconds(5));
        schedule.Id.Should().NotBe(Guid.Empty);
        schedule.CreatedAt.Should().NotBe(default);
        schedule.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_IdsAreUniquePerInstance()
    {
        IServiceProvider services = GetServicesWithRepository();
        var factory = services.GetRequiredService<ITestRunSchedule.CreateNew>();
        var suite = await GetOrCreate<ITestSuite>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        var first = factory("Nightly", suite, [endpoint], TimeSpan.FromHours(1), true);
        var second = factory("Nightly", suite, [endpoint], TimeSpan.FromHours(1), true);

        first.Id.Should().NotBe(second.Id);
    }

    [TestMethod]
    public async Task CreateExisting_RestoresAllProperties()
    {
        IServiceProvider services = GetServicesWithRepository();
        var createNew = services.GetRequiredService<ITestRunSchedule.CreateNew>();
        var createExisting = services.GetRequiredService<ITestRunSchedule.CreateExisting>();
        var suite = await GetOrCreate<ITestSuite>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);
        var original = createNew("Nightly", suite, [endpoint], TimeSpan.FromHours(2), true);

        var schedule = createExisting(
            original.Name, original.Suite, original.Endpoints, original.Interval, original.IsEnabled,
            original.NextRunAt, original.LastRunAt, original);

        schedule.Id.Should().Be(original.Id);
        schedule.Name.Should().Be(original.Name);
        schedule.Suite.Should().Be(original.Suite);
        schedule.Interval.Should().Be(original.Interval);
        schedule.IsEnabled.Should().Be(original.IsEnabled);
        schedule.NextRunAt.Should().Be(original.NextRunAt);
        schedule.LastRunAt.Should().Be(original.LastRunAt);
        schedule.CreatedAt.Should().Be(original.CreatedAt);
        schedule.UpdatedAt.Should().Be(original.UpdatedAt);
    }

    // ── RecordFired ───────────────────────────────────────────────────────────

    [TestMethod]
    public async Task RecordFired_WithManyMissedIntervals_CollapsesIntoSingleForwardJump()
    {
        IServiceProvider services = GetServicesWithRepository();
        var schedule = await CreateSchedule(services, interval: TimeSpan.FromHours(1));

        // NextRunAt starts at CreatedAt + 1h (in the recent past). Fire well into the future so
        // many whole intervals have elapsed.
        var now = DateTimeOffset.UtcNow.AddDays(10);

        var fired = await schedule.RecordFired(now, CancellationToken);

        fired.LastRunAt.Should().Be(now);
        fired.NextRunAt.Should().BeAfter(now);
        (fired.NextRunAt - now).Should().BeLessThanOrEqualTo(TimeSpan.FromHours(1));
    }

    [TestMethod]
    public async Task RecordFired_PersistsLastRunAndNextRun()
    {
        IServiceProvider services = GetServicesWithRepository();
        var repo = services.GetRequiredService<IRepository<ITestRunSchedule>>();
        var schedule = await CreateSchedule(services, interval: TimeSpan.FromHours(1));

        var now = DateTimeOffset.UtcNow.AddDays(1);
        await schedule.RecordFired(now, CancellationToken);

        var reloaded = await repo.GetAsync(schedule.Id, CancellationToken);
        reloaded.LastRunAt.Should().Be(now);
        reloaded.NextRunAt.Should().BeAfter(now);
    }

    // ── enable / disable ──────────────────────────────────────────────────────

    [TestMethod]
    public async Task DisableThenEnable_TogglesIsEnabled()
    {
        IServiceProvider services = GetServicesWithRepository();
        var schedule = await CreateSchedule(services, interval: TimeSpan.FromHours(1));

        var disabled = await schedule.Disable(CancellationToken);
        disabled.IsEnabled.Should().BeFalse();

        var enabled = await disabled.Enable(CancellationToken);
        enabled.IsEnabled.Should().BeTrue();
    }

    [TestMethod]
    public async Task Disable_PersistsDisabledState()
    {
        IServiceProvider services = GetServicesWithRepository();
        var repo = services.GetRequiredService<IRepository<ITestRunSchedule>>();
        var schedule = await CreateSchedule(services, interval: TimeSpan.FromHours(1));

        await schedule.Disable(CancellationToken);

        var reloaded = await repo.GetAsync(schedule.Id, CancellationToken);
        reloaded.IsEnabled.Should().BeFalse();
    }

    // ── update ────────────────────────────────────────────────────────────────

    [TestMethod]
    public async Task Update_ChangesNameIntervalAndEnabled()
    {
        IServiceProvider services = GetServicesWithRepository();
        var endpoint = await GetOrCreate<IModelEndpoint>(services);
        var schedule = await CreateSchedule(services, interval: TimeSpan.FromHours(1));

        var updated = await schedule.Update("Renamed", [endpoint], TimeSpan.FromHours(6), false, CancellationToken);

        updated.Name.Should().Be("Renamed");
        updated.Interval.Should().Be(TimeSpan.FromHours(6));
        updated.IsEnabled.Should().BeFalse();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private async Task<ITestRunSchedule> CreateSchedule(IServiceProvider services, TimeSpan interval)
    {
        var factory = services.GetRequiredService<ITestRunSchedule.CreateNew>();
        var repo = services.GetRequiredService<IRepository<ITestRunSchedule>>();
        var suite = await GetOrCreate<ITestSuite>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        var schedule = factory("Nightly", suite, [endpoint], interval, true);
        return await repo.AddAsync(schedule, CancellationToken);
    }
}
