using Proxytrace.Common.Async;
using Proxytrace.Common.Random;
using Proxytrace.Domain.Internal;

namespace Proxytrace.Domain.Tools.Internal;

internal class ToolArgumentsGenerator : DomainObjectGenerator<ToolArguments>
{
    public ToolArgumentsGenerator(IRandom random) : base(random)
    {
    }

    public override Task<ToolArguments> CreateAsync(CancellationToken cancellationToken = default)
        => ToolArguments.None.ToTaskResult();
}
