using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Proxytrace.Api.Dto.TestSuites;
using Proxytrace.Api.Mcp;
using Proxytrace.Api.Mcp.Tools;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.AuditLog;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.TestCase;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Licensing;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests.Mcp;

[TestClass]
public sealed class SuiteToolsTests : BaseTest<Module>
{
    private sealed class StubProjectAccessor : IMcpProjectAccessor
    {
        private readonly IProject project;

        public StubProjectAccessor(IProject project)
        {
            this.project = project;
        }

        public Task<IProject> GetProjectAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(project);

        // Write scope granted — these tests exercise the mutating tool's behavior, not the scope guard.
        public void RequireWriteScope()
        {
        }
    }

    [TestMethod]
    public async Task AddTraceToSuite_WithExpectedOutput_RecordsCorrectionAndKeepsSourceLink()
    {
        IServiceProvider services = GetServices();
        var (suite, call) = await SeedSuiteAndTraceAsync(services);
        var tools = BuildTools(services, call.Agent.Project);

        var result = await tools.AddTraceToSuite(suite.Id, call.Id, "The corrected answer", CancellationToken);

        var added = result.TestCases.Should().ContainSingle().Subject;
        added.SourceAgentCallId.Should().Be(call.Id);
        added.ExpectedOutput.Content.Should().Be("The corrected answer");
    }

    [TestMethod]
    public async Task AddTraceToSuite_WithoutExpectedOutput_PromotesAsIsWithSourceLink()
    {
        IServiceProvider services = GetServices();
        var (suite, call) = await SeedSuiteAndTraceAsync(services);
        var tools = BuildTools(services, call.Agent.Project);

        var result = await tools.AddTraceToSuite(suite.Id, call.Id, expectedOutput: null, CancellationToken);

        var added = result.TestCases.Should().ContainSingle().Subject;
        // Straight promotion: expected output is the recorded response, and the source link is preserved.
        added.SourceAgentCallId.Should().Be(call.Id);
        var response = call.Response ?? throw new InvalidOperationException("generated call must have a response");
        added.ExpectedOutput.Content.Should().Be(response.Response.GetText());
    }

    private static async Task<(ITestSuite Suite, IAgentCall Call)> SeedSuiteAndTraceAsync(IServiceProvider services)
    {
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync();
        var createEvaluator = services.GetRequiredService<IExactMatchEvaluator.CreateNew>();
        var evaluator = await services.GetRequiredService<IEvaluatorRepository>()
            .AddAsync(createEvaluator(call.Agent.Project));
        var createSuite = services.GetRequiredService<ITestSuite.CreateNew>();
        var suite = await services.GetRequiredService<ITestSuiteRepository>()
            .AddAsync(createSuite("Suite", call.Agent, [evaluator], []));
        return (suite, call);
    }

    private static SuiteTools BuildTools(IServiceProvider services, IProject project)
        => new(
            new StubProjectAccessor(project),
            services.GetRequiredService<ITestSuiteRepository>(),
            services.GetRequiredService<IAgentRepository>(),
            services.GetRequiredService<IAgentCallRepository>(),
            services.GetRequiredService<ITestCaseRepository>(),
            services.GetRequiredService<IEvaluatorRepository>(),
            services.GetRequiredService<ITestCase.CreateNewFromCall>(),
            services.GetRequiredService<ITestCase.CreateCorrection>(),
            services.GetRequiredService<IExactMatchEvaluator.CreateNew>(),
            services.GetRequiredService<ITestSuite.CreateNew>(),
            services.GetRequiredService<ITestSuite.CreateExisting>(),
            services.GetRequiredService<TestSuiteDtoMapper>(),
            services.GetRequiredService<ILicenseService>(),
            NullLogger<Audit>.Instance);
}
