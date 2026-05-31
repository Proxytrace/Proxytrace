using Proxytrace.Domain.Tools;

namespace Proxytrace.Application.Tracey.Internal;

/// <summary>
/// The canonical Tracey identity. The tool shapes here mirror
/// <c>frontend/src/features/tracey/tracey-tools.ts</c> one-to-one (single hand-kept source per the
/// design spec); keep both in sync when adding or changing a tool.
/// </summary>
internal sealed class TraceyDefinition : ITraceyDefinition
{
    public string Name => "Tracey";

    public string SystemPrompt =>
        """
        You are Tracey, the in-app assistant for Proxytrace, an AI-agent observability platform.
        You help users understand and act on their data: agents, test suites, test runs, optimization
        proposals, and dashboard statistics.

        How you work:
        - Use the read tools to fetch live state before answering; never invent ids, names, or numbers.
        - When the user wants to see something, use `navigate` to take them there.
        - `start_test_run` and `set_proposal_status` change state. They require explicit user
          confirmation, which the app handles for you — call the tool and surface the result.
        - If a request is ambiguous (e.g. several agents match a name), ask a brief clarifying
          question instead of guessing.
        - Be concise. Prefer short, direct answers and small summaries over long prose.
        """;

    public IReadOnlyList<ToolSpecification> Tools { get; }

    public TraceyDefinition()
    {
        Tools =
        [
            Tool("navigate",
                "Navigate the user to an in-app route (client-side). Use a relative path like '/agents' or '/runs/{id}'.",
                """{"type":"object","properties":{"path":{"type":"string","description":"Relative in-app path, e.g. /agents"}},"required":["path"]}"""),

            Tool("list_agents",
                "List the agents in the current project.",
                EmptyObjectSchema),
            Tool("get_agent",
                "Get a single agent by id.",
                IdSchema("agentId", "The agent id")),

            Tool("list_suites",
                "List the test suites in the current project.",
                EmptyObjectSchema),
            Tool("get_suite",
                "Get a single test suite by id.",
                IdSchema("suiteId", "The test suite id")),

            Tool("list_runs",
                "List recent test runs.",
                EmptyObjectSchema),
            Tool("get_run",
                "Get a single test run by id.",
                IdSchema("runId", "The test run id")),

            Tool("list_proposals",
                "List optimization proposals.",
                EmptyObjectSchema),
            Tool("get_proposal",
                "Get a single optimization proposal by id.",
                IdSchema("proposalId", "The proposal id")),

            Tool("get_dashboard_stats",
                "Get aggregate dashboard statistics for the current project.",
                EmptyObjectSchema),
            Tool("get_agent_stats",
                "Get statistics for a single agent (token usage, costs, latencies).",
                IdSchema("agentId", "The agent id")),

            Tool("start_test_run",
                "Start a test run of a suite against an agent. Requires user confirmation.",
                """{"type":"object","properties":{"suiteId":{"type":"string","description":"The test suite id"},"agentId":{"type":"string","description":"The agent id to run against"}},"required":["suiteId","agentId"]}"""),
            Tool("set_proposal_status",
                "Approve or reject an optimization proposal. Requires user confirmation.",
                """{"type":"object","properties":{"proposalId":{"type":"string","description":"The proposal id"},"status":{"type":"string","enum":["Accepted","Rejected"],"description":"The new status"}},"required":["proposalId","status"]}"""),
        ];
    }

    private const string EmptyObjectSchema = """{"type":"object","properties":{}}""";

    private ToolSpecification Tool(string name, string description, string jsonSchema)
        => new(name, description, ToolArguments.FromJsonSchema(jsonSchema));

    private string IdSchema(string field, string description)
        => "{\"type\":\"object\",\"properties\":{\""
           + field + "\":{\"type\":\"string\",\"description\":\""
           + description + "\"}},\"required\":[\"" + field + "\"]}";
}
