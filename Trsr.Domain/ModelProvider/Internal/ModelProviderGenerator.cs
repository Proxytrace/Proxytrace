using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.ModelProvider.Internal;

internal class ModelProviderGenerator : DomainEntityGenerator<IModelProvider>
{
    private static readonly IReadOnlyCollection<string> ProviderNames =
    [
        "Anthropic",
        "OpenAI",
        "Google",
        "Azure",
        "Mistral",
    ];

    private readonly IModelProvider.CreateNew factory;

    public ModelProviderGenerator(
        IModelProvider.CreateNew factory,
        IRepository<IModelProvider> repository,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
    }

    public override Task<IModelProvider> GenerateAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(factory(
            name: $"{Random.Any(ProviderNames)}-{Random.UniqueString()}",
            endpoint: new Uri($"https://api.{Random.Int(1, int.MaxValue)}.example.com/v1"),
            apiKey: Random.String(),
            kind: ModelProviderKind.OpenAiCompatible));
}
