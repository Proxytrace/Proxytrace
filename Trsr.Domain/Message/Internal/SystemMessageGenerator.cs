using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Message.Internal;

internal class SystemMessageGenerator : DomainObjectGenerator<SystemMessage>
{
    public SystemMessageGenerator(IRandom random) : base(random)
    {
    }

    public override Task<SystemMessage> CreateAsync(CancellationToken cancellationToken = default)
        => new SystemMessage(random.String()).ToTaskResult();
}
