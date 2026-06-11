using Proxytrace.Domain.Project;

namespace Proxytrace.Application.Evaluator;

/// <summary>
/// Ensures a project has its built-in default evaluators: one Exact Match evaluator and one agentic
/// evaluator per registered preset (see <see cref="IAgenticEvaluatorPresets"/>). Idempotent and
/// tier-independent — agentic defaults are always created; the <c>AgenticEvaluators</c> license
/// feature gates their <em>use</em> (suite editor UI + test-run execution), not their existence.
/// </summary>
public interface IDefaultEvaluatorProvisioner
{
    Task EnsureDefaultEvaluatorsAsync(IProject project, CancellationToken cancellationToken = default);
}
