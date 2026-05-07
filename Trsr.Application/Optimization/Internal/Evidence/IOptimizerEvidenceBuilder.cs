using Trsr.Domain.TestRun;

namespace Trsr.Application.Optimization.Internal.Evidence;

internal interface IOptimizerEvidenceBuilder
{
    OptimizerEvidence Build(ITestRun run);
}