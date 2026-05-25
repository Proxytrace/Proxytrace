using Proxytrace.Common.Async;
using Proxytrace.Common.Random;
using Proxytrace.Domain.Internal;

namespace Proxytrace.Domain.Message.Internal;

internal class SystemMessageGenerator : DomainObjectGenerator<SystemMessage>
{
    public SystemMessageGenerator(IRandom random) : base(random)
    {
    }

    public override Task<SystemMessage> CreateAsync(CancellationToken cancellationToken = default)
        => new SystemMessage(random.String()).ToTaskResult();
}
