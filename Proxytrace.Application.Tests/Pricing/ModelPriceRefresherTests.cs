using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Application.Pricing;
using Proxytrace.Application.Pricing.Internal;
using Proxytrace.Domain;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Pricing;

[TestClass]
public sealed class ModelPriceRefresherTests : BaseTest<Module>
{
    [TestMethod]
    public async Task RefreshAll_CreatesPricedEndpointsForEveryProvider()
    {
        var client = Substitute.For<IProviderClient>();
        IServiceProvider services = BuildServices(client);

        var generator = services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>();
        var providerA = await generator.CreateAsync(CancellationToken);
        var providerB = await generator.CreateAsync(CancellationToken);
        var model = await services.GetRequiredService<IModelRepository>().GetOrCreateAsync("gpt-4o", CancellationToken);
        client.GetModelsAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<PricedModel>>([new PricedModel(model, new ModelPrice(2.0m, 4.0m))]));

        await services.GetRequiredService<IModelPriceRefresher>().RefreshAllAsync(CancellationToken);

        var endpointRepo = services.GetRequiredService<IModelEndpointRepository>();
        (await endpointRepo.GetByProviderAsync(providerA.Id, CancellationToken))
            .Should().ContainSingle(e => e.Model.Name == "gpt-4o" && e.InputTokenCost == 2.0m && e.OutputTokenCost == 4.0m);
        (await endpointRepo.GetByProviderAsync(providerB.Id, CancellationToken))
            .Should().ContainSingle(e => e.Model.Name == "gpt-4o" && e.InputTokenCost == 2.0m && e.OutputTokenCost == 4.0m);
    }

    [TestMethod]
    public async Task RefreshProvider_UpdatesPriceOfExistingEndpoint()
    {
        var client = Substitute.For<IProviderClient>();
        IServiceProvider services = BuildServices(client);

        var provider = await services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>().CreateAsync(CancellationToken);
        var model = await services.GetRequiredService<IModelRepository>().GetOrCreateAsync("gpt-4o", CancellationToken);
        var refresher = services.GetRequiredService<IModelPriceRefresher>();

        client.GetModelsAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<PricedModel>>([new PricedModel(model, new ModelPrice(1.0m, 2.0m))]));
        await refresher.RefreshProviderAsync(provider, CancellationToken);

        client.GetModelsAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<PricedModel>>([new PricedModel(model, new ModelPrice(3.0m, 9.0m))]));
        await refresher.RefreshProviderAsync(provider, CancellationToken);

        var endpoints = await services.GetRequiredService<IModelEndpointRepository>().GetByProviderAsync(provider.Id, CancellationToken);
        var endpoint = endpoints.Should().ContainSingle().Subject;
        endpoint.InputTokenCost.Should().Be(3.0m);
        endpoint.OutputTokenCost.Should().Be(9.0m);
    }

    private IServiceProvider BuildServices(IProviderClient client) =>
        GetServices(builder =>
        {
            builder.RegisterInstance<IProviderClient.Factory>(_ => client);
            builder.Register(_ => NullLogger<ModelPriceRefresher>.Instance)
                .As<ILogger<ModelPriceRefresher>>()
                .SingleInstance();
            builder.RegisterType<ModelPriceRefresher>()
                .As<IModelPriceRefresher>()
                .SingleInstance();
        });
}
