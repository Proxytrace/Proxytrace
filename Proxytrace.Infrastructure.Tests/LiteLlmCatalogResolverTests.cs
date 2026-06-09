using System.Net;
using System.Text;
using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure.Tests;

[TestClass]
public sealed class LiteLlmCatalogResolverTests
{
    public required TestContext TestContext { get; init; }

    private const string Catalog =
        """
        {
          "sample_spec": { "input_cost_per_token": 0.0, "output_cost_per_token": 0.0 },
          "gpt-4o": { "input_cost_per_token": 0.0000025, "output_cost_per_token": 0.00001 }
        }
        """;

    [TestMethod]
    public async Task Resolve_KnownModel_ConvertsUsdPerTokenToEurPer1M()
    {
        var fx = Substitute.For<IFxRateProvider>();
        fx.GetUsdToEurAsync(Arg.Any<CancellationToken>()).Returns(0.9m);
        var sut = new LiteLlmCatalogResolver(new HttpClient(new StubHandler(HttpStatusCode.OK, Catalog)), new PricingOptions(), fx);

        var price = await sut.ResolveAsync(new DiscoveredModel("gpt-4o", "gpt-4o"), TestContext.CancellationToken);

        price.InputTokenCost.Should().Be(2.25m);
        price.OutputTokenCost.Should().Be(9.0m);
    }

    [TestMethod]
    public async Task Resolve_UnknownModel_ReturnsUnknown()
    {
        var fx = Substitute.For<IFxRateProvider>();
        fx.GetUsdToEurAsync(Arg.Any<CancellationToken>()).Returns(0.9m);
        var sut = new LiteLlmCatalogResolver(new HttpClient(new StubHandler(HttpStatusCode.OK, Catalog)), new PricingOptions(), fx);

        var price = await sut.ResolveAsync(new DiscoveredModel("does-not-exist", "does-not-exist"), TestContext.CancellationToken);

        price.Should().Be(ModelPrice.Unknown);
    }

    [TestMethod]
    public async Task Resolve_NoFxRate_ReturnsUnknown()
    {
        var fx = Substitute.For<IFxRateProvider>();
        fx.GetUsdToEurAsync(Arg.Any<CancellationToken>()).Returns((decimal?)null);
        var sut = new LiteLlmCatalogResolver(new HttpClient(new StubHandler(HttpStatusCode.OK, Catalog)), new PricingOptions(), fx);

        var price = await sut.ResolveAsync(new DiscoveredModel("gpt-4o", "gpt-4o"), TestContext.CancellationToken);

        price.Should().Be(ModelPrice.Unknown);
    }

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(status)
            { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }
}
