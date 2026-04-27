using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.Organization;

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
    private readonly IDomainEntityGenerator<IOrganization> organizationGenerator;

    public ModelProviderGenerator(
        IModelProvider.CreateNew factory,
        IRepository<IModelProvider> repository,
        IDomainEntityGenerator<IOrganization> organizationGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.organizationGenerator = organizationGenerator;
    }

    public override async Task<IModelProvider> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var organization = await organizationGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            name: $"{random.Any(ProviderNames)}-{random.UniqueString()}",
            endpoint: new Uri($"https://api.{random.Int(1, int.MaxValue)}.example.com/v1"),
            apiKey: random.String(),
            organization: organization);
    }
}
