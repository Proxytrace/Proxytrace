using Proxytrace.Common.Async;
using Proxytrace.Common.Random;
using Proxytrace.Domain.Internal;

namespace Proxytrace.Domain.Message.Internal;

internal class ContentGenerator : DomainObjectGenerator<Content>
{
    public ContentGenerator(IRandom random) : base(random)
    {
    }

    public override Task<Content> CreateAsync(CancellationToken cancellationToken = default)
        => Content.FromText(random.String()).ToTaskResult();
}
