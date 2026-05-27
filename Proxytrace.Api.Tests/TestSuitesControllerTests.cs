using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.TestSuites;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.TestCase;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class TestSuitesControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task PromoteFromTraces_WithEvaluatorIds_AttachesSelectedEvaluatorsAndNotDefault()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);
        var helpfulness = await services.GetRequiredService<IDomainEntityGenerator<IAgenticEvaluator>>().CreateAsync(CancellationToken);

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
        dto.Evaluators.Single().Kind.Should().Be(EvaluatorKind.Agentic);
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
        var helpfulness = await services.GetRequiredService<IDomainEntityGenerator<IAgenticEvaluator>>().CreateAsync(CancellationToken);

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

        var dto = addResult.Value
            ?? throw new InvalidOperationException("Expected non-null Value.");
        dto.TestCases.Should().HaveCount(2);
        dto.Evaluators.Should().ContainSingle(e => e.Id == helpfulness.Id);
    }

    [TestMethod]
    public async Task GetAll_NoFilter_ReturnsAllSuitesPaged()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var createSuite = services.GetRequiredService<ITestSuite.CreateNew>();
        var suiteRepo = services.GetRequiredService<ITestSuiteRepository>();
        await suiteRepo.AddAsync(createSuite("Suite A", agent, [], []), CancellationToken);
        await suiteRepo.AddAsync(createSuite("Suite B", agent, [], []), CancellationToken);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Total.Should().Be(2);
        result.Items.Should().HaveCount(2);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(50);
    }

    [TestMethod]
    public async Task GetAll_FilterByAgent_ReturnsOnlyAgentSuites()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agentGen = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var agentA = await agentGen.CreateAsync(CancellationToken);
        var agentB = await agentGen.CreateAsync(CancellationToken);
        var createSuite = services.GetRequiredService<ITestSuite.CreateNew>();
        var suiteRepo = services.GetRequiredService<ITestSuiteRepository>();
        await suiteRepo.AddAsync(createSuite("A1", agentA, [], []), CancellationToken);
        await suiteRepo.AddAsync(createSuite("A2", agentA, [], []), CancellationToken);
        await suiteRepo.AddAsync(createSuite("B1", agentB, [], []), CancellationToken);

        var result = await controller.GetAll(agentId: agentA.Id, cancellationToken: CancellationToken);

        result.Total.Should().Be(2);
        result.Items.Should().OnlyContain(s => s.AgentId == agentA.Id);
    }

    [TestMethod]
    public async Task GetAll_Pagination_RespectsPageAndPageSize()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var createSuite = services.GetRequiredService<ITestSuite.CreateNew>();
        var suiteRepo = services.GetRequiredService<ITestSuiteRepository>();
        for (int i = 0; i < 5; i++)
            await suiteRepo.AddAsync(createSuite($"Suite {i}", agent, [], []), CancellationToken);

        var page1 = await controller.GetAll(page: 1, pageSize: 2, cancellationToken: CancellationToken);
        var page3 = await controller.GetAll(page: 3, pageSize: 2, cancellationToken: CancellationToken);

        page1.Items.Should().HaveCount(2);
        page1.Total.Should().Be(5);
        page3.Items.Should().HaveCount(1);
    }

    [TestMethod]
    public async Task Get_ExistingSuite_ReturnsDto()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var suite = await services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>().CreateAsync(CancellationToken);

        var result = await controller.Get(suite.Id, CancellationToken);

        var value = result.Value;
        value.Should().NotBeNull();
        value.Id.Should().Be(suite.Id);
        value.Name.Should().Be(suite.Name);
    }

    [TestMethod]
    public async Task Get_MissingSuite_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Get(Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Create_AgentNotFound_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var request = new CreateTestSuiteRequest(
            Name: "Suite",
            AgentId: Guid.NewGuid(),
            TestCases: []);

        var result = await controller.Create(request, CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Create_WithoutEvaluatorIds_AddsDefaultExactMatch()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);

        var request = new CreateTestSuiteRequest(
            Name: "Default-evaluator suite",
            AgentId: agent.Id,
            TestCases: []);

        var result = await controller.Create(request, CancellationToken);

        var action = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException("Expected non-null Result."));
        var dto = (TestSuiteDto)(action.Value ?? throw new InvalidOperationException("Expected DTO."));
        dto.Evaluators.Should().ContainSingle(e => e.Kind == EvaluatorKind.ExactMatch);
    }

    [TestMethod]
    public async Task Create_TestCaseMissingFromCallAndInline_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);

        var request = new CreateTestSuiteRequest(
            Name: "Bad suite",
            AgentId: agent.Id,
            TestCases: [new CreateTestCaseRequest(FromAgentCallId: null, Input: null, ExpectedOutput: null)]);

        var result = await controller.Create(request, CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Create_WithInlineTestCase_CreatesSuiteAndTestCase()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);

        var request = new CreateTestSuiteRequest(
            Name: "Inline suite",
            AgentId: agent.Id,
            TestCases:
            [
                new CreateTestCaseRequest(
                    FromAgentCallId: null,
                    Input: [new TestSuiteMessageDto("user", "hi")],
                    ExpectedOutput: new TestSuiteMessageDto("assistant", "hello")),
            ]);

        var result = await controller.Create(request, CancellationToken);

        var action = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException("Expected non-null Result."));
        var dto = (TestSuiteDto)(action.Value ?? throw new InvalidOperationException("Expected DTO."));
        dto.TestCases.Should().ContainSingle();
        dto.TestCases[0].ExpectedOutput.Content.Should().Be("hello");
    }

    [TestMethod]
    public async Task Update_MissingSuite_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Update(
            Guid.NewGuid(),
            new UpdateTestSuiteRequest(AgentId: null, EvaluatorIds: null, TestCaseIds: null),
            CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Update_ChangeEvaluators_PersistsNewSet()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var suite = await services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>().CreateAsync(CancellationToken);
        var newEval = await services.GetRequiredService<IDomainEntityGenerator<IAgenticEvaluator>>().CreateAsync(CancellationToken);

        var result = await controller.Update(
            suite.Id,
            new UpdateTestSuiteRequest(AgentId: null, EvaluatorIds: [newEval.Id], TestCaseIds: null),
            CancellationToken);

        var value = result.Value;
        value.Should().NotBeNull();
        value.Evaluators.Should().ContainSingle(e => e.Id == newEval.Id);
    }

    [TestMethod]
    public async Task Delete_ExistingSuite_ReturnsNoContent()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var suite = await services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>().CreateAsync(CancellationToken);

        var result = await controller.Delete(suite.Id, CancellationToken);

        result.Should().BeOfType<NoContentResult>();
        (await services.GetRequiredService<ITestSuiteRepository>().ContainsAsync(suite.Id, CancellationToken)).Should().BeFalse();
    }

    [TestMethod]
    public async Task Delete_MissingSuite_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Delete(Guid.NewGuid(), CancellationToken);

        result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task PromoteFromTraces_AgentNotFound_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.PromoteFromTraces(
            new PromoteTracesRequest(Name: "x", AgentId: Guid.NewGuid(), AgentCallIds: [Guid.NewGuid()]),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task PromoteFromTraces_NoCallIds_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);

        var result = await controller.PromoteFromTraces(
            new PromoteTracesRequest(Name: "x", AgentId: agent.Id, AgentCallIds: []),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task PromoteFromTraces_CallIdNotFound_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);

        var result = await controller.PromoteFromTraces(
            new PromoteTracesRequest(Name: "x", AgentId: agent.Id, AgentCallIds: [Guid.NewGuid()]),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task AddTestCase_MissingSuite_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.AddTestCase(
            Guid.NewGuid(),
            new AddTestCaseRequest(FromAgentCallId: null, Input: null, ExpectedOutput: null),
            CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task AddTestCase_MissingFromCallAndInline_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var suite = await services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>().CreateAsync(CancellationToken);

        var result = await controller.AddTestCase(
            suite.Id,
            new AddTestCaseRequest(FromAgentCallId: null, Input: null, ExpectedOutput: null),
            CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task AddTestCase_InlineMessages_AppendsTestCase()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var suite = await services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>().CreateAsync(CancellationToken);
        var initialCount = suite.TestCases.Count;

        var result = await controller.AddTestCase(
            suite.Id,
            new AddTestCaseRequest(
                FromAgentCallId: null,
                Input: [new TestSuiteMessageDto("user", "hello")],
                ExpectedOutput: new TestSuiteMessageDto("assistant", "world")),
            CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.TestCases.Should().HaveCount(initialCount + 1);
    }

    [TestMethod]
    public async Task RemoveTestCase_MissingSuite_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.RemoveTestCase(Guid.NewGuid(), Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task RemoveTestCase_DropsMatchingCase()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var suite = await services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>().CreateAsync(CancellationToken);
        var targetCase = suite.TestCases.First();

        var result = await controller.RemoveTestCase(suite.Id, targetCase.Id, CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.TestCases.Should().NotContain(tc => tc.Id == targetCase.Id);
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
            services.GetRequiredService<ITestSuite.CreateExisting>(),
            services.GetRequiredService<TestSuiteDtoMapper>());
}
