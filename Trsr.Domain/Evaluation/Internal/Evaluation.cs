using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Evaluator;

namespace Trsr.Domain.Evaluation.Internal;

internal sealed record Evaluation : IEvaluation
{
    public IEvaluator Evaluator { get; }
    public EvaluationScore Score { get; }
    public bool Passed => Score >= EvaluationScore.Acceptable;
    public string? Reasoning { get; }

    public Evaluation(
        IEvaluator evaluator,
        EvaluationScore score,
        string? reasoning = null)
    {
        Evaluator = evaluator;
        Score = score;
        Reasoning = reasoning;
    }
    
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var validationResult in Evaluator.Validate(validationContext))
        {
            yield return validationResult;
        }

        foreach (var __r in Validation.Defined(Score).AsEnumerable()) yield return __r;
    }
}