using AwesomeAssertions;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class ProviderEndpointsTests
{
    [TestMethod]
    [DataRow("https://my-resource.openai.azure.com/", true)]
    [DataRow("https://eastus.api.cognitive.microsoft.azure.com/", true)]
    [DataRow("https://api.openai.com/v1", false)]
    [DataRow("https://api.anthropic.com/v1", false)]
    public void IsAzure_DetectsByHost(string endpoint, bool expected)
    {
        ProviderEndpoints.IsAzure(new Uri(endpoint)).Should().Be(expected);
    }
}
