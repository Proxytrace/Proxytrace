namespace Proxytrace.Domain.Evaluation;

/// <summary>
/// Extemsopms for <see cref="IEvaluation"/>
/// </summary>
internal static class EvaluationExtensions
{
    public static EvaluationScore? CombineScores(this IReadOnlyCollection<IEvaluation> evaluations)
    {
        var scored = evaluations
            .Where(x => x is { ErrorMessage: null, Score: not null })
            .Select(x => (byte)(x.Score ?? 0))
            .ToArray();

        if (scored.Length == 0)
        {
            return null;
        }
        return (EvaluationScore)Math.Round(scored.Average(b => (double)b));
    }
}