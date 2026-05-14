using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Evaluator;

namespace Trsr.Domain.Evaluation.Internal;

internal sealed record Evaluation : IEvaluation
{
    public IEvaluator Evaluator { get; }
    public EvaluationScore? Score { get; }

    public bool Passed =>
        string.IsNullOrWhiteSpace(ErrorMessage)
        && Score is >= EvaluationScore.Acceptable;

    public string? Reasoning { get; }
    public string? ErrorMessage { get; }

    public Evaluation(
        IEvaluator evaluator,
        EvaluationScore score,
        string? reasoning = null)
    {
        Evaluator = evaluator;
        Score = score;
        Reasoning = reasoning;
        ErrorMessage = null;
    }

    public Evaluation(
        IEvaluator evaluator,
        string errorMessage)
    {
        Evaluator = evaluator;
        Score = null;
        Reasoning = null;
        ErrorMessage = errorMessage;
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var validationResult in Evaluator.Validate(validationContext))
        {
            yield return validationResult;
        }

        if (Score.HasValue)
        {
            yield return Validation.Defined(Score.Value);
        }
    }
}