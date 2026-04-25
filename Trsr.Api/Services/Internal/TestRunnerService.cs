using System.Text;
using System.Text.Json;
using Trsr.Domain;
using Trsr.Domain.Message;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

namespace Trsr.Api.Services.Internal;

internal class TestRunnerService : ITestRunnerService
{
    private readonly IHttpClientFactory httpClientFactory;
    private readonly IOpenAiCallParser parser;
    private readonly ITestResult.CreateNew createTestResult;
    private readonly ITestRun.CreateNew createTestRun;
    private readonly IRepository<ITestResult> testResultRepository;
    private readonly IRepository<ITestRun> testRunRepository;
    private readonly ILogger<TestRunnerService> logger;

    public TestRunnerService(
        IHttpClientFactory httpClientFactory,
        IOpenAiCallParser parser,
        ITestResult.CreateNew createTestResult,
        ITestRun.CreateNew createTestRun,
        IRepository<ITestResult> testResultRepository,
        IRepository<ITestRun> testRunRepository,
        ILogger<TestRunnerService> logger)
    {
        this.httpClientFactory = httpClientFactory;
        this.parser = parser;
        this.createTestResult = createTestResult;
        this.createTestRun = createTestRun;
        this.testResultRepository = testResultRepository;
        this.testRunRepository = testRunRepository;
        this.logger = logger;
    }

    public async Task<ITestRun> RunAsync(ITestSuite suite, CancellationToken cancellationToken = default)
    {
        var agent = suite.Agent;
        var org = agent.Project.Organization;
        var project = agent.Project;

        var orgName = Uri.EscapeDataString(org.Name);
        var projectName = Uri.EscapeDataString(project.Name);
        var proxyPath = $"{orgName}/{projectName}/openai/v1/chat/completions";

        var results = new List<ITestResult>();

        foreach (var testCase in suite.TestCases)
        {
            var requestBody = BuildRequestBody(testCase.Input, agent.SystemMessage);
            var requestBytes = Encoding.UTF8.GetBytes(requestBody);

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, proxyPath)
            {
                Content = new ByteArrayContent(requestBytes)
            };
            httpRequest.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

            string? responseBody;
            System.Net.HttpStatusCode httpStatus;

            try
            {
                var client = httpClientFactory.CreateClient("self");
                var response = await client.SendAsync(httpRequest, cancellationToken);
                httpStatus = response.StatusCode;
                responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Self-call failed for test case {TestCaseId}", testCase.Id);
                continue;
            }

            if (!parser.TryParse("self", requestBody, responseBody, TimeSpan.Zero, httpStatus, out var parsed))
            {
                logger.LogWarning("Could not parse response for test case {TestCaseId}", testCase.Id);
                continue;
            }

            var evaluation = suite.Evaluator.Evaluate(testCase.ExpectedOutput, parsed.Response)
                ? Evaluation.Pass
                : Evaluation.Fail;

            var testResult = createTestResult(testCase, parsed.Response, evaluation);
            await testResultRepository.AddAsync(testResult, cancellationToken);
            results.Add(testResult);
        }

        var testRun = createTestRun(DateTimeOffset.UtcNow, agent, results);
        await testRunRepository.AddAsync(testRun, cancellationToken);
        return testRun;
    }

    private static string BuildRequestBody(Conversation input, SystemMessage systemMessage)
    {
        var messages = new List<object> { new { role = "system", content = GetText(systemMessage.Contents) } };

        foreach (var message in input.Messages)
        {
            switch (message)
            {
                case UserMessage user:
                    messages.Add(new { role = "user", content = GetText(user.Contents) });
                    break;
                case AssistantMessage assistant:
                    messages.Add(new { role = "assistant", content = GetText(assistant.Contents) });
                    break;
            }
        }

        var body = new Dictionary<string, object>
        {
            ["model"] = "gpt-4o",
            ["messages"] = messages
        };

        return JsonSerializer.Serialize(body);
    }

    private static string GetText(IReadOnlyList<Content> contents)
        => string.Concat(contents.Select(c => c.Text ?? ""));
}
