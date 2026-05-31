using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Project;

namespace Proxytrace.Application.Tracey;

/// <summary>
/// Idempotently ensures a project has its built-in Tracey system agent. Called both by the startup
/// seeder (for existing projects) and by the project-creation path (so new projects get Tracey
/// immediately).
/// </summary>
public interface ITraceyAgentProvisioner
{
    /// <summary>
    /// Returns the project's Tracey agent, creating it from <see cref="ITraceyDefinition"/> if absent.
    /// Safe to call repeatedly.
    /// </summary>
    Task<IAgent> EnsureTraceyAgentAsync(IProject project, CancellationToken cancellationToken = default);
}
