using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Domain.User;

// ReSharper disable InconsistentNaming

namespace Proxytrace.Application.Demo;

internal sealed class DemoSeedContext
{
    public IUser? DemoUser { get; set; }
    public IProject? Project { get; set; }

    public IModelEndpoint? Gpt4oEndpoint { get; set; }
    public IModelEndpoint? Gpt4oMiniEndpoint { get; set; }
    public IModelEndpoint? ClaudeEndpoint { get; set; }

    public IAgent? CustomerSupportAgent { get; set; }
    public IAgent? CodeReviewAgent { get; set; }
    public IAgent? DataAnalyticsAgent { get; set; }
    public IAgent? EmailTriageAgent { get; set; }

    public IAgenticEvaluator? Helpfulness { get; set; }
    public IAgenticEvaluator? Politeness { get; set; }

    public Dictionary<string, ITestSuite> SuitesByKey { get; } = new();
    public List<ITestRun> AllRuns { get; } = [];

    /// <summary>
    /// System A/B candidate runs seeded per agent id, so validated/invalidated theories and
    /// proposals can reference a real (hidden) A/B test run instead of a user-facing one.
    /// </summary>
    public Dictionary<Guid, ITestRun> AbCandidateRunsByAgent { get; } = new();

    /// <summary>
    /// The freshly regressed triage run group and the endpoint-down tone group — shaped so the
    /// real anomaly detector fires on them during seeding.
    /// </summary>
    public ITestRunGroup? RegressedTriageGroup { get; set; }
    public ITestRunGroup? FailedToneGroup { get; set; }

    public IUser RequireDemoUser() => DemoUser ?? throw Missing(nameof(DemoUser));
    public IProject RequireProject() => Project ?? throw Missing(nameof(Project));
    public IModelEndpoint RequireGpt4oEndpoint() => Gpt4oEndpoint ?? throw Missing(nameof(Gpt4oEndpoint));
    public IModelEndpoint RequireGpt4oMiniEndpoint() => Gpt4oMiniEndpoint ?? throw Missing(nameof(Gpt4oMiniEndpoint));
    public IModelEndpoint RequireClaudeEndpoint() => ClaudeEndpoint ?? throw Missing(nameof(ClaudeEndpoint));
    public IAgent RequireCustomerSupportAgent() => CustomerSupportAgent ?? throw Missing(nameof(CustomerSupportAgent));
    public IAgent RequireCodeReviewAgent() => CodeReviewAgent ?? throw Missing(nameof(CodeReviewAgent));
    public IAgent RequireDataAnalyticsAgent() => DataAnalyticsAgent ?? throw Missing(nameof(DataAnalyticsAgent));
    public IAgent RequireEmailTriageAgent() => EmailTriageAgent ?? throw Missing(nameof(EmailTriageAgent));
    public ITestRunGroup RequireRegressedTriageGroup() => RegressedTriageGroup ?? throw Missing(nameof(RegressedTriageGroup));
    public ITestRunGroup RequireFailedToneGroup() => FailedToneGroup ?? throw Missing(nameof(FailedToneGroup));
    public IAgenticEvaluator RequireHelpfulness() => Helpfulness ?? throw Missing(nameof(Helpfulness));
    public IAgenticEvaluator RequirePoliteness() => Politeness ?? throw Missing(nameof(Politeness));

    private static InvalidOperationException Missing(string name)
        => new($"DemoSeedContext.{name} was not populated. Make sure the earlier scenarios ran first.");
}
