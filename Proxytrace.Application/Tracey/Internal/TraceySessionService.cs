using Proxytrace.Domain.Project;

namespace Proxytrace.Application.Tracey.Internal;

internal sealed class TraceySessionService : ITraceySessionService
{
    private readonly ITraceyAgentProvisioner provisioner;

    public TraceySessionService(ITraceyAgentProvisioner provisioner)
    {
        this.provisioner = provisioner;
    }

    public async Task<TraceySessionResult> CreateSessionAsync(IProject project, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(project);

        var traceyAgent = await provisioner.EnsureTraceyAgentAsync(project, cancellationToken);

        return new TraceySessionResult(
            Model: project.SystemEndpoint.Model.Name,
            AgentId: traceyAgent.Id);
    }
}
