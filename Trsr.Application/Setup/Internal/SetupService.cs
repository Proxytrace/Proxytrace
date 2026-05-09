using Trsr.Domain;
using Trsr.Domain.ApiKey;
using Trsr.Domain.Model;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Domain.User;

namespace Trsr.Application.Setup.Internal;

internal class SetupService : ISetupService
{
    private readonly IRepository<IUser> users;
    private readonly IRepository<IModelProvider> providers;
    private readonly IModelRepository models;
    private readonly IModelEndpointRepository endpoints;
    private readonly IProjectRepository projects;
    private readonly IApiKeyRepository apiKeys;
    private readonly IUser.CreateNew createUser;
    private readonly IModelProvider.CreateNew createProvider;
    private readonly IModelEndpoint.CreateNew createEndpoint;
    private readonly IProject.CreateNew createProject;
    private readonly IApiKey.CreateNew createApiKey;
    private readonly ITransaction transaction;

    public SetupService(
        IRepository<IUser> users,
        IRepository<IModelProvider> providers,
        IModelRepository models,
        IModelEndpointRepository endpoints,
        IProjectRepository projects,
        IApiKeyRepository apiKeys,
        IUser.CreateNew createUser,
        IModelProvider.CreateNew createProvider,
        IModelEndpoint.CreateNew createEndpoint,
        IProject.CreateNew createProject,
        IApiKey.CreateNew createApiKey,
        ITransaction transaction)
    {
        this.users = users;
        this.providers = providers;
        this.models = models;
        this.endpoints = endpoints;
        this.projects = projects;
        this.apiKeys = apiKeys;
        this.createUser = createUser;
        this.createProvider = createProvider;
        this.createEndpoint = createEndpoint;
        this.createProject = createProject;
        this.createApiKey = createApiKey;
        this.transaction = transaction;
    }

    public Task<SetupResult> CompleteAsync(SetupInput input, CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            if (await users.CountAsync(cancellationToken) > 0)
                throw new InvalidOperationException("Setup has already been completed.");

            var user = await users.AddAsync(createUser(input.UserName), cancellationToken);

            var provider = await providers.AddAsync(
                createProvider(input.ProviderName, input.ProviderEndpoint, input.ProviderUpstreamApiKey, input.ProviderKind),
                cancellationToken);

            var allModels = await models.GetAllAsync(cancellationToken);
            IModel model = allModels.FirstOrDefault(m => m.Name == input.ModelName)
                ?? await models.GetOrCreateAsync(input.ModelName, cancellationToken);

            var endpoint = await endpoints.AddAsync(
                createEndpoint(model, provider, input.InputTokenCost, input.OutputTokenCost),
                cancellationToken);

            var project = await projects.AddAsync(
                createProject(input.ProjectName, endpoint, [user]),
                cancellationToken);

            var keyValue = $"trsr-{Guid.NewGuid():N}";
            var apiKey = await apiKeys.AddAsync(
                createApiKey(input.ApiKeyName, keyValue, project, provider),
                cancellationToken);

            return new SetupResult(user.Id, provider.Id, endpoint.Id, project.Id, apiKey.ApiKey);
        });
}
