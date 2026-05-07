using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.ApiKey;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Model;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;
using Trsr.Domain.User;
// ReSharper disable InconsistentNaming

namespace Trsr.Application.Demo.Internal;

internal sealed class FoundationSeeder(IServiceProvider services)
{
    private static readonly DateTimeOffset SeedDate = new(2026, 3, 1, 8, 0, 0, TimeSpan.Zero);

    public async Task<FoundationData> SeedAsync(CancellationToken cancellationToken)
    {
        var user = await UpsertUserAsync(new Guid("00000000-0000-0000-0000-000000000002"), "demo-admin", cancellationToken);
        var org = await UpsertOrganizationAsync(new Guid("00000000-0000-0000-0000-000000000001"), "TechShop Demo", [user], cancellationToken);
        var project = await UpsertProjectAsync(new Guid("00000000-0000-0000-0000-000000000003"), "Production AI", org, cancellationToken);
        var evaluator = await UpsertEvaluatorAsync(new Guid("00000000-0000-0000-0000-000000000004"), cancellationToken);

        var openAi = await UpsertModelProviderAsync(new Guid("f0000000-0000-0000-0000-000000000001"), "OpenAI", new Uri("https://api.openai.com/v1"), ModelProviderKind.OpenAi, org, cancellationToken);

        var gpt4o = await UpsertModelAsync(new Guid("f0000000-0000-0000-0000-000000000010"), "gpt-4o", cancellationToken);
        var gpt4oMini = await UpsertModelAsync(new Guid("f0000000-0000-0000-0000-000000000012"), "gpt-4o-mini", cancellationToken);

        var endpointGpt4o = await UpsertModelEndpointAsync(new Guid("f0000000-0000-0000-0000-000000000020"), gpt4o, openAi, 0.0000025m, 0.000010m, cancellationToken);
        var endpointGpt4oMini = await UpsertModelEndpointAsync(new Guid("f0000000-0000-0000-0000-000000000022"), gpt4oMini, openAi, 0.00000015m, 0.0000006m, cancellationToken);

        await UpsertApiKeyAsync(new Guid("a0000000-0000-0000-0000-000000000001"), "Demo OpenAI Key", "trsr-demo-openai", project, openAi, cancellationToken);

        return new FoundationData(project, evaluator, new Dictionary<Guid, IModelEndpoint>
        {
            [endpointGpt4o.Id] = endpointGpt4o,
            [endpointGpt4oMini.Id] = endpointGpt4oMini,
        });
    }

    private static DemoEntityData At(Guid id) => new(id, SeedDate, SeedDate);

    private async Task<IUser> UpsertUserAsync(Guid id, string name, CancellationToken ct)
    {
        var factory = services.GetRequiredService<IUser.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<IUser>>();
        return await repo.UpsertAsync(factory(name, At(id)), ct);
    }

    private async Task<IOrganization> UpsertOrganizationAsync(Guid id, string name, IReadOnlyCollection<IUser> users, CancellationToken ct)
    {
        var factory = services.GetRequiredService<IOrganization.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<IOrganization>>();
        return await repo.UpsertAsync(factory(name, users, At(id)), ct);
    }

    private async Task<IProject> UpsertProjectAsync(Guid id, string name, IOrganization org, CancellationToken ct)
    {
        var factory = services.GetRequiredService<IProject.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<IProject>>();
        return await repo.UpsertAsync(factory(name, org, At(id)), ct);
    }

    private async Task<IEvaluator> UpsertEvaluatorAsync(Guid id, CancellationToken ct)
    {
        var factory = services.GetRequiredService<IExactMatchEvaluator.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<IEvaluator>>();
        return await repo.UpsertAsync(factory(At(id)), ct);
    }

    private async Task<IModelProvider> UpsertModelProviderAsync(Guid id, string name, Uri endpoint, ModelProviderKind kind, IOrganization org, CancellationToken ct)
    {
        var factory = services.GetRequiredService<IModelProvider.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<IModelProvider>>();
        return await repo.UpsertAsync(factory(name, endpoint, "demo-key", kind, org, At(id)), ct);
    }

    private async Task<IModel> UpsertModelAsync(Guid id, string name, CancellationToken ct)
    {
        var factory = services.GetRequiredService<IModel.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<IModel>>();
        return await repo.UpsertAsync(factory(name, At(id)), ct);
    }

    private async Task<IModelEndpoint> UpsertModelEndpointAsync(Guid id, IModel model, IModelProvider provider, decimal inputCost, decimal outputCost, CancellationToken ct)
    {
        var factory = services.GetRequiredService<IModelEndpoint.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<IModelEndpoint>>();
        return await repo.UpsertAsync(factory(model, provider, inputCost, outputCost, At(id)), ct);
    }

    private async Task UpsertApiKeyAsync(Guid id, string name, string key, IProject project, IModelProvider provider, CancellationToken ct)
    {
        var factory = services.GetRequiredService<IApiKey.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<IApiKey>>();
        await repo.UpsertAsync(factory(name, key, project, provider, At(id)), ct);
    }
}

internal sealed record FoundationData(
    IProject Project,
    IEvaluator Evaluator,
    IReadOnlyDictionary<Guid, IModelEndpoint> Endpoints
);
