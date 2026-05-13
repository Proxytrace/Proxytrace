using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Controllers;
using Trsr.Api.Dto.ApiKeys;
using Trsr.Api.Dto.ModelProviders;
using Trsr.Domain;
using Trsr.Domain.ApiKey;
using Trsr.Domain.Model;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class ModelProvidersControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Create_PersistsProvider()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Create(
            new CreateModelProviderRequest("Acme", "https://api.acme.test/", "sk-test", ModelProviderKind.OpenAiCompatible),
            CancellationToken);

        var created = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException());
        var dto = (ModelProviderDto)created.Value!;
        dto.Name.Should().Be("Acme");
        dto.Kind.Should().Be(ModelProviderKind.OpenAiCompatible);
    }

    [TestMethod]
    public async Task Get_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Get(Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Update_Existing_PersistsChange()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var provider = await services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>().CreateAsync(CancellationToken);

        var result = await controller.Update(
            provider.Id,
            new UpdateModelProviderRequest("Renamed", provider.Endpoint.ToString(), provider.ApiKey, provider.Kind),
            CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value!.Name.Should().Be("Renamed");
    }

    [TestMethod]
    public async Task Update_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Update(
            Guid.NewGuid(),
            new UpdateModelProviderRequest("X", "https://x.test/", "k", ModelProviderKind.OpenAi),
            CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Delete_Existing_ReturnsNoContent()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var provider = await services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>().CreateAsync(CancellationToken);

        var result = await controller.Delete(provider.Id, CancellationToken);

        result.Should().BeOfType<NoContentResult>();
    }

    [TestMethod]
    public async Task CreateModel_DuplicateModelName_ReturnsConflict()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().CreateAsync(CancellationToken);

        var result = await controller.CreateModel(
            endpoint.Provider.Id,
            new CreateModelEndpointRequest(endpoint.Model.Name, 0.001m, 0.002m),
            CancellationToken);

        result.Result.Should().BeOfType<ConflictObjectResult>();
    }

    [TestMethod]
    public async Task CreateModel_UnknownProvider_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.CreateModel(
            Guid.NewGuid(),
            new CreateModelEndpointRequest("gpt-4o-mini", 0.001m, 0.002m),
            CancellationToken);

        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [TestMethod]
    public async Task UpdateModelPricing_PersistsNewCosts()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().CreateAsync(CancellationToken);

        var result = await controller.UpdateModelPricing(
            endpoint.Provider.Id,
            endpoint.Id,
            new UpdateModelEndpointPricingRequest(9.99m, 19.99m),
            CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value!.InputTokenCost.Should().Be(9.99m);
        result.Value.OutputTokenCost.Should().Be(19.99m);
    }

    [TestMethod]
    public async Task DeleteModel_Existing_ReturnsNoContent()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().CreateAsync(CancellationToken);

        var result = await controller.DeleteModel(endpoint.Id, CancellationToken);

        result.Should().BeOfType<NoContentResult>();
    }

    [TestMethod]
    public async Task CreateKey_UnknownProject_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var provider = await services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>().CreateAsync(CancellationToken);

        var result = await controller.CreateKey(
            provider.Id,
            new CreateApiKeyRequest("k", Guid.NewGuid()),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task CreateKey_PersistsKey()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);
        var provider = await services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>().CreateAsync(CancellationToken);

        var result = await controller.CreateKey(
            provider.Id,
            new CreateApiKeyRequest("dev-key", project.Id),
            CancellationToken);

        var created = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException());
        var dto = (ApiKeyDto)created.Value!;
        dto.Name.Should().Be("dev-key");
        dto.ProjectId.Should().Be(project.Id);
    }

    [TestMethod]
    public async Task DeleteKey_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var provider = await services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>().CreateAsync(CancellationToken);

        var result = await controller.DeleteKey(provider.Id, Guid.NewGuid(), CancellationToken);

        result.Should().BeOfType<NotFoundResult>();
    }

    private static ModelProvidersController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<IRepository<IModelProvider>>(),
        services.GetRequiredService<IApiKeyRepository>(),
        services.GetRequiredService<IProjectRepository>(),
        services.GetRequiredService<IModelEndpointRepository>(),
        services.GetRequiredService<IModelProvider.CreateNew>(),
        services.GetRequiredService<IModelProvider.CreateExisting>(),
        services.GetRequiredService<IApiKey.CreateNew>(),
        services.GetRequiredService<IModelRepository>(),
        services.GetRequiredService<IModelEndpoint.CreateNew>(),
        services.GetRequiredService<IModelEndpoint.CreateExisting>());
}
