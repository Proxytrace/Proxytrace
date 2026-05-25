using System.Diagnostics;
using JetBrains.Annotations;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.TestResult;

namespace Proxytrace.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record ExactMatchEvaluator : DomainEntity<IEvaluator>, IExactMatchEvaluator
{
    private readonly IEvaluation.Create evaluationFactory;

    public string Name 
        => "Exact Match";

    public EvaluatorKind Kind
        => EvaluatorKind.ExactMatch;

    public IProject Project { get; }

    public ExactMatchEvaluator(
        IProject project,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        Project = project;
        this.evaluationFactory = evaluationFactory;
    }

    public ExactMatchEvaluator(
        IProject project,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(existing, repository)
    {
        Project = project;
        this.evaluationFactory = evaluationFactory;
    }

    /// <summary>
    /// Evaluates the actual output against the expected output, given the input conversation.
    /// </summary>
    public Task<IEvaluation?> EvaluateAsync(
        ITestResult testResult,
        CancellationToken cancellationToken = default)
    {
        Stopwatch sw = Stopwatch.StartNew();
        var expectedOutput = testResult.TestCase.ExpectedOutput;
        var actualOutput = testResult.ActualResponse;
        var pairs = expectedOutput.Contents.Zip(actualOutput.Contents, (e, a) => (Expected: e, Actual: a));
        var differences = pairs.Where(p => !p.Expected.Equals(p.Actual)).ToArray();

        EvaluationScore score;
        string? reasoning = null;
        if (differences.Length > 0)
        {
            score = EvaluationScore.Terrible;
            reasoning = string.Join(
                Environment.NewLine,
                differences.Select(d => $"Expected '{d.Expected}' but got '{d.Actual}'"));
        }
        else
        {
            score = EvaluationScore.Acceptable;
        }

        IEvaluation evaluation = evaluationFactory(
            this,
            score,
            sw.Elapsed,
            reasoning: reasoning);
        return Task.FromResult<IEvaluation?>(evaluation);
    }
}