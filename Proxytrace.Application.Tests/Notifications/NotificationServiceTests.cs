using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Application.Notifications;
using Proxytrace.Application.Notifications.Internal;
using Proxytrace.Domain.Notification;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Notifications;

[TestClass]
public sealed class NotificationServiceTests : BaseTest<Module>
{
    [TestMethod]
    public async Task NotifyAsync_DeliversToEveryChannel_EvenWhenOneThrows()
    {
        var good = Substitute.For<INotificationChannel>();
        good.Name.Returns("Good");

        var bad = Substitute.For<INotificationChannel>();
        bad.Name.Returns("Bad");
        bad.DeliverAsync(Arg.Any<NotificationRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("boom")));

        IServiceProvider services = GetServices(builder =>
        {
            builder.RegisterType<NotificationService>().As<INotificationService>().SingleInstance();
            builder.RegisterInstance(good).As<INotificationChannel>();
            builder.RegisterInstance(bad).As<INotificationChannel>();
            builder.RegisterInstance(Substitute.For<INotificationRepository>()).As<INotificationRepository>();
            builder.Register(_ => NullLogger<NotificationService>.Instance)
                .As<ILogger<NotificationService>>()
                .SingleInstance();
        });

        var service = services.GetRequiredService<INotificationService>();
        // Null target → dedup is skipped, both channels are invoked.
        var request = new NotificationRequest(
            NotificationKind.Anomaly, NotificationSeverity.Warning, "title", "message", ProjectId: null);

        await service.NotifyAsync(request, CancellationToken);

        // The bad channel throwing must not stop the good channel from being delivered to.
        await good.Received(1).DeliverAsync(request, CancellationToken);
        await bad.Received(1).DeliverAsync(request, CancellationToken);
    }

    [TestMethod]
    public async Task NotifyAsync_WhenActiveDuplicateExistsForTarget_SkipsAllChannels()
    {
        var channel = Substitute.For<INotificationChannel>();
        channel.Name.Returns("Any");

        var repo = Substitute.For<INotificationRepository>();
        var targetId = Guid.NewGuid();
        repo.FindActiveByTargetAsync(NotificationTargetKind.TestRunGroup, targetId, Arg.Any<CancellationToken>())
            .Returns(Substitute.For<INotification>());

        IServiceProvider services = GetServices(builder =>
        {
            builder.RegisterType<NotificationService>().As<INotificationService>().SingleInstance();
            builder.RegisterInstance(channel).As<INotificationChannel>();
            builder.RegisterInstance(repo).As<INotificationRepository>();
            builder.Register(_ => NullLogger<NotificationService>.Instance).As<ILogger<NotificationService>>().SingleInstance();
        });

        var request = new NotificationRequest(
            NotificationKind.Anomaly, NotificationSeverity.Warning, "t", "m", ProjectId: null,
            TargetKind: NotificationTargetKind.TestRunGroup, TargetId: targetId);

        await services.GetRequiredService<INotificationService>().NotifyAsync(request, CancellationToken);

        await channel.DidNotReceive().DeliverAsync(Arg.Any<NotificationRequest>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task NotifyAsync_WhenNoActiveDuplicate_DeliversToChannels()
    {
        var channel = Substitute.For<INotificationChannel>();
        channel.Name.Returns("Any");
        var repo = Substitute.For<INotificationRepository>();
        // NSubstitute returns a non-null substitute for interface returns by default; configure
        // explicitly so FindActiveByTargetAsync signals "no existing active notification".
        repo.FindActiveByTargetAsync(NotificationTargetKind.Agent, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((INotification?)null);

        IServiceProvider services = GetServices(builder =>
        {
            builder.RegisterType<NotificationService>().As<INotificationService>().SingleInstance();
            builder.RegisterInstance(channel).As<INotificationChannel>();
            builder.RegisterInstance(repo).As<INotificationRepository>();
            builder.Register(_ => NullLogger<NotificationService>.Instance).As<ILogger<NotificationService>>().SingleInstance();
        });

        var request = new NotificationRequest(
            NotificationKind.Anomaly, NotificationSeverity.Warning, "t", "m", ProjectId: null,
            TargetKind: NotificationTargetKind.Agent, TargetId: Guid.NewGuid());

        await services.GetRequiredService<INotificationService>().NotifyAsync(request, CancellationToken);

        await channel.Received(1).DeliverAsync(request, CancellationToken);
    }
}
