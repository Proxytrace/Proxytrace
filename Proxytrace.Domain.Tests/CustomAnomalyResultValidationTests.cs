using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain.CustomAnomaly;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class CustomAnomalyResultValidationTests : DomainTest<Module>
{
    [TestMethod]
    public void CreateNew_WithValidInputs_CreatesResult()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyResult.CreateNew>();
        var detectorId = Guid.NewGuid();
        var callId = Guid.NewGuid();
        var projectId = Guid.NewGuid();

        var result = factory(detectorId, callId, projectId, "refund", "Promised an unauthorized refund.");

        result.DetectorId.Should().Be(detectorId);
        result.AgentCallId.Should().Be(callId);
        result.ProjectId.Should().Be(projectId);
        result.MatchedTrigger.Should().Be("refund");
        result.Reasoning.Should().Be("Promised an unauthorized refund.");
        result.Id.Should().NotBe(Guid.Empty);
    }

    [TestMethod]
    public void CreateNew_NullReasoning_IsAllowed()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyResult.CreateNew>();

        var result = factory(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "refund", null);

        result.Reasoning.Should().BeNull();
    }

    [TestMethod]
    public void CreateNew_DefaultDetectorId_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyResult.CreateNew>();

        var act = () => factory(Guid.Empty, Guid.NewGuid(), Guid.NewGuid(), "refund", null);

        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_EmptyMatchedTrigger_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyResult.CreateNew>();

        var act = () => factory(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), " ", null);

        act.Should().Throw<Exception>();
    }
}
