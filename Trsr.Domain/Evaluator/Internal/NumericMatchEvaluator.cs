using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using JetBrains.Annotations;
using Trsr.Common.Validation;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record NumericMatchEvaluator : DomainEntity<IEvaluator>, INumericMatchEvaluator
{
    private readonly IEvaluation.Create evaluationFactory;

    public EvaluatorKind Kind
        => EvaluatorKind.NumericMatch;

    public Regex ExtractionPattern { get; }
    public decimal Tolerance { get; }

    public NumericMatchEvaluator(
        Regex extractionPattern,
        decimal tolerance,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        ExtractionPattern = extractionPattern;
        Tolerance = tolerance;
        this.evaluationFactory = evaluationFactory;
    }

    public NumericMatchEvaluator(
        Regex extractionPattern,
        decimal tolerance,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(existing, repository)
    {
        ExtractionPattern = extractionPattern;
        Tolerance = tolerance;
        this.evaluationFactory = evaluationFactory;
    }

    public Task<IEvaluation?> EvaluateAsync(
        ITestResult testResult,
        CancellationToken cancellationToken = default)
    {
        var expectedText = testResult.TestCase.ExpectedOutput.GetTextResponse();
        var expectedMatch = ExtractionPattern.Match(expectedText);
        if (!expectedMatch.Success || !decimal.TryParse(expectedMatch.Value, out var expected))
            return Task.FromResult<IEvaluation?>(null);
        
        var actualText = testResult.ActualResponse.GetTextResponse();
        var actualMatch = ExtractionPattern.Match(actualText);

        EvaluationScore score;
        string? reasoning = null;

        if (!actualMatch.Success)
        {
            score = EvaluationScore.Terrible;
            reasoning = "Actual response did not match the extraction pattern.";
        }
        else if (!decimal.TryParse(actualMatch.Value, out var actual))
        {
            score = EvaluationScore.Terrible;
            reasoning = $"Could not parse actual value '{actualMatch.Value}' as a number.";
        }
        else
        {
            var delta = Math.Abs(actual - expected);
            if (delta <= Tolerance)
            {
                score = EvaluationScore.Excellent;
            }
            else
            {
                score = EvaluationScore.Terrible;
                reasoning = $"Expected {expected} ± {Tolerance} but got {actual} (delta: {delta}).";
            }
        }

        return Task.FromResult<IEvaluation?>(evaluationFactory(this, score, reasoning));
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        yield return Validation.NotNull(ExtractionPattern, nameof(ExtractionPattern));
        yield return Validation.NotDefault(Tolerance, nameof(Tolerance));
    }
}
