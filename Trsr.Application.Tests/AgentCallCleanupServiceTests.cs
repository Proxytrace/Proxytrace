using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Trsr.Application.Cleanup;
using Trsr.Application.Cleanup.Internal;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Testing;

namespace Trsr.Application.Tests;

[TestClass]
public sealed class AgentCallCleanupServiceTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CleanOnce_2DaysRetention_RemovesEntriesOlderThan2Days()
    {
        const int retentionDurationDays = 2;
        var retentionDuration = TimeSpan.FromDays(retentionDurationDays);

        var agentCallRepository = Substitute.For<IAgentCallRepository>();
        var services = GetServices(builder =>
        {
            builder.RegisterInstance(agentCallRepository).As<IAgentCallRepository>();

            builder.RegisterInstance(new AgentCallCleanupConfiguration
            {
                CleanupIntervalHours = 1,
                RetentionDurationDays = retentionDurationDays,
            });
        });

        var service = services.GetRequiredService<AgentCallCleanupService>();
        await service.CleanOnceAsync(CancellationToken);

        await agentCallRepository.Received(1)
            .RemoveOlderThanAsync(
                Arg.Is<DateTimeOffset>(x => DateTimeOffset.UtcNow - retentionDuration - x < TimeSpan.FromSeconds(10)),
                Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public void CleanOnce_NegativeRetentionPeriod_Throws()
    {
        const int retentionDurationDays = -1;
        var services = GetServices(builder =>
        {
            builder.RegisterInstance(new AgentCallCleanupConfiguration
            {
                CleanupIntervalHours = 1,
                RetentionDurationDays = retentionDurationDays,
            });
        });

        FluentActions.Invoking(services.GetRequiredService<AgentCallCleanupService>)
            .Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CleanOnce_ValidRetentionPeriod_RemovesEntriesOlderThan()
    {
        const int callGenerated = 10;
        const int retentionDurationDays = callGenerated + 1;
        var services = GetServices(builder =>
        {
            builder.RegisterInstance(new AgentCallCleanupConfiguration
            {
                CleanupIntervalHours = 1,
                RetentionDurationDays = retentionDurationDays,
            });
        });
        var generator = services.GetRequiredService<IAgentCallGenerator>();
        var repository = services.GetRequiredService<IRepository<IAgentCall>>();
        var service = services.GetRequiredService<AgentCallCleanupService>();

        HashSet<Guid> expectedDeleted = [];
        for (var i = 0; i < callGenerated; i++)
        {
            var call1 = await generator.CreateAsync(
                DateTimeOffset.UtcNow - TimeSpan.FromDays(retentionDurationDays + i + 1), CancellationToken);
            expectedDeleted.Add(call1.Id);

            await generator.CreateAsync(DateTimeOffset.UtcNow - TimeSpan.FromDays(i + 1), CancellationToken);
        }

        var allBeforeDelete = await repository.GetAllAsync(CancellationToken);
        allBeforeDelete.Should().HaveCount(callGenerated * 2);

        await service.CleanOnceAsync(CancellationToken);

        var allAfterDelete = await repository.GetAllAsync(CancellationToken);
        allAfterDelete.Should().HaveCount(callGenerated);

        allAfterDelete.Should().AllSatisfy(x => expectedDeleted.Should().NotContain(x.Id));
    }

    [TestMethod]
    public async Task CleanOnce_DeleteThrows_Exception()
    {
        const int retentionDurationDays = 1;
        var agentCallRepository = Substitute.For<IAgentCallRepository>();
        var services = GetServices(builder =>
        {
            builder.RegisterInstance(agentCallRepository).As<IAgentCallRepository>();

            builder.RegisterInstance(new AgentCallCleanupConfiguration
            {
                CleanupIntervalHours = 1,
                RetentionDurationDays = retentionDurationDays,
            });
        });

        var service = services.GetRequiredService<AgentCallCleanupService>();
        agentCallRepository.When(x => x.RemoveOlderThanAsync(Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()))
            .Throws(new Exception());

        await FluentActions.Invoking(() => service.CleanOnceAsync(CancellationToken)).Should().NotThrowAsync();
    }
}