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
            builder.Register(_ => NullLogger<NotificationService>.Instance)
                .As<ILogger<NotificationService>>()
                .SingleInstance();
        });

        var service = services.GetRequiredService<INotificationService>();
        var request = new NotificationRequest(
            NotificationKind.Anomaly, NotificationSeverity.Warning, "title", "message", ProjectId: null);

        await service.NotifyAsync(request, CancellationToken);

        // The bad channel throwing must not stop the good channel from being delivered to.
        await good.Received(1).DeliverAsync(request, CancellationToken);
        await bad.Received(1).DeliverAsync(request, CancellationToken);
    }
}
