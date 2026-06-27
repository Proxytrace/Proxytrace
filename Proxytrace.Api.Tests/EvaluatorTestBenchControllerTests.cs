using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.TestRuns;
using Proxytrace.Domain;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.TestCase;
using Proxytrace.Domain.TestResult;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class EvaluatorTestBenchControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Load_WhenEvaluatorScoredTheResult_ReturnsLoggedEvaluation()
    {
        IServiceProvider services = GetServices();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);
        var (testCase, _) = await SeedScoredResult(services, evaluator, EvaluationScore.Good);
        var controller = ResolveController(services);

        var result = await controller.Load(evaluator.Id, testCase.Id, CancellationToken);

        var payload = result.Value;
        payload.Should().NotBeNull();
        payload.LoggedEvaluation.Should().NotBeNull();
        payload.LoggedEvaluation.EvaluatorId.Should().Be(evaluator.Id);
        payload.LoggedEvaluation.Score.Should().Be(EvaluationScore.Good);
    }

    [TestMethod]
    public async Task Load_WhenEvaluatorDidNotScoreTheResult_ReturnsNullLoggedEvaluation()
    {
        IServiceProvider services = GetServices();
        var scorer = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);
        var other = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);
        var (testCase, _) = await SeedScoredResult(services, scorer, EvaluationScore.Good);
        var controller = ResolveController(services);

        var result = await controller.Load(other.Id, testCase.Id, CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.LoggedEvaluation.Should().BeNull();
    }

    [TestMethod]
    public async Task Load_WhenActualResponseIsToolCallOnly_RendersToolCallInsteadOfEmpty()
    {
        IServiceProvider services = GetServices();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);
        var testCase = await services.GetRequiredService<IDomainEntityGenerator<ITestCase>>().CreateAsync(CancellationToken);
        var toolResponse = new AssistantMessage(
            [],
            [new ToolRequest("call-1", "get_weather", """{"city":"NYC"}""")]);
        var completion = services.GetRequiredService<ICompletion.Create>()(toolResponse, null, TimeSpan.FromMilliseconds(10));
        var evaluation = services.GetRequiredService<IEvaluation.Create>()(evaluator, EvaluationScore.Good, TimeSpan.FromMilliseconds(10), null, null, null);
        var result = services.GetRequiredService<ITestResult.CreateNew>()(testCase, completion, [evaluation]);
        await services.GetRequiredService<ITestResultRepository>().AddAsync(result, CancellationToken);
        var controller = ResolveController(services);

        var payload = (await controller.Load(evaluator.Id, testCase.Id, CancellationToken)).Value;

        payload.Should().NotBeNull();
        payload.ActualResponse.Should().NotBeNullOrWhiteSpace();
        payload.ActualResponse.Should().Contain("[tool call]");
        payload.ActualResponse.Should().Contain("get_weather");
    }

    [TestMethod]
    public async Task Recent_ReturnsItemsWithTheEvaluatorsLoggedScore()
    {
        IServiceProvider services = GetServices();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);
        var (testCase, _) = await SeedScoredResult(services, evaluator, EvaluationScore.Bad);
        var controller = ResolveController(services);

        var result = await controller.Recent(evaluator.Id, 10, CancellationToken);

        result.Value.Should().ContainSingle();
        result.Value[0].TestCaseId.Should().Be(testCase.Id);
        result.Value[0].Score.Should().Be(EvaluationScore.Bad);
    }

    [TestMethod]
    public async Task Search_WhenReasoningMatchesQuery_ReturnsOnlyTheScopedMatch()
    {
        IServiceProvider services = GetServices();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);
        var (matched, _) = await SeedScoredResult(services, evaluator, EvaluationScore.Good, "needle phrase");
        await SeedScoredResult(services, evaluator, EvaluationScore.Bad, "unrelated text");
        var controller = ResolveController(services);

        var result = await controller.Search(evaluator.Id, "needle", 10, CancellationToken);

        result.Value.Should().ContainSingle();
        result.Value[0].TestCaseId.Should().Be(matched.Id);
        result.Value[0].Score.Should().Be(EvaluationScore.Good);
    }

    [TestMethod]
    public async Task Search_WhenEvaluatorMissing_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Search(Guid.NewGuid(), "anything", 10, CancellationToken);

        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    private async Task<(ITestCase TestCase, ITestResult Result)> SeedScoredResult(
        IServiceProvider services, IEvaluator evaluator, EvaluationScore score, string? reasoning = null)
    {
        var testCase = await services.GetRequiredService<IDomainEntityGenerator<ITestCase>>().CreateAsync(CancellationToken);
        var completion = await services.GetRequiredService<IDomainObjectGenerator<ICompletion>>().CreateAsync(CancellationToken);
        var evaluation = services.GetRequiredService<IEvaluation.Create>()(evaluator, score, TimeSpan.FromMilliseconds(10), null, null, reasoning);
        var result = services.GetRequiredService<ITestResult.CreateNew>()(testCase, completion, [evaluation]);
        await services.GetRequiredService<ITestResultRepository>().AddAsync(result, CancellationToken);
        return (testCase, result);
    }

    [TestMethod]
    public async Task Run_WhenEvaluatorInaccessible_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);
        var (testCase, _) = await SeedScoredResult(services, evaluator, EvaluationScore.Good);
        var controller = ResolveController(services, DenyingGuard());

        var result = await controller.Run(evaluator.Id, new(testCase.Id, null), CancellationToken);

        // The evaluator exists, but the caller is not a member of its project → hidden behind a 404.
        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [TestMethod]
    public async Task Load_WhenEvaluatorInaccessible_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);
        var (testCase, _) = await SeedScoredResult(services, evaluator, EvaluationScore.Good);
        var controller = ResolveController(services, DenyingGuard());

        var result = await controller.Load(evaluator.Id, testCase.Id, CancellationToken);

        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    // Non-admin member of nothing: denied every project.
    private static Proxytrace.Api.Auth.IProjectAccessGuard DenyingGuard()
    {
        var guard = Substitute.For<Proxytrace.Api.Auth.IProjectAccessGuard>();
        guard.CanAccessProjectAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(false);
        guard.GetAccessibleProjectIdsAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyCollection<Guid>?>([]));
        return guard;
    }

    private static EvaluatorTestBenchController ResolveController(IServiceProvider services)
        => ResolveController(services, services.GetRequiredService<Proxytrace.Api.Auth.IProjectAccessGuard>());

    private static EvaluatorTestBenchController ResolveController(
        IServiceProvider services, Proxytrace.Api.Auth.IProjectAccessGuard guard) => new(
        services.GetRequiredService<IEvaluatorRepository>(),
        services.GetRequiredService<ITestCaseRepository>(),
        services.GetRequiredService<ITestResultRepository>(),
        services.GetRequiredService<ICompletion.Create>(),
        services.GetRequiredService<ITestResult.CreateNew>(),
        guard);
}
