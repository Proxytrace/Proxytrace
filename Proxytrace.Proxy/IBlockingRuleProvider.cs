using Proxytrace.Domain.CustomAnomaly;

namespace Proxytrace.Proxy;

/// <summary>
/// Supplies the enabled blocking detector rules of a project for the proxy hot path. Implementations
/// cache per project (including empty rule lists — most projects have none) and degrade to an empty
/// list when the rules cannot be fetched or the license does not include the feature.
/// </summary>
public interface IBlockingRuleProvider
{
    Task<IReadOnlyList<BlockingDetectorRule>> GetRulesAsync(
        Guid projectId,
        CancellationToken cancellationToken);
}
