namespace Proxytrace.Domain.ApiKey;

/// <summary>
/// Capabilities granted to an <see cref="IApiKey"/>. A single key may carry several, but they are
/// opt-in: keys default to <see cref="Ingestion"/> only, and every other surface must be granted
/// explicitly (least privilege). The ingestion proxy requires <see cref="Ingestion"/>; the MCP server
/// requires <see cref="McpRead"/>, and its write tools additionally require <see cref="McpWrite"/>;
/// the REST API accepts a key with <see cref="ApiRead"/> for safe (read) requests and additionally
/// requires <see cref="ApiWrite"/> for mutations. Keys are <b>not</b> interchangeable across surfaces:
/// an MCP key cannot drive REST, a REST key cannot drive MCP, and neither can proxy LLM traffic.
/// </summary>
[Flags]
public enum ApiKeyScopes
{
    /// <summary>No capabilities — not a usable key.</summary>
    None = 0,

    /// <summary>Authenticate at the ingestion proxy to capture LLM traffic.</summary>
    Ingestion = 1,

    /// <summary>Read project data over the MCP server (the list/get tools).</summary>
    McpRead = 2,

    /// <summary>Mutate project data over the MCP server (curate suites, start runs, set proposal status).</summary>
    McpWrite = 4,

    /// <summary>Read project data over the REST API (<c>GET</c>/<c>HEAD</c>/<c>OPTIONS</c> requests).</summary>
    ApiRead = 8,

    /// <summary>Mutate project data over the REST API (<c>POST</c>/<c>PUT</c>/<c>PATCH</c>/<c>DELETE</c> requests).</summary>
    ApiWrite = 16,
}
