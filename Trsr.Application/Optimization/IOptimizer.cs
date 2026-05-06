using Trsr.Domain.Proposal;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization;

public interface IOptimizer
{
    Task<IReadOnlyList<IProposal>> DiscoverOptimizations(ITestRunGroup testRunGroup, CancellationToken cancellationToken = default);
}