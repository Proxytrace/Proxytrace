using Proxytrace.Domain.Project;

namespace Proxytrace.Api.Mcp;

/// <summary>
/// Resolves the project an MCP call runs in. An MCP request authenticates with a Proxytrace API key
/// (<see cref="Proxytrace.Domain.ApiKey.IApiKey"/>); the key's project becomes the ambient context for
/// every tool invocation, mirroring how <see cref="Proxytrace.Application.Auth.ICurrentUserAccessor"/>
/// resolves the current user for REST requests.
/// </summary>
internal interface IMcpProjectAccessor
{
    /// <summary>
    /// Returns the project the current MCP request is scoped to.
    /// </summary>
    Task<IProject> GetProjectAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Throws when the current MCP API key was not granted the write scope. Called at the start of
    /// every mutating tool so read-only keys cannot curate suites, start runs or change proposals.
    /// </summary>
    void RequireWriteScope();
}
