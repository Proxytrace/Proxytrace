using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Controllers;
using Trsr.Api.Dto.TestSuites;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Evaluator;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestSuite;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class TestSuitesControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task PromoteFromTraces_WithEvaluatorIds_AttachesSelectedEvaluatorsAndNotDefault()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);
        var helpfulness = await services.GetRequiredService<IDomainEntityGenerator<IHelpfulnessEvaluator>>().CreateAsync(CancellationToken);

        var request = new PromoteTracesRequest(
            Name: "From-traces helpfulness suite",
            AgentId: call.Agent.Id,
            AgentCallIds: [call.Id],
            EvaluatorIds: [helpfulness.Id]);

        var result = await controller.PromoteFromTraces(request, CancellationToken);

        var actionResult = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException("Expected non-null Result."));
        var dto = actionResult.Value as TestSuiteDto
            ?? throw new InvalidOperationException("Expected TestSuiteDto value.");
        dto.Evaluators.Should().HaveCount(1);
        dto.Evaluators.Single().Id.Should().Be(helpfulness.Id);
        dto.Evaluators.Single().Kind.Should().Be(EvaluatorKind.Helpfulness);
    }

    [TestMethod]
    public async Task PromoteFromTraces_WithoutEvaluatorIds_FallsBackToDefaultExactMatch()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);

        var request = new PromoteTracesRequest(
            Name: "From-traces default suite",
            AgentId: call.Agent.Id,
            AgentCallIds: [call.Id]);

        var result = await controller.PromoteFromTraces(request, CancellationToken);

        var actionResult = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException("Expected non-null Result."));
        var dto = actionResult.Value as TestSuiteDto
            ?? throw new InvalidOperationException("Expected TestSuiteDto value.");
        dto.Evaluators.Should().ContainSingle(e => e.Kind == EvaluatorKind.ExactMatch);
    }

    [TestMethod]
    public async Task AddTestCase_AfterPromote_DoesNotDuplicateEvaluatorJunctionRows()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        var firstCall = await generator.CreateAsync(CancellationToken);
        var secondCall = await generator.CreateAsync(CancellationToken);
        var helpfulness = await services.GetRequiredService<IDomainEntityGenerator<IHelpfulnessEvaluator>>().CreateAsync(CancellationToken);

        var promoteResult = await controller.PromoteFromTraces(
            new PromoteTracesRequest(
                Name: "Suite under test",
                AgentId: firstCall.Agent.Id,
                AgentCallIds: [firstCall.Id],
                EvaluatorIds: [helpfulness.Id]),
            CancellationToken);
        var promoteAction = (CreatedAtActionResult)(promoteResult.Result ?? throw new InvalidOperationException("Expected non-null Result."));
        var routeValues = promoteAction.RouteValues ?? throw new InvalidOperationException("Expected non-null RouteValues.");
        var suiteId = (Guid)(routeValues["id"] ?? throw new InvalidOperationException("Expected 'id' route value."));

        var addResult = await controller.AddTestCase(
            suiteId,
            new AddTestCaseRequest(FromAgentCallId: secondCall.Id, Input: null, ExpectedOutput: null),
            CancellationToken);

        var dto = ((ActionResult<TestSuiteDto>)addResult).Value
            ?? throw new InvalidOperationException("Expected non-null Value.");
        dto.TestCases.Should().HaveCount(2);
        dto.Evaluators.Should().ContainSingle(e => e.Id == helpfulness.Id);
    }

    private static TestSuitesController ResolveController(IServiceProvider services) =>
        new(
            services.GetRequiredService<ITestSuiteRepository>(),
            services.GetRequiredService<IAgentRepository>(),
            services.GetRequiredService<IAgentCallRepository>(),
            services.GetRequiredService<ITestCaseRepository>(),
            services.GetRequiredService<IEvaluatorRepository>(),
            services.GetRequiredService<ITestCase.CreateNew>(),
            services.GetRequiredService<ITestCase.CreateNewFromCall>(),
            services.GetRequiredService<IExactMatchEvaluator.CreateNew>(),
            services.GetRequiredService<ITestSuite.CreateNew>(),
            services.GetRequiredService<ITestSuite.CreateExisting>());
}
