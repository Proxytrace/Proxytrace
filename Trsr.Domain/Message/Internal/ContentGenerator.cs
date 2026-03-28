using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Message.Internal;

internal class ContentGenerator : DomainObjectGenerator<Content>
{
    public ContentGenerator(IRandom random) : base(random)
    {
    }

    public override Task<Content> CreateAsync(CancellationToken cancellationToken = default)
        => Content.FromText(random.String()).ToTaskResult();
}
