using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Message.Internal;

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
