using System.Text.Json;
using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Message.Internal;

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
            description = random.String()
        });
        return ((IToolArgument)new JsonToolArgument(
                name: random.String(),
                isRequired: random.Bool(),
                json: schema))
            .ToTaskResult();
    }
}
