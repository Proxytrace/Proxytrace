using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Api.Controllers;
using Proxytrace.Domain;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Evaluator;
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
    public async Task Recent_ReturnsItemsWithTheEvaluatorsLoggedScore()
    {
        IServiceProvider services = GetServices();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>().CreateAsync(CancellationToken);
        var (testCase, _) = await SeedScoredResult(services, evaluator, EvaluationScore.Bad);
        var controller = ResolveController(services);

        var result = await controller.Recent(evaluator.Id, 10, CancellationToken);

        result.Value.Should().ContainSingle();
        result.Value![0].TestCaseId.Should().Be(testCase.Id);
        result.Value![0].Score.Should().Be(EvaluationScore.Bad);
    }

    private async Task<(ITestCase TestCase, ITestResult Result)> SeedScoredResult(
        IServiceProvider services, IEvaluator evaluator, EvaluationScore score)
    {
        var testCase = await services.GetRequiredService<IDomainEntityGenerator<ITestCase>>().CreateAsync(CancellationToken);
        var completion = await services.GetRequiredService<IDomainObjectGenerator<ICompletion>>().CreateAsync(CancellationToken);
        var evaluation = services.GetRequiredService<IEvaluation.Create>()(evaluator, score, TimeSpan.FromMilliseconds(10), null, null, null);
        var result = services.GetRequiredService<ITestResult.CreateNew>()(testCase, completion, [evaluation]);
        await services.GetRequiredService<ITestResultRepository>().AddAsync(result, CancellationToken);
        return (testCase, result);
    }

    private static EvaluatorTestBenchController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<IEvaluatorRepository>(),
        services.GetRequiredService<ITestCaseRepository>(),
        services.GetRequiredService<ITestResultRepository>(),
        services.GetRequiredService<ICompletion.Create>(),
        services.GetRequiredService<ITestResult.CreateNew>());
}
