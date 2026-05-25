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
        var client = new ProviderClient(provider, Substitute.For<IModelRepository>());

        await FluentActions
            .Invoking(() => client.GetModelsAsync(TestContext.CancellationToken))
            .Should()
            .ThrowAsync<NotSupportedException>();
    }

    [TestMethod]
    public async Task GetModels_AnthropicKind_Throws()
    {
        var provider = StubProvider(ModelProviderKind.Anthropic);
        var client = new ProviderClient(provider, Substitute.For<IModelRepository>());

        await FluentActions
            .Invoking(() => client.GetModelsAsync(TestContext.CancellationToken))
            .Should()
            .ThrowAsync<NotSupportedException>();
    }

    [TestMethod]
    public async Task VerifyConnection_UnsupportedKind_ReturnsFalse()
    {
        var provider = StubProvider(ModelProviderKind.Unknown);
        var client = new ProviderClient(provider, Substitute.For<IModelRepository>());

        var result = await client.VerifyConnectionAsync(TestContext.CancellationToken);

        result.Should().BeFalse();
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
}
