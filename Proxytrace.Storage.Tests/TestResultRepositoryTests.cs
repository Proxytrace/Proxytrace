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

    [TestMethod]
    public async Task SearchByEvaluator_MatchesReasoning_ReturnsOnlyMatchingCase()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestResultRepository>();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>().GetOrCreateAsync(CancellationToken);

        var matched = await PersistResult(services, evaluator, EvaluationScore.Good, "alpha unique reasoning");
        await PersistResult(services, evaluator, EvaluationScore.Bad, "beta different reasoning");

        var hits = await repo.SearchByEvaluatorAsync(evaluator.Id, "alpha", 20, CancellationToken);

        hits.Should().ContainSingle();
        hits.Single().TestCase.Id.Should().Be(matched.Id);
    }

    [TestMethod]
    public async Task SearchByEvaluator_EmptyQuery_ReturnsAllMatchesForEvaluator()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestResultRepository>();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>().GetOrCreateAsync(CancellationToken);

        await PersistResult(services, evaluator, EvaluationScore.Good, "anything");
        await PersistResult(services, evaluator, EvaluationScore.Bad, "anything else");

        var hits = await repo.SearchByEvaluatorAsync(evaluator.Id, "", 20, CancellationToken);

        hits.Should().HaveCount(2);
    }

    [TestMethod]
    public async Task GetRecentByEvaluator_AfterEvaluatorArchived_StillResolvesHistory()
    {
        // Archiving (soft-delete) keeps the evaluator row, so a prior test result's evaluation —
        // which live-fetches the evaluator by id at map time — must still load.
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestResultRepository>();
        var evaluatorRepo = services.GetRequiredService<IEvaluatorRepository>();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IEvaluator>>().GetOrCreateAsync(CancellationToken);

        await PersistResult(services, evaluator, EvaluationScore.Good, "historical reasoning");

        await evaluatorRepo.ArchiveAsync(evaluator.Id, CancellationToken);

        var results = await repo.GetRecentByEvaluatorAsync(evaluator.Id, 20, cancellationToken: CancellationToken);
        results.Should().ContainSingle();
        results.Single().Evaluations.Should().Contain(e => e.Evaluator.Id == evaluator.Id);
    }

    private async Task<ITestCase> PersistResult(
        IServiceProvider services, IEvaluator evaluator, EvaluationScore score, string? reasoning = null)
    {
        var testCaseGen = services.GetRequiredService<IDomainEntityGenerator<ITestCase>>();
        var completionGen = services.GetRequiredService<IDomainObjectGenerator<ICompletion>>();
        var evalFactory = services.GetRequiredService<IEvaluation.Create>();
        var resultFactory = services.GetRequiredService<ITestResult.CreateNew>();
        var repo = services.GetRequiredService<ITestResultRepository>();

        // Each result needs its own test case — GetRecentByEvaluatorAsync dedupes by test case.
        var testCase = await testCaseGen.CreateAsync(CancellationToken);
        var completion = await completionGen.CreateAsync(CancellationToken);
        var evaluation = evalFactory(evaluator, score, TimeSpan.FromMilliseconds(10), null, null, reasoning);
        var result = resultFactory(testCase, completion, [evaluation]);
        await repo.AddAsync(result, CancellationToken);
        return testCase;
    }
}
