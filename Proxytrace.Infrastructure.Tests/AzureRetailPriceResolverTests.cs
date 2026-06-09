using System.Net;
using System.Text;
using AwesomeAssertions;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure.Tests;

[TestClass]
public sealed class AzureRetailPriceResolverTests
{
    public required TestContext TestContext { get; init; }

    private const string Response =
        """
        {
          "Items": [
            { "currencyCode":"EUR","retailPrice":0.0025,"unitOfMeasure":"1K","meterName":"gpt 4o Inp glbl","serviceName":"Cognitive Services","skuName":"Standard" },
            { "currencyCode":"EUR","retailPrice":0.01,"unitOfMeasure":"1K","meterName":"gpt 4o Outp glbl","serviceName":"Cognitive Services","skuName":"Standard" },
            { "currencyCode":"EUR","retailPrice":0.99,"unitOfMeasure":"1K","meterName":"gpt 4o Inp Data Zone","serviceName":"Cognitive Services","skuName":"Standard" }
          ],
          "NextPageLink": null
        }
        """;

    [TestMethod]
    public async Task Resolve_GlobalStandard_MatchesGlobalMetersAndNormalizesTo1M()
    {
        var sut = new AzureRetailPriceResolver(new HttpClient(new StubHandler(Response)), new PricingOptions());

        var price = await sut.ResolveAsync(new DiscoveredModel("my-deploy", "gpt-4o"),
            AzureDeploymentType.GlobalStandard, TestContext.CancellationToken);

        price.InputTokenCost.Should().Be(2.5m);
        price.OutputTokenCost.Should().Be(10.0m);
    }

    [TestMethod]
    public async Task Resolve_DataZone_PicksDataZoneMeter()
    {
        var sut = new AzureRetailPriceResolver(new HttpClient(new StubHandler(Response)), new PricingOptions());

        var price = await sut.ResolveAsync(new DiscoveredModel("my-deploy", "gpt-4o"),
            AzureDeploymentType.DataZoneStandard, TestContext.CancellationToken);

        price.InputTokenCost.Should().Be(990.0m);
    }

    [TestMethod]
    public async Task Resolve_NoMatch_ReturnsUnknown()
    {
        var sut = new AzureRetailPriceResolver(new HttpClient(new StubHandler(Response)), new PricingOptions());

        var price = await sut.ResolveAsync(new DiscoveredModel("x", "claude-3"),
            AzureDeploymentType.GlobalStandard, TestContext.CancellationToken);

        price.Should().Be(ModelPrice.Unknown);
    }

    private sealed class StubHandler(string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }
}
