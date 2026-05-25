using Proxytrace.Common.Async;
using Proxytrace.Common.Random;
using Proxytrace.Domain.Internal;

namespace Proxytrace.Domain.Message.Internal;

internal class ToolRequestGenerator : DomainObjectGenerator<ToolRequest>
{
    public ToolRequestGenerator(IRandom random) : base(random)
    {
    }

    public override Task<ToolRequest> CreateAsync(CancellationToken cancellationToken = default)
        => new ToolRequest(
                id: random.Guid().ToString(),
                name: random.String(),
                arguments: "{}")
            .ToTaskResult();
}
