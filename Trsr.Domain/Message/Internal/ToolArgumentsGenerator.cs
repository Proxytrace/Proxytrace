using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Message.Internal;

internal class ToolArgumentsGenerator : DomainObjectGenerator<ToolArguments>
{
    public ToolArgumentsGenerator(IRandom random) : base(random)
    {
    }

    public override Task<ToolArguments> CreateAsync(CancellationToken cancellationToken = default)
        => ToolArguments.None.ToTaskResult();
}
