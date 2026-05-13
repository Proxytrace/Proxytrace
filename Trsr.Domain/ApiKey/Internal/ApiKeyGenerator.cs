using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;

namespace Trsr.Domain.ApiKey.Internal;

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
            apiKey: $"trsr-{random.UniqueString()}",
            project: project,
            provider: provider);
    }
}
