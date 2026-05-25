using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.TestRun;
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

    public IAgenticEvaluator? Helpfulness { get; set; }
    public IAgenticEvaluator? Politeness { get; set; }

    public Dictionary<string, ITestSuite> SuitesByKey { get; } = new();
    public List<ITestRun> AllRuns { get; } = [];

    public IUser RequireDemoUser() => DemoUser ?? throw Missing(nameof(DemoUser));
    public IProject RequireProject() => Project ?? throw Missing(nameof(Project));
    public IModelEndpoint RequireGpt4oEndpoint() => Gpt4oEndpoint ?? throw Missing(nameof(Gpt4oEndpoint));
    public IModelEndpoint RequireGpt4oMiniEndpoint() => Gpt4oMiniEndpoint ?? throw Missing(nameof(Gpt4oMiniEndpoint));
    public IModelEndpoint RequireClaudeEndpoint() => ClaudeEndpoint ?? throw Missing(nameof(ClaudeEndpoint));
    public IAgent RequireCustomerSupportAgent() => CustomerSupportAgent ?? throw Missing(nameof(CustomerSupportAgent));
    public IAgent RequireCodeReviewAgent() => CodeReviewAgent ?? throw Missing(nameof(CodeReviewAgent));
    public IAgent RequireDataAnalyticsAgent() => DataAnalyticsAgent ?? throw Missing(nameof(DataAnalyticsAgent));
    public IAgenticEvaluator RequireHelpfulness() => Helpfulness ?? throw Missing(nameof(Helpfulness));
    public IAgenticEvaluator RequirePoliteness() => Politeness ?? throw Missing(nameof(Politeness));

    private static InvalidOperationException Missing(string name)
        => new($"DemoSeedContext.{name} was not populated. Make sure CoreSeedScenario ran first.");
}
