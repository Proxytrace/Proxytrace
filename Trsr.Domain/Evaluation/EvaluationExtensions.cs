namespace Trsr.Domain.Evaluation;

/// <summary>
/// Extemsopms for <see cref="IEvaluation"/>
/// </summary>
internal static class EvaluationExtensions
{
    public static EvaluationScore? CombineScores(this IReadOnlyCollection<IEvaluation> evaluations)
    {
        if (evaluations.Count == 0)
        {
            return null;
        }
        return (EvaluationScore)Math.Round(evaluations.Average(x => (byte)x.Score));
    }
}