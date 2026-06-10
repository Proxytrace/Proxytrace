using AwesomeAssertions;
using Proxytrace.Application.Demo;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Demo;

[TestClass]
public sealed class KioskEndpointOptionsTests : BaseTest<Module>
{
    [TestMethod]
    public void IsConfigured_WhenAllRequiredFieldsPresent_IsTrue()
    {
        var options = new KioskEndpointOptions
        {
            BaseUrl = "https://api.openai.com/v1",
            ApiKey = "sk-test",
            Model = "gpt-4o",
        };

        options.IsConfigured.Should().BeTrue();
    }

    [TestMethod]
    public void IsConfigured_WhenApiKeyMissing_IsFalse()
    {
        var options = new KioskEndpointOptions
        {
            BaseUrl = "https://api.openai.com/v1",
            Model = "gpt-4o",
        };

        options.IsConfigured.Should().BeFalse();
    }

    [TestMethod]
    public void Resolve_WithCompleteConfig_ReturnsResolvedEndpoint()
    {
        var options = new KioskEndpointOptions
        {
            BaseUrl = "https://api.openai.com/v1",
            ApiKey = "sk-real",
            Model = "gpt-4o",
            Kind = "openaicompatible",
            ProviderName = "Demo Provider",
            InputTokenCost = 0.000003m,
            OutputTokenCost = 0.000015m,
        };

        var resolved = options.Resolve();

        resolved.BaseUrl.Should().Be(new Uri("https://api.openai.com/v1"));
        resolved.ApiKey.Should().Be("sk-real");
        resolved.Model.Should().Be("gpt-4o");
        resolved.Kind.Should().Be(ModelProviderKind.OpenAiCompatible);
        resolved.ProviderName.Should().Be("Demo Provider");
        resolved.InputTokenCost.Should().Be(0.000003m);
        resolved.OutputTokenCost.Should().Be(0.000015m);
    }

    [TestMethod]
    public void Resolve_WhenRequiredFieldMissing_Throws()
    {
        var options = new KioskEndpointOptions
        {
            BaseUrl = "https://api.openai.com/v1",
            Model = "gpt-4o",
        };

        FluentActions.Invoking(() => options.Resolve())
            .Should().Throw<InvalidOperationException>();
    }

    [TestMethod]
    public void Resolve_WhenBaseUrlNotAbsolute_Throws()
    {
        var options = new KioskEndpointOptions
        {
            BaseUrl = "not-a-url",
            ApiKey = "sk-real",
            Model = "gpt-4o",
        };

        FluentActions.Invoking(() => options.Resolve())
            .Should().Throw<InvalidOperationException>();
    }

    [TestMethod]
    public void Resolve_WhenKindInvalid_Throws()
    {
        var options = new KioskEndpointOptions
        {
            BaseUrl = "https://api.openai.com/v1",
            ApiKey = "sk-real",
            Model = "gpt-4o",
            Kind = "Bogus",
        };

        FluentActions.Invoking(() => options.Resolve())
            .Should().Throw<InvalidOperationException>();
    }
}
