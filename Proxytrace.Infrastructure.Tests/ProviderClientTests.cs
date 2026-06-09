using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure.Tests;

[TestClass]
public sealed class ProviderClientTests
{
    public required TestContext TestContext { get; init; }

    [TestMethod]
    public async Task GetModels_UnsupportedKind_Throws()
    {
        var provider = StubProvider(ModelProviderKind.Unknown);
        var client = new ProviderClient(provider, Substitute.For<IModelRepository>(), new HttpClient(), Substitute.For<IPricingService>());

        await FluentActions
            .Invoking(() => client.GetModelsAsync(TestContext.CancellationToken))
            .Should()
            .ThrowAsync<NotSupportedException>();
    }

    [TestMethod]
    public async Task GetModels_AnthropicKind_Throws()
    {
        var provider = StubProvider(ModelProviderKind.Anthropic);
        var client = new ProviderClient(provider, Substitute.For<IModelRepository>(), new HttpClient(), Substitute.For<IPricingService>());

        await FluentActions
            .Invoking(() => client.GetModelsAsync(TestContext.CancellationToken))
            .Should()
            .ThrowAsync<NotSupportedException>();
    }

    [TestMethod]
    public async Task VerifyConnection_UnsupportedKind_ReturnsFalse()
    {
        var provider = StubProvider(ModelProviderKind.Unknown);
        var client = new ProviderClient(provider, Substitute.For<IModelRepository>(), new HttpClient(), Substitute.For<IPricingService>());

        var result = await client.VerifyConnectionAsync(TestContext.CancellationToken);

        result.Should().BeFalse();
    }

    [TestMethod]
    public async Task GetModels_Azure_UsesDeployments_PricesByBaseModel_NeverFallsBackToModelsList()
    {
        var handler = new RoutingHandler(
            deploymentsJson: """{"data":[{"id":"my-deploy","model":"gpt-4o"}]}""",
            modelsJson: """{"data":[{"id":"should-not-appear"}]}""");
        var provider = StubAzureProvider();
        var modelRepo = EchoingModelRepository();
        var pricing = Substitute.For<IPricingService>();
        pricing.ResolveAsync(Arg.Any<IModelProvider>(), Arg.Any<DiscoveredModel>(), Arg.Any<CancellationToken>())
            .Returns(ModelPrice.Unknown);
        var client = new ProviderClient(provider, modelRepo, new HttpClient(handler), pricing);

        var result = await client.GetModelsAsync(TestContext.CancellationToken);

        // The deployment id is the endpoint's model name; "should-not-appear" from /models never surfaces.
        result.Should().ContainSingle();
        result[0].Model.Name.Should().Be("my-deploy");
        // Pricing is resolved against the deployment's base model, not the deployment id.
        await pricing.Received(1).ResolveAsync(
            provider,
            Arg.Is<DiscoveredModel>(d => d.Name == "my-deploy" && d.PricingModelName == "gpt-4o"),
            Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetModels_Azure_DeploymentsFail_ReturnsEmpty_NoModelsFallback()
    {
        var handler = new RoutingHandler(
            deploymentsJson: null,
            modelsJson: """{"data":[{"id":"should-not-appear"}]}""");
        var provider = StubAzureProvider();
        var client = new ProviderClient(provider, EchoingModelRepository(), new HttpClient(handler), Substitute.For<IPricingService>());

        var result = await client.GetModelsAsync(TestContext.CancellationToken);

        result.Should().BeEmpty();
    }

    private static IModelRepository EchoingModelRepository()
    {
        var repo = Substitute.For<IModelRepository>();
        repo.GetOrCreateAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(ci =>
            {
                var model = Substitute.For<IModel>();
                model.Name.Returns(ci.Arg<string>());
                return model;
            });
        return repo;
    }

    private static IModelProvider StubProvider(ModelProviderKind kind)
    {
        var provider = Substitute.For<IModelProvider>();
        provider.Name.Returns("Stub");
        provider.Endpoint.Returns(new Uri("https://example.test/v1/"));
        provider.ApiKey.Returns("sk-test");
        provider.Kind.Returns(kind);
        return provider;
    }

    private static IModelProvider StubAzureProvider()
    {
        var provider = Substitute.For<IModelProvider>();
        provider.Endpoint.Returns(new Uri("https://my-resource.openai.azure.com/"));
        provider.ApiKey.Returns("sk-test");
        provider.Kind.Returns(ModelProviderKind.OpenAiCompatible);
        return provider;
    }

    private sealed class RoutingHandler(string? deploymentsJson, string modelsJson) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            string path = request.RequestUri?.AbsolutePath ?? string.Empty;
            if (path.Contains("/deployments"))
            {
                return Task.FromResult(deploymentsJson is null
                    ? new HttpResponseMessage(System.Net.HttpStatusCode.InternalServerError)
                    : new HttpResponseMessage(System.Net.HttpStatusCode.OK)
                      { Content = new StringContent(deploymentsJson, System.Text.Encoding.UTF8, "application/json") });
            }
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
                { Content = new StringContent(modelsJson, System.Text.Encoding.UTF8, "application/json") });
        }
    }
}
