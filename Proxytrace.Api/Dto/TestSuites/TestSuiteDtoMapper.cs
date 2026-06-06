using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Api.Dto.TestSuites;

/// <summary>
/// Maps <see cref="ITestSuite"/> domain entities to <see cref="TestSuiteDto"/>
/// and converts request DTOs into domain message/conversation values.
/// </summary>
public sealed class TestSuiteDtoMapper
{
    /// <summary>
    /// Maps a suite with no run history (e.g. immediately after create/update).
    /// </summary>
    public TestSuiteDto ToDto(ITestSuite s) => ToDto(s, []);

    /// <summary>
    /// Maps a suite, deriving run aggregates (total runs, pass rate, trend, last run)
    /// from the finalized <paramref name="runRows"/> belonging to that suite.
    /// </summary>
    public TestSuiteDto ToDto(ITestSuite s, IReadOnlyList<TestRunStats> runRows)
    {
        TestRunStats[] ordered = runRows.OrderBy(r => r.RunCompletedAt).ToArray();
        double[] trend = ordered
            .Where(r => r.PassRate.HasValue)
            .Select(r => r.PassRate.GetValueOrDefault() * 100)
            .ToArray();
        TestRunStats? latest = ordered.Length > 0 ? ordered[^1] : null;
        TestRunStats? prev = ordered.Length >= 2 ? ordered[^2] : null;

        return new(
            s.Id,
            s.Name,
            s.Agent.Id,
            s.Agent.Name,
            s.Evaluators.Select(e => new EvaluatorDto(e.Id, e.Kind)).ToArray(),
            s.TestCases.Select(tc => new TestCaseDto(
                tc.Id,
                tc.Input.Messages.Select(ToInputMessageDto).ToArray(),
                ToExpectedOutputDto(tc.ExpectedOutput)
            )).ToArray(),
            Description: null,
            Tags: [],
            TotalRuns: ordered.Length,
            PassRate: latest?.PassRate * 100,
            PrevPassRate: prev?.PassRate * 100,
            PassRateTrend: trend,
            LastRunAt: latest?.RunCompletedAt,
            LastRunGroupId: latest?.GroupId,
            s.CreatedAt,
            s.UpdatedAt);
    }

    public Conversation BuildConversation(IReadOnlyList<TestSuiteMessageDto> messages)
    {
        var msgs = new List<Message>();
        foreach (var m in messages)
        {
            Message msg = m.Role.ToLower() switch
            {
                "user" => new UserMessage([Content.FromText(m.Content)]),
                "assistant" => new AssistantMessage([Content.FromText(m.Content)], []),
                "system" => new SystemMessage([Content.FromText(m.Content)]),
                _ => new UserMessage([Content.FromText(m.Content)])
            };
            msgs.Add(msg);
        }
        return new Conversation(msgs);
    }

    public AssistantMessage BuildAssistantMessage(TestSuiteMessageDto m)
    {
        IReadOnlyList<Content> contents = string.IsNullOrEmpty(m.Content)
            ? []
            : [Content.FromText(m.Content)];
        IReadOnlyList<ToolRequest> toolRequests = (m.ToolRequests ?? [])
            .Select(tr => new ToolRequest(Guid.NewGuid().ToString(), tr.Name, tr.Arguments))
            .ToArray();
        return new AssistantMessage(contents, toolRequests);
    }

    /// <summary>
    /// Maps an input conversation message into its DTO, preserving tool requests (assistant
    /// turns) and tool-call ids (tool result turns) so the UI can pair a tool call with its
    /// response instead of rendering an orphaned result.
    /// </summary>
    private static TestSuiteMessageDto ToInputMessageDto(Message m)
    {
        switch (m)
        {
            case AssistantMessage assistant:
                IReadOnlyList<ToolRequestInputDto>? requests = assistant.ToolRequests.Count > 0
                    ? assistant.ToolRequests.Select(tr => new ToolRequestInputDto(tr.Name, tr.Arguments, tr.Id)).ToArray()
                    : null;
                return new TestSuiteMessageDto("assistant", assistant.GetText(), requests);
            case ToolMessage tool:
                var (id, contents) = tool.Deconstruct();
                var content = string.Concat(contents.Select(c => c.Text ?? ""));
                return new TestSuiteMessageDto("tool", content, null, id);
            default:
                return new TestSuiteMessageDto(m.Role.ToString().ToLower(), m.GetText());
        }
    }

    /// <summary>
    /// Maps an expected assistant response into its DTO, preserving any tool requests.
    /// </summary>
    public TestSuiteMessageDto ToExpectedOutputDto(AssistantMessage expected)
        => new(
            "assistant",
            expected.GetText(),
            expected.ToolRequests.Count > 0
                ? expected.ToolRequests.Select(tr => new ToolRequestInputDto(tr.Name, tr.Arguments)).ToArray()
                : null);
}
