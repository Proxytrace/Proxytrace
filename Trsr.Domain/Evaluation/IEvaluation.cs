using Trsr.Domain.Evaluator;

namespace Trsr.Domain.Evaluation;

public interface IEvaluation : IDomainObject
{
    public delegate IEvaluation Create(
        IEvaluator evaluator,
        EvaluationScore score,
        string? reasoning = null);

    public delegate IEvaluation CreateErrored(
        IEvaluator evaluator,
        string errorMessage);

    /// <summary>
    /// The <see cref="IEvaluator"/>
    /// </summary>
    IEvaluator Evaluator { get; }

    /// <summary>
    /// The score assigned by the evaluator to the test result, based on the evaluation strategy.
    /// Higher is better.
    /// </summary>
    EvaluationScore? Score { get; }

    /// <summary>
    /// Whether the evaluation has passed
    /// </summary>
    bool Passed { get; }

    /// <summary>
    /// A short explanation of the evaluation
    /// </summary>
    string? Reasoning { get; }

    /// <summary>
    /// Error description
    /// </summary>
    string? ErrorMessage { get; }
}
