using System.Text.RegularExpressions;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Evaluator.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.Project;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class EvaluatorBehaviorTests : BaseTest<Module>
{
    [TestMethod]
    public async Task JsonSchemaMatch_ValidResponse_ScoresExcellent()
    {
        IServiceProvider services = GetServices();
        var evaluator = await services.GetRequiredService<IDomainEntityGenerator<IJsonSchemaMatchEvaluator>>()
            .CreateAsync(CancellationToken);
        var testResult = BuildResult(actual: """{"name":"foo","age":5}""");

        var concrete = new JsonSchemaMatchEvaluator(
            jsonSchema: """{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}""",
            project: evaluator.Project,
            evaluationFactory: BuildEvaluationFactory(),
            repository: services.GetRequiredService<IRepository<IEvaluator>>());

        var result = await concrete.EvaluateAsync(testResult, CancellationToken);

        result.Should().NotBeNull();
        result.Score.Should().Be(EvaluationScore.Excellent);
    }

    [TestMethod]
    public async Task JsonSchemaMatch_InvalidResponse_ScoresTerrible()
    {
        IServiceProvider services = GetServices();
        var schema = """{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}""";
        var evaluator = new JsonSchemaMatchEvaluator(
            schema,
            await GetProject(services),
            BuildEvaluationFactory(),
            services.GetRequiredService<IRepository<IEvaluator>>());
        var testResult = BuildResult(actual: """{"age":5}""");

        var result = await evaluator.EvaluateAsync(testResult, CancellationToken);

        result.Should().NotBeNull();
        result.Score.Should().Be(EvaluationScore.Terrible);
    }

    [TestMethod]
    public async Task JsonSchemaMatch_NonJsonResponse_ScoresTerrible()
    {
        IServiceProvider services = GetServices();
        var evaluator = new JsonSchemaMatchEvaluator(
            """{"type":"object"}""",
            await GetProject(services),
            BuildEvaluationFactory(),
            services.GetRequiredService<IRepository<IEvaluator>>());
        var testResult = BuildResult(actual: "this is not json {");

        var result = await evaluator.EvaluateAsync(testResult, CancellationToken);

        result.Should().NotBeNull();
        result.Score.Should().Be(EvaluationScore.Terrible);
        result.Reasoning.Should().Contain("not valid JSON");
    }

    [TestMethod]
    public async Task NumericMatch_WithinTolerance_ScoresExcellent()
    {
        IServiceProvider services = GetServices();
        var evaluator = new NumericMatchEvaluator(
            new Regex(@"-?\d+"),
            tolerance: 1m,
            await GetProject(services),
            BuildEvaluationFactory(),
            services.GetRequiredService<IRepository<IEvaluator>>());
        var testResult = BuildResult(expected: "value is 100", actual: "value is 101");

        var result = await evaluator.EvaluateAsync(testResult, CancellationToken);

        result.Should().NotBeNull();
        result.Score.Should().Be(EvaluationScore.Excellent);
    }

    [TestMethod]
    public async Task NumericMatch_OutsideTolerance_ScoresTerrible()
    {
        IServiceProvider services = GetServices();
        var evaluator = new NumericMatchEvaluator(
            new Regex(@"-?\d+"),
            tolerance: 1m,
            await GetProject(services),
            BuildEvaluationFactory(),
            services.GetRequiredService<IRepository<IEvaluator>>());
        var testResult = BuildResult(expected: "value is 100", actual: "value is 200");

        var result = await evaluator.EvaluateAsync(testResult, CancellationToken);

        result.Should().NotBeNull();
        result.Score.Should().Be(EvaluationScore.Terrible);
        result.Reasoning.Should().Contain("delta");
    }

    [TestMethod]
    public async Task NumericMatch_PatternMissesActual_ScoresTerrible()
    {
        IServiceProvider services = GetServices();
        var evaluator = new NumericMatchEvaluator(
            new Regex(@"-?\d+"),
            tolerance: 0.0m,
            await GetProject(services),
            BuildEvaluationFactory(),
            services.GetRequiredService<IRepository<IEvaluator>>());
        var testResult = BuildResult(expected: "42", actual: "no number here");

        var result = await evaluator.EvaluateAsync(testResult, CancellationToken);

        result.Should().NotBeNull();
        result.Score.Should().Be(EvaluationScore.Terrible);
    }

    [TestMethod]
    public async Task NumericMatch_PatternMissesExpected_ReturnsNull()
    {
        IServiceProvider services = GetServices();
        var evaluator = new NumericMatchEvaluator(
            new Regex(@"-?\d+"),
            tolerance: 0.0m,
            await GetProject(services),
            BuildEvaluationFactory(),
            services.GetRequiredService<IRepository<IEvaluator>>());
        var testResult = BuildResult(expected: "no number", actual: "42");

        var result = await evaluator.EvaluateAsync(testResult, CancellationToken);

        result.Should().BeNull();
    }

    [TestMethod]
    public async Task NumericMatch_NegativeNumbersInTolerance_Passes()
    {
        IServiceProvider services = GetServices();
        var evaluator = new NumericMatchEvaluator(
            new Regex(@"-?\d+"),
            tolerance: 5m,
            await GetProject(services),
            BuildEvaluationFactory(),
            services.GetRequiredService<IRepository<IEvaluator>>());
        var testResult = BuildResult(expected: "result -10", actual: "result -12");

        var result = await evaluator.EvaluateAsync(testResult, CancellationToken);

        result.Should().NotBeNull();
        result.Score.Should().Be(EvaluationScore.Excellent);
    }

    [TestMethod]
    public async Task ExactMatch_IdenticalText_PassesWithAcceptable()
    {
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>();
        var evaluator = await generator.CreateAsync(CancellationToken);
        var testResult = BuildResult(expected: "the answer", actual: "the answer");

        var result = await evaluator.EvaluateAsync(testResult, CancellationToken);

        result.Should().NotBeNull();
        result.Score.Should().Be(EvaluationScore.Acceptable);
    }

    [TestMethod]
    public async Task ExactMatch_DifferentText_ScoresTerrible()
    {
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IExactMatchEvaluator>>();
        var evaluator = await generator.CreateAsync(CancellationToken);
        var testResult = BuildResult(expected: "the answer", actual: "the wrong answer");

        var result = await evaluator.EvaluateAsync(testResult, CancellationToken);

        result.Should().NotBeNull();
        result.Score.Should().Be(EvaluationScore.Terrible);
    }

    private static IEvaluation.Create BuildEvaluationFactory()
        => (evaluator, score, reasoning) =>
        {
            var e = Substitute.For<IEvaluation>();
            e.Evaluator.Returns(evaluator);
            e.Score.Returns(score);
            e.Reasoning.Returns(reasoning);
            return e;
        };

    private async Task<IProject> GetProject(IServiceProvider services)
        => await services.GetRequiredService<IDomainEntityGenerator<IProject>>().GetOrCreateAsync(CancellationToken);

    private static ITestResult BuildResult(string actual = "actual", string expected = "expected")
    {
        var testCase = Substitute.For<ITestCase>();
        testCase.ExpectedOutput.Returns(new AssistantMessage([Content.FromText(expected)], []));
        var result = Substitute.For<ITestResult>();
        result.ActualResponse.Returns(new AssistantMessage([Content.FromText(actual)], []));
        result.TestCase.Returns(testCase);
        return result;
    }
}
