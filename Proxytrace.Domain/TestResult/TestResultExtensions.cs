namespace Proxytrace.Domain.TestResult;

/// <summary>
/// Canonical pass/fail definition for a test result, shared by the optimization-theory
/// validators, the stored proposal pass-rates, and the A/B summary shown in the UI — so all
/// three agree. A result passes only when it has at least one evaluation and every evaluation
/// passed (no error and an acceptable score). The "at least one evaluation" guard matters:
/// <c>All()</c> over an empty set is vacuously true, which would otherwise count an
/// unevaluated result as a pass.
/// </summary>
public static class TestResultExtensions
{
    public static bool IsPass(this ITestResult result)
        => result.Evaluations.Count > 0 && result.Evaluations.All(e => e.Passed);
}
