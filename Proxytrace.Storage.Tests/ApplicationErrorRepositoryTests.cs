using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain.ApplicationError;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class ApplicationErrorRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetPagedNewestFirst_OrdersByCreatedAtDescending()
    {
        var services = GetServices();
        var generator = services.GetRequiredService<IApplicationErrorGenerator>();
        var repository = services.GetRequiredService<IApplicationErrorRepository>();

        var oldest = await generator.CreateAsync(DateTimeOffset.UtcNow.AddMinutes(-30), CancellationToken);
        var middle = await generator.CreateAsync(DateTimeOffset.UtcNow.AddMinutes(-20), CancellationToken);
        var newest = await generator.CreateAsync(DateTimeOffset.UtcNow.AddMinutes(-10), CancellationToken);

        var paged = await repository.GetPagedNewestFirstAsync(1, 50, null, CancellationToken);

        paged.Total.Should().Be(3);
        paged.Items.Select(e => e.Id).Should().ContainInOrder(newest.Id, middle.Id, oldest.Id);
    }

    [TestMethod]
    public async Task GetPagedNewestFirst_WithLevelFilter_ReturnsOnlyMatchingLevel()
    {
        var services = GetServices();
        var factory = services.GetRequiredService<IApplicationError.CreateNew>();
        var repository = services.GetRequiredService<IApplicationErrorRepository>();

        await factory("crit", ApplicationErrorLevel.Critical, "Cat", null, null).AddAsync(CancellationToken);
        await factory("err1", ApplicationErrorLevel.Error, "Cat", null, null).AddAsync(CancellationToken);
        await factory("err2", ApplicationErrorLevel.Error, "Cat", null, null).AddAsync(CancellationToken);

        var criticals = await repository.GetPagedNewestFirstAsync(1, 50, ApplicationErrorLevel.Critical, CancellationToken);

        criticals.Total.Should().Be(1);
        criticals.Items.Should().ContainSingle(e => e.Message == "crit");
    }

    [TestMethod]
    public async Task RemoveOlderThan_RemovesEntriesAtOrBeforeCutoff()
    {
        var services = GetServices();
        var generator = services.GetRequiredService<IApplicationErrorGenerator>();
        var repository = services.GetRequiredService<IApplicationErrorRepository>();

        var stale = await generator.CreateAsync(DateTimeOffset.UtcNow.AddDays(-10), CancellationToken);
        var fresh = await generator.CreateAsync(DateTimeOffset.UtcNow.AddHours(-1), CancellationToken);

        var removed = await repository.RemoveOlderThanAsync(DateTimeOffset.UtcNow.AddDays(-1), CancellationToken);

        removed.Should().Be(1);
        var remaining = await repository.GetAllAsync(CancellationToken);
        remaining.Should().ContainSingle(e => e.Id == fresh.Id);
        remaining.Should().NotContain(e => e.Id == stale.Id);
    }

    [TestMethod]
    public async Task TrimToNewest_KeepsOnlyNewestN()
    {
        var services = GetServices();
        var generator = services.GetRequiredService<IApplicationErrorGenerator>();
        var repository = services.GetRequiredService<IApplicationErrorRepository>();

        var ids = new List<Guid>();
        for (var i = 0; i < 5; i++)
        {
            var error = await generator.CreateAsync(DateTimeOffset.UtcNow.AddMinutes(-i * 10), CancellationToken);
            ids.Add(error.Id);
        }

        // ids[0] is newest (offset 0), ids[4] is oldest (offset -40).
        var removed = await repository.TrimToNewestAsync(2, CancellationToken);

        removed.Should().Be(3);
        var remaining = await repository.GetAllAsync(CancellationToken);
        remaining.Select(e => e.Id).Should().BeEquivalentTo([ids[0], ids[1]]);
    }

    [TestMethod]
    public async Task TrimToNewest_WhenFewerThanMax_RemovesNothing()
    {
        var services = GetServices();
        var generator = services.GetRequiredService<IApplicationErrorGenerator>();
        var repository = services.GetRequiredService<IApplicationErrorRepository>();

        await generator.CreateAsync(DateTimeOffset.UtcNow.AddMinutes(-1), CancellationToken);

        var removed = await repository.TrimToNewestAsync(10, CancellationToken);

        removed.Should().Be(0);
        (await repository.CountAsync(CancellationToken)).Should().Be(1);
    }
}
