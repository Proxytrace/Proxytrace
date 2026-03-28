using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Message.Internal;

internal class AssistantMessageGenerator : DomainObjectGenerator<AssistantMessage>
{
    private readonly IDomainObjectGenerator<Content> contentGenerator;

    public AssistantMessageGenerator(
        IDomainObjectGenerator<Content> contentGenerator,
        IRandom random) : base(random)
    {
        this.contentGenerator = contentGenerator;
    }

    public override async Task<AssistantMessage> CreateAsync(CancellationToken cancellationToken = default)
    {
        var content = await contentGenerator.CreateAsync(cancellationToken);
        return new AssistantMessage([content], []);
    }
}
