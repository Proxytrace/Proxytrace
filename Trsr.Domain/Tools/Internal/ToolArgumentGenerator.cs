using System.Text.Json;
using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Tools.Internal;

internal class ToolArgumentGenerator : DomainObjectGenerator<IToolArgument>
{
    public ToolArgumentGenerator(IRandom random) : base(random)
    {
    }

    public override Task<IToolArgument> CreateAsync(CancellationToken cancellationToken = default)
    {
        var schema = JsonSerializer.SerializeToElement(new
        {
            type = "string",
            description = Random.String()
        });
        return ((IToolArgument)new JsonToolArgument(
                name: Random.String(),
                isRequired: Random.Bool(),
                json: schema))
            .ToTaskResult();
    }
}
