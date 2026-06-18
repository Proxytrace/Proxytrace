using Proxytrace.Common.Random;
using Proxytrace.Domain.Internal;

namespace Proxytrace.Domain.Notification.Internal;

internal class NotificationGenerator : DomainEntityGenerator<INotification>
{
    private readonly INotification.CreateNew factory;
    private readonly IRandom random;

    public NotificationGenerator(
        INotification.CreateNew factory,
        IRepository<INotification> repository,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.random = random;
    }

    public override Task<INotification> GenerateAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(factory(
            kind: random.Enum<NotificationKind>(),
            severity: random.Enum<NotificationSeverity>(),
            title: random.String(),
            message: random.String(),
            projectId: null,
            targetKind: null,
            targetId: null));
}
