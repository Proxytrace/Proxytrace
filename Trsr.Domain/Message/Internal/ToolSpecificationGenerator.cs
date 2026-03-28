using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Message.Internal;

internal class ToolSpecificationGenerator : DomainObjectGenerator<ToolSpecification>
{
    private readonly IDomainObjectGenerator<ToolArguments> toolArgumentsGenerator;

    public ToolSpecificationGenerator(
        IRandom random,
        IDomainObjectGenerator<ToolArguments> toolArgumentsGenerator) : base(random)
    {
        this.toolArgumentsGenerator = toolArgumentsGenerator;
    }

    public override async Task<ToolSpecification> CreateAsync(CancellationToken cancellationToken = default)
    {
        var arguments = await toolArgumentsGenerator.CreateAsync(cancellationToken);
        return new ToolSpecification(
            name: random.String(),
            description: random.String(),
            arguments: arguments);
    }
}
