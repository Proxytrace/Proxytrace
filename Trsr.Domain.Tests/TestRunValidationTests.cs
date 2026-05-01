using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class TestRunValidationTests : DomainTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesTestRun()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ITestRun.CreateNew>();
        var suite = await GetOrCreate<ITestSuite>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act
        var testRun = factory(suite, endpoint);

        // Assert
        testRun.Should().NotBeNull();
        testRun.Suite.Should().Be(suite);
        testRun.Endpoint.Should().Be(endpoint);
        testRun.TestResults.Should().BeEmpty();
        testRun.Status.Should().Be(TestRunStatus.Pending);
        testRun.Id.Should().NotBe(Guid.Empty);
        testRun.CreatedAt.Should().NotBe(default);
        testRun.UpdatedAt.Should().NotBe(default);
    }
}
