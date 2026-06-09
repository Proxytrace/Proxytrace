using System.Net;
using System.Text;
using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure.Tests;

[TestClass]
public sealed class PricingServiceTests
{
    public required TestContext TestContext { get; init; }

    [TestMethod]
    public async Task Resolve_AzureProvider_UsesAzureResolver()
    {
        const string azureBody =
            """{"Items":[{"currencyCode":"EUR","retailPrice":0.002,"unitOfMeasure":"1K","meterName":"gpt 4o Inp glbl","serviceName":"Cognitive Services","skuName":"Standard"}]}""";
        var sut = BuildService(azureBody, liteLlmBody: "{}", fx: 0.9m);

        var price = await sut.ResolveAsync(
            StubProvider("https://x.openai.azure.com/"),
            new DiscoveredModel("d", "gpt-4o"),
            AzureDeploymentType.GlobalStandard, TestContext.CancellationToken);

        price.InputTokenCost.Should().Be(2.0m);
    }

    [TestMethod]
    public async Task Resolve_NonAzureProvider_UsesLiteLlmResolver()
    {
        const string catalog = """{"gpt-4o":{"input_cost_per_token":0.000001,"output_cost_per_token":0.000002}}""";
        var sut = BuildService(azureBody: "{}", liteLlmBody: catalog, fx: 0.5m);

        var price = await sut.ResolveAsync(
            StubProvider("https://api.openai.com/v1"),
            new DiscoveredModel("gpt-4o", "gpt-4o"),
            AzureDeploymentType.GlobalStandard, TestContext.CancellationToken);

        price.InputTokenCost.Should().Be(0.5m);
    }

    private static IModelProvider StubProvider(string endpoint)
    {
        var p = Substitute.For<IModelProvider>();
        p.Endpoint.Returns(new Uri(endpoint));
        return p;
    }

    private static PricingService BuildService(string azureBody, string liteLlmBody, decimal fx)
    {
        var opts = new PricingOptions();
        var azure = new AzureRetailPriceResolver(new HttpClient(new StubHandler(azureBody)), opts);
        var fxProvider = Substitute.For<IFxRateProvider>();
        fxProvider.GetUsdToEurAsync(Arg.Any<CancellationToken>()).Returns(fx);
        var liteLlm = new LiteLlmCatalogResolver(new HttpClient(new StubHandler(liteLlmBody)), opts, fxProvider);
        return new PricingService(azure, liteLlm);
    }

    private sealed class StubHandler(string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }
}
