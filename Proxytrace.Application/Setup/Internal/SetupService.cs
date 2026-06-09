using Proxytrace.Application.Auth;
using Proxytrace.Application.Auth.Local;
using Proxytrace.Domain;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;
using Proxytrace.Licensing;

namespace Proxytrace.Application.Setup.Internal;

internal class SetupService : ISetupService
{
    private readonly IRepository<IModelProvider> providers;
    private readonly IModelRepository models;
    private readonly IModelEndpointRepository endpoints;
    private readonly IProjectRepository projects;
    private readonly IApiKeyRepository apiKeys;
    private readonly IUserRepository users;
    private readonly ICurrentUserAccessor currentUser;
    private readonly IModelProvider.CreateNew createProvider;
    private readonly IModelEndpoint.CreateNew createEndpoint;
    private readonly IProject.CreateNew createProject;
    private readonly IApiKey.CreateNew createApiKey;
    private readonly IUser.CreateNew createUser;
    private readonly IPasswordService passwords;
    private readonly ILocalTokenIssuer tokens;
    private readonly ITransaction transaction;
    private readonly ILicenseService license;

    public SetupService(
        IRepository<IModelProvider> providers,
        IModelRepository models,
        IModelEndpointRepository endpoints,
        IProjectRepository projects,
        IApiKeyRepository apiKeys,
        IUserRepository users,
        ICurrentUserAccessor currentUser,
        IModelProvider.CreateNew createProvider,
        IModelEndpoint.CreateNew createEndpoint,
        IProject.CreateNew createProject,
        IApiKey.CreateNew createApiKey,
        IUser.CreateNew createUser,
        IPasswordService passwords,
        ILocalTokenIssuer tokens,
        ITransaction transaction,
        ILicenseService license)
    {
        this.providers = providers;
        this.models = models;
        this.endpoints = endpoints;
        this.projects = projects;
        this.apiKeys = apiKeys;
        this.users = users;
        this.currentUser = currentUser;
        this.createProvider = createProvider;
        this.createEndpoint = createEndpoint;
        this.createProject = createProject;
        this.createApiKey = createApiKey;
        this.createUser = createUser;
        this.passwords = passwords;
        this.tokens = tokens;
        this.transaction = transaction;
        this.license = license;
    }

    public async Task<bool> AnyUsersExistAsync(CancellationToken cancellationToken = default)
        => await users.CountAsync(cancellationToken) > 0;

    public async Task<FirstAdminResult> CreateFirstAdminAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        if (await AnyUsersExistAsync(cancellationToken))
            throw new InvalidOperationException("Setup already completed: users exist.");

        var draft = createUser(email, externalSubject: null, passwordHash: "placeholder", role: UserRole.Admin);
        var hash = passwords.Hash(draft, password);
        var withHash = createUser(email, externalSubject: null, passwordHash: hash, role: UserRole.Admin);
        var saved = await withHash.AddAsync(cancellationToken);
        var issued = tokens.Issue(saved);
        return new FirstAdminResult(saved.Id, issued.Token, issued.ExpiresAt);
    }

    public Task<SetupResult> CompleteAsync(SetupInput input, CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            var projectCount = await projects.CountAsync(cancellationToken);
            if (projectCount > 0)
                throw new InvalidOperationException("Setup has already been completed.");

            license.Ensure(LicenseLimit.MaxProjects, projectCount);

            var user = await currentUser.GetCurrentUserAsync(cancellationToken)
                ?? throw new InvalidOperationException("Setup requires an authenticated user.");

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

            var keyValue = $"proxytrace-{Guid.NewGuid():N}";
            var apiKey = await apiKeys.AddAsync(
                createApiKey(input.ApiKeyName, keyValue, project, provider),
                cancellationToken);

            return new SetupResult(provider.Id, endpoint.Id, project.Id, apiKey.ApiKey);
        });

    public Task<bool> TestProviderConnectionAsync(ProviderConnectionInput input, CancellationToken cancellationToken = default)
        => CreateProvider(input)
            .CreateClient()
            .VerifyConnectionAsync(cancellationToken);

    public async Task<IReadOnlyList<string>> ListProviderModelsAsync(ProviderConnectionInput input, CancellationToken cancellationToken = default)
    {
        IModelProvider provider = CreateProvider(input);
        var client = provider.CreateClient();
        var availableModels = await client.GetModelsAsync(cancellationToken);
        return availableModels.Select(m => m.Model.Name).ToArray();
    }

    private IModelProvider CreateProvider(ProviderConnectionInput input)
        => createProvider(
            name: input.ProviderName,
            endpoint: input.ProviderEndpoint,
            apiKey: input.ProviderUpstreamApiKey,
            kind: input.ProviderKind);
}
