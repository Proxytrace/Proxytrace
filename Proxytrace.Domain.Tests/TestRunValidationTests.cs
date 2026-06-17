using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class TestRunValidationTests : DomainTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesTestRun()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createGroup = services.GetRequiredService<ITestRunGroup.CreateNew>();
        var createRun = services.GetRequiredService<ITestRun.CreateNew>();
        var suite = await GetOrCreate<ITestSuite>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        var group = createGroup(suite, false, null);

        // Act
        var testRun = createRun(group, endpoint);

        // Assert
        testRun.Should().NotBeNull();
        testRun.Group.Should().Be(group);
        testRun.Endpoint.Should().Be(endpoint);
        testRun.TestResults.Should().BeEmpty();
        testRun.Status.Should().Be(TestRunStatus.Pending);
        testRun.Id.Should().NotBe(Guid.Empty);
        testRun.CreatedAt.Should().NotBe(default);
        testRun.UpdatedAt.Should().NotBe(default);
    }
}
