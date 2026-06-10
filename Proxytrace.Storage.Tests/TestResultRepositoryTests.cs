using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.TestCase;
using Proxytrace.Domain.TestResult;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class TestResultRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetRecentByEvaluator_WithScoreFilter_ReturnsOnlyMatchingScore()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestResultRepository>();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>().GetOrCreateAsync(CancellationToken);

        await PersistResult(services, evaluator, EvaluationScore.Good);
        await PersistResult(services, evaluator, EvaluationScore.Bad);

        var good = await repo.GetRecentByEvaluatorAsync(evaluator.Id, 20, EvaluationScore.Good, CancellationToken);
        var bad = await repo.GetRecentByEvaluatorAsync(evaluator.Id, 20, EvaluationScore.Bad, CancellationToken);

        good.Should().ContainSingle();
        good.Single().Evaluations.Should().Contain(e => e.Evaluator.Id == evaluator.Id && e.Score == EvaluationScore.Good);
        bad.Should().ContainSingle();
        bad.Single().Evaluations.Should().Contain(e => e.Evaluator.Id == evaluator.Id && e.Score == EvaluationScore.Bad);
    }

    [TestMethod]
    public async Task GetRecentByEvaluator_WithoutScoreFilter_ReturnsAllScores()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestResultRepository>();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>().GetOrCreateAsync(CancellationToken);

        await PersistResult(services, evaluator, EvaluationScore.Good);
        await PersistResult(services, evaluator, EvaluationScore.Bad);

        var all = await repo.GetRecentByEvaluatorAsync(evaluator.Id, 20, cancellationToken: CancellationToken);

        all.Should().HaveCount(2);
    }

    private async Task PersistResult(IServiceProvider services, IEvaluator evaluator, EvaluationScore score)
    {
        var testCaseGen = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        var completionGen = services.GetRequiredService<IDomainObjectGenerator<ICompletion>>();
        var evalFactory = services.GetRequiredService<IEvaluation.Create>();
        var resultFactory = services.GetRequiredService<ITestResult.CreateNew>();
        var repo = services.GetRequiredService<ITestResultRepository>();

        // Each result needs its own test case — GetRecentByEvaluatorAsync dedupes by test case.
        var testCase = await testCaseGen.CreateAsync(CancellationToken);
        var completion = await completionGen.CreateAsync(CancellationToken);
        var evaluation = evalFactory(evaluator, score, TimeSpan.FromMilliseconds(10), null, null, null);
        var result = resultFactory(testCase, completion, [evaluation]);
        await repo.AddAsync(result, CancellationToken);
    }
}
