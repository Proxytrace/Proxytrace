using Proxytrace.Common.Random;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;

namespace Proxytrace.Domain.ApiKey.Internal;

internal class ApiKeyGenerator : DomainEntityGenerator<IApiKey>
{
    private readonly IApiKey.CreateNew factory;
    private readonly IDomainEntityGenerator<IProject> projectGenerator;
    private readonly IDomainEntityGenerator<IModelProvider> providerGenerator;

    public ApiKeyGenerator(
        IApiKey.CreateNew factory,
        IRepository<IApiKey> repository,
        IDomainEntityGenerator<IProject> projectGenerator,
        IDomainEntityGenerator<IModelProvider> providerGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.projectGenerator = projectGenerator;
        this.providerGenerator = providerGenerator;
    }

    public override async Task<IApiKey> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var project = await projectGenerator.GetOrCreateAsync(cancellationToken);
        var provider = await providerGenerator.GetOrCreateAsync(cancellationToken);
        return factory(
            name: random.String(),
            apiKey: $"proxytrace-{random.UniqueString()}",
            project: project,
            provider: provider,
            expiresAt: null);
    }
}
