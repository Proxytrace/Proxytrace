using Proxytrace.Domain.Message;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Api.Dto.TestSuites;

/// <summary>
/// Maps <see cref="ITestSuite"/> domain entities to <see cref="TestSuiteDto"/>
/// and converts request DTOs into domain message/conversation values.
/// </summary>
public sealed class TestSuiteDtoMapper
{
    public TestSuiteDto ToDto(ITestSuite s) => new(
        s.Id,
        s.Name,
        s.Agent.Id,
        s.Agent.Name,
        s.Evaluators.Select(e => new EvaluatorDto(e.Id, e.Kind)).ToArray(),
        s.TestCases.Select(tc => new TestCaseDto(
            tc.Id,
            tc.Input.Messages.Select(m => new TestSuiteMessageDto(m.Role.ToString().ToLower(), m.GetText())).ToArray(),
            new TestSuiteMessageDto("assistant", tc.ExpectedOutput.GetText())
        )).ToArray(),
        Description: null,
        Tags: [],
        TotalRuns: 0,
        PassRate: null,
        PrevPassRate: null,
        PassRateTrend: [],
        LastRunAt: null,
        LastRunGroupId: null,
        s.CreatedAt,
        s.UpdatedAt);

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
        => new([Content.FromText(m.Content)], []);
}
