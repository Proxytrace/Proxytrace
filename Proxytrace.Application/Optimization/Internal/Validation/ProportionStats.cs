namespace Proxytrace.Application.Optimization.Internal.Validation;

/// <summary>
/// Small, dependency-free statistics used to judge whether an observed A/B pass-rate
/// difference is meaningful or just sampling noise.
/// </summary>
internal static class ProportionStats
{
    /// <summary>
    /// Two-sided p-value of a two-proportion z-test comparing a baseline run
    /// (<paramref name="baselinePasses"/> of <paramref name="baselineTotal"/>) against a candidate
    /// run (<paramref name="candidatePasses"/> of <paramref name="candidateTotal"/>). Returns null
    /// when either sample is empty or the pooled variance is zero (both runs identical), where a
    /// p-value is undefined.
    /// </summary>
    public static double? TwoSidedPValue(
        int baselinePasses,
        int baselineTotal,
        int candidatePasses,
        int candidateTotal)
    {
        if (baselineTotal <= 0 || candidateTotal <= 0)
            return null;

        double pBaseline = baselinePasses / (double)baselineTotal;
        double pCandidate = candidatePasses / (double)candidateTotal;
        double pPooled = (baselinePasses + candidatePasses) / (double)(baselineTotal + candidateTotal);

        double variance = pPooled * (1 - pPooled) * (1.0 / baselineTotal + 1.0 / candidateTotal);
        if (variance <= 0)
            return null;

        double z = (pCandidate - pBaseline) / Math.Sqrt(variance);
        double p = 2 * (1 - StandardNormalCdf(Math.Abs(z)));

        // Clamp away tiny floating-point excursions outside the valid [0, 1] range.
        return Math.Clamp(p, 0, 1);
    }

    /// <summary>
    /// Cumulative distribution function of the standard normal distribution, via the
    /// Abramowitz &amp; Stegun 7.1.26 error-function approximation (|error| &lt; 1.5e-7).
    /// </summary>
    private static double StandardNormalCdf(double x)
        => 0.5 * (1 + Erf(x / Math.Sqrt(2)));

    private static double Erf(double x)
    {
        int sign = Math.Sign(x);
        x = Math.Abs(x);

        const double a1 = 0.254829592;
        const double a2 = -0.284496736;
        const double a3 = 1.421413741;
        const double a4 = -1.453152027;
        const double a5 = 1.061405429;
        const double p = 0.3275911;

        double t = 1.0 / (1.0 + p * x);
        double y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.Exp(-x * x);

        return sign * y;
    }
}
