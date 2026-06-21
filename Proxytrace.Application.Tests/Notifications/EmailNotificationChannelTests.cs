using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Application.Notifications;
using Proxytrace.Application.Notifications.Internal;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Notification;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Notifications;

[TestClass]
public sealed class EmailNotificationChannelTests : BaseTest<Module>
{
    [TestMethod]
    public async Task DeliverAsync_WhenDisabled_DoesNotSend()
    {
        var sender = Substitute.For<IEmailSender>();
        IServiceProvider services = Build(sender, Settings() with { Enabled = false });
        var channel = services.GetRequiredService<EmailNotificationChannel>();

        await channel.DeliverAsync(GlobalRequest(NotificationSeverity.Critical), CancellationToken);

        await sender.DidNotReceive().SendAsync(Arg.Any<EmailMessage>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task DeliverAsync_BelowOperatorFloor_DoesNotSend()
    {
        var sender = Substitute.For<IEmailSender>();
        IServiceProvider services = Build(sender, Settings() with { MinSeverity = NotificationSeverity.Critical });
        var channel = services.GetRequiredService<EmailNotificationChannel>();

        await channel.DeliverAsync(GlobalRequest(NotificationSeverity.Warning), CancellationToken);

        await sender.DidNotReceive().SendAsync(Arg.Any<EmailMessage>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task DeliverAsync_GlobalNotification_EmailsOptedInUsersAboveThreshold()
    {
        var sender = Substitute.For<IEmailSender>();
        IServiceProvider services = Build(sender, Settings());
        var create = services.GetRequiredService<IUser.CreateNew>();

        await create("on@example.test", null, "h", UserRole.Member, "en", true, NotificationSeverity.Warning).AddAsync(CancellationToken);
        await create("off@example.test", null, "h", UserRole.Member, "en", false, NotificationSeverity.Warning).AddAsync(CancellationToken);
        await create("high@example.test", null, "h", UserRole.Member, "en", true, NotificationSeverity.Critical).AddAsync(CancellationToken);

        await channelFor(services).DeliverAsync(GlobalRequest(NotificationSeverity.Warning), CancellationToken);

        await sender.Received(1).SendAsync(Arg.Is<EmailMessage>(m => m.To == "on@example.test"), CancellationToken);
        await sender.DidNotReceive().SendAsync(Arg.Is<EmailMessage>(m => m.To == "off@example.test"), Arg.Any<CancellationToken>());
        await sender.DidNotReceive().SendAsync(Arg.Is<EmailMessage>(m => m.To == "high@example.test"), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task DeliverAsync_ProjectNotification_EmailsProjectMembersOnly()
    {
        var sender = Substitute.For<IEmailSender>();
        IServiceProvider services = Build(sender, Settings());
        var create = services.GetRequiredService<IUser.CreateNew>();
        var member = await create("member@example.test", null, "h", UserRole.Member, "en", true, NotificationSeverity.Warning).AddAsync(CancellationToken);
        await create("outsider@example.test", null, "h", UserRole.Member, "en", true, NotificationSeverity.Warning).AddAsync(CancellationToken);

        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
        var project = services.GetRequiredService<IProject.CreateNew>()("P", endpoint, [member]);
        await services.GetRequiredService<IRepository<IProject>>().AddAsync(project, CancellationToken);

        var request = new NotificationRequest(
            NotificationKind.Anomaly, NotificationSeverity.Critical, "t", "m", project.Id);

        await channelFor(services).DeliverAsync(request, CancellationToken);

        await sender.Received(1).SendAsync(Arg.Is<EmailMessage>(m => m.To == "member@example.test"), CancellationToken);
        await sender.DidNotReceive().SendAsync(Arg.Is<EmailMessage>(m => m.To == "outsider@example.test"), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task DeliverAsync_TitleWithHtmlChars_EncodesInHtmlBody()
    {
        var captured = new List<EmailMessage>();
        var sender = Substitute.For<IEmailSender>();
        sender.When(s => s.SendAsync(Arg.Any<EmailMessage>(), Arg.Any<CancellationToken>()))
              .Do(call => captured.Add(call.Arg<EmailMessage>()));

        IServiceProvider services = Build(sender, Settings());
        var create = services.GetRequiredService<IUser.CreateNew>();
        await create("enc@example.test", null, "h", UserRole.Member, "en", true, NotificationSeverity.Warning).AddAsync(CancellationToken);

        var request = new NotificationRequest(
            NotificationKind.Anomaly, NotificationSeverity.Warning, "<b>x</b>", "<script>alert(1)</script>", ProjectId: null);

        await channelFor(services).DeliverAsync(request, CancellationToken);

        var html = captured.Should().ContainSingle().Which.HtmlBody;
        html.Should().Contain("&lt;b&gt;");
        html.Should().NotContain("<b>");
        html.Should().Contain("&lt;script&gt;");
        html.Should().NotContain("<script>");
    }

    private static EmailNotificationChannel channelFor(IServiceProvider services)
        => services.GetRequiredService<EmailNotificationChannel>();

    private IServiceProvider Build(IEmailSender sender, EmailSettings settings)
    {
        var store = Substitute.For<IEmailSettingsStore>();
        store.GetAsync(Arg.Any<CancellationToken>()).Returns(settings);
        return GetServices(builder =>
        {
            builder.RegisterType<EmailNotificationChannel>().AsSelf().SingleInstance();
            builder.RegisterInstance(sender).As<IEmailSender>();
            builder.RegisterInstance(store).As<IEmailSettingsStore>();
            builder.Register(_ => NullLogger<EmailNotificationChannel>.Instance)
                .As<ILogger<EmailNotificationChannel>>().SingleInstance();
        });
    }

    private static NotificationRequest GlobalRequest(NotificationSeverity severity)
        => new(NotificationKind.Anomaly, severity, "title", "message", ProjectId: null);

    private static EmailSettings Settings() => new(
        Enabled: true, SmtpHost: "smtp", SmtpPort: 25, Security: SmtpSecurity.None,
        Username: null, Password: null, FromAddress: "a@b.c", FromName: "PT",
        AppBaseUrl: "https://app.example", MinSeverity: NotificationSeverity.Warning);
}
