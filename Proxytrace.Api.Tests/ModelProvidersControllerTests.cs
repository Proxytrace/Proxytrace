using Autofac;
using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.ApiKeys;
using Proxytrace.Api.Dto.ModelProviders;
using Proxytrace.Domain;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class ModelProvidersControllerTests : BaseTest<Module>
{
    protected override void ConfigureContainer(ContainerBuilder builder)
    {
        base.ConfigureContainer(builder);
        // Stub IPricingService for all tests; individual tests override with RegisterInstance when
        // they need to assert on calls or control returned prices.
        builder.RegisterStub<IPricingService>(stub =>
            stub.ResolveAsync(
                    Arg.Any<IModelProvider>(),
                    Arg.Any<DiscoveredModel>(),
                    Arg.Any<AzureDeploymentType>(),
                    Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(ModelPrice.Unknown)));
    }

    [TestMethod]
    public async Task Create_PersistsProvider()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Create(
            new CreateModelProviderRequest("Acme", "https://api.acme.test/", "sk-test", ModelProviderKind.OpenAiCompatible),
            CancellationToken);

        var created = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException());
        var dto = (ModelProviderDto?)created.Value;
        dto.Should().NotBeNull();
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
        result.Value.Name.Should().Be("Renamed");
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
        result.Value.InputTokenCost.Should().Be(9.99m);
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
        var dto = (ApiKeyDto?)created.Value;
        dto.Should().NotBeNull();
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

    [TestMethod]
    public async Task Create_DiscoveredModel_CreatesEndpointWithPrices()
    {
        var providerClient = Substitute.For<IProviderClient>();
        providerClient.DiscoverModelsAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<DiscoveredModel>>(
                [new DiscoveredModel("gpt-4o", "gpt-4o")]));

        var pricingService = Substitute.For<IPricingService>();
        pricingService.ResolveAsync(
                Arg.Any<IModelProvider>(),
                Arg.Any<DiscoveredModel>(),
                Arg.Any<AzureDeploymentType>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new ModelPrice(2.5m, 10.0m)));

        IServiceProvider services = GetServices(builder =>
        {
            builder.RegisterInstance<IProviderClient.Factory>(_ => providerClient);
            builder.RegisterInstance(pricingService).As<IPricingService>();
        });

        var controller = ResolveController(services);

        await controller.Create(
            new CreateModelProviderRequest("Acme", "https://api.acme.test/", "sk-test", ModelProviderKind.OpenAiCompatible),
            CancellationToken);

        var endpointRepo = services.GetRequiredService<IModelEndpointRepository>();
        var all = await endpointRepo.GetAllAsync(CancellationToken);
        var endpoint = all.Should().ContainSingle().Subject;
        endpoint.Model.Name.Should().Be("gpt-4o");
        endpoint.InputTokenCost.Should().Be(2.5m);
        endpoint.OutputTokenCost.Should().Be(10.0m);
    }

    [TestMethod]
    public async Task Reload_NoDuplicates_WhenModelAlreadyExists()
    {
        var providerClient = Substitute.For<IProviderClient>();
        providerClient.DiscoverModelsAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<DiscoveredModel>>(
                [new DiscoveredModel("gpt-4o", "gpt-4o")]));

        var pricingService = Substitute.For<IPricingService>();
        pricingService.ResolveAsync(
                Arg.Any<IModelProvider>(),
                Arg.Any<DiscoveredModel>(),
                Arg.Any<AzureDeploymentType>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new ModelPrice(2.5m, 10.0m)));

        IServiceProvider services = GetServices(builder =>
        {
            builder.RegisterInstance<IProviderClient.Factory>(_ => providerClient);
            builder.RegisterInstance(pricingService).As<IPricingService>();
        });

        var controller = ResolveController(services);

        // First: create the provider (which auto-populates models)
        var createResult = await controller.Create(
            new CreateModelProviderRequest("Acme", "https://api.acme.test/", "sk-test", ModelProviderKind.OpenAiCompatible),
            CancellationToken);
        var createdDto = (ModelProviderDto?)((CreatedAtActionResult)(createResult.Result ?? throw new InvalidOperationException())).Value;
        createdDto.Should().NotBeNull();
        var providerId = createdDto.Id;

        // Second: reload — same model discovered again
        var reloadResult = await controller.Reload(providerId, AzureDeploymentType.GlobalStandard, CancellationToken);

        var endpoints = (IReadOnlyList<ModelEndpointDto>?)reloadResult.Value;
        endpoints.Should().ContainSingle(e => e.ModelName == "gpt-4o");

        var endpointRepo = services.GetRequiredService<IModelEndpointRepository>();
        var allEndpoints = await endpointRepo.GetAllAsync(CancellationToken);
        allEndpoints.Where(e => e.Provider.Id == providerId).Should().ContainSingle();
    }

    [TestMethod]
    public async Task Reload_PassesDeploymentTypeToPricingService()
    {
        var providerClient = Substitute.For<IProviderClient>();
        providerClient.DiscoverModelsAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<DiscoveredModel>>(
                [new DiscoveredModel("gpt-4o", "gpt-4o")]));

        var pricingService = Substitute.For<IPricingService>();
        pricingService.ResolveAsync(
                Arg.Any<IModelProvider>(),
                Arg.Any<DiscoveredModel>(),
                Arg.Any<AzureDeploymentType>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(ModelPrice.Unknown));

        IServiceProvider services = GetServices(builder =>
        {
            builder.RegisterInstance<IProviderClient.Factory>(_ => providerClient);
            builder.RegisterInstance(pricingService).As<IPricingService>();
        });

        var controller = ResolveController(services);

        var provider = await services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>().CreateAsync(CancellationToken);

        await controller.Reload(provider.Id, AzureDeploymentType.DataZoneStandard, CancellationToken);

        await pricingService.Received(1).ResolveAsync(
            Arg.Any<IModelProvider>(),
            Arg.Any<DiscoveredModel>(),
            AzureDeploymentType.DataZoneStandard,
            Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Reload_UnknownProvider_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Reload(Guid.NewGuid(), AzureDeploymentType.GlobalStandard, CancellationToken);

        result.Result.Should().BeOfType<NotFoundObjectResult>();
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
        services.GetRequiredService<IModelEndpoint.CreateExisting>(),
        services.GetRequiredService<ModelProviderDtoMapper>(),
        services.GetRequiredService<IPricingService>());
}
