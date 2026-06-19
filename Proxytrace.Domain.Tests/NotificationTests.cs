using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class NotificationTests : DomainTest<Module>
{
    [TestMethod]
    public async Task CreateNew_StartsUnread()
    {
        IServiceProvider services = GetServices();
        var notification = await CreateAsync(services);

        notification.Status.Should().Be(NotificationStatus.Unread);
        notification.Id.Should().NotBe(Guid.Empty);
    }

    [TestMethod]
    public async Task MarkRead_FromUnread_TransitionsAndPersists()
    {
        IServiceProvider services = GetServices();
        var notification = await CreateAsync(services);

        var read = await notification.MarkRead(CancellationToken);

        read.Status.Should().Be(NotificationStatus.Read);
        var reloaded = await Reload(services, read.Id);
        reloaded.Status.Should().Be(NotificationStatus.Read);
    }

    [TestMethod]
    public async Task MarkRead_WhenAlreadyRead_IsIdempotent()
    {
        IServiceProvider services = GetServices();
        var notification = await CreateAsync(services);
        var read = await notification.MarkRead(CancellationToken);

        var again = await read.MarkRead(CancellationToken);

        again.Status.Should().Be(NotificationStatus.Read);
    }

    [TestMethod]
    public async Task Dismiss_FromUnread_TransitionsAndPersists()
    {
        IServiceProvider services = GetServices();
        var notification = await CreateAsync(services);

        var dismissed = await notification.Dismiss(CancellationToken);

        dismissed.Status.Should().Be(NotificationStatus.Dismissed);
        var reloaded = await Reload(services, dismissed.Id);
        reloaded.Status.Should().Be(NotificationStatus.Dismissed);
    }

    [TestMethod]
    public async Task MarkRead_AfterDismiss_Throws()
    {
        IServiceProvider services = GetServices();
        var notification = await CreateAsync(services);
        var dismissed = await notification.Dismiss(CancellationToken);

        await FluentActions
            .Invoking(() => dismissed.MarkRead(CancellationToken))
            .Should().ThrowAsync<InvalidOperationException>();
    }

    [TestMethod]
    public void CreateNew_WithBlankTitle_Throws()
    {
        IServiceProvider services = GetServices();
        var createNew = services.GetRequiredService<INotification.CreateNew>();

        var action = () => createNew(
            NotificationKind.Anomaly, NotificationSeverity.Warning, "  ", "message",
            projectId: null, targetKind: null, targetId: null);

        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithHalfSpecifiedTarget_Throws()
    {
        IServiceProvider services = GetServices();
        var createNew = services.GetRequiredService<INotification.CreateNew>();

        var action = () => createNew(
            NotificationKind.Anomaly, NotificationSeverity.Critical, "title", "message",
            projectId: null, targetKind: NotificationTargetKind.TestRunGroup, targetId: null);

        action.Should().Throw<Exception>();
    }

    private async Task<INotification> CreateAsync(IServiceProvider services)
        => await services
            .GetRequiredService<IDomainEntityGenerator<INotification>>()
            .CreateAsync(CancellationToken);

    private async Task<INotification> Reload(IServiceProvider services, Guid id)
        => await services
            .GetRequiredService<IRepository<INotification>>()
            .GetAsync(id, CancellationToken);
}
