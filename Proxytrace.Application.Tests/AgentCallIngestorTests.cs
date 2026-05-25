using System.Net;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Ingestion.Internal;
using Proxytrace.Messaging;
using Proxytrace.Domain;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests;

[TestClass]
public sealed class AgentCallIngestorTests : BaseTest<Module>
{
    private const string SystemPrompt = "You are a helpful assistant.";
    private const string UserPrompt = "What's the weather in Berlin?";
    private const string ToolCallId = "call_abc123";
    private const string ToolName = "get_weather";
    private const string Model = "gpt-4o";

    private const string FirstRequestBody = $$"""
                                              {
                                                  "model": "{{Model}}",
                                                  "messages": [
                                                      {"role": "system", "content": "{{SystemPrompt}}"},
                                                      {"role": "user", "content": "{{UserPrompt}}"}
                                                  ],
                                                  "tools": [{
                                                      "type": "function",
                                                      "function": {
                                                          "name": "{{ToolName}}",
                                                          "description": "Get current weather",
                                                          "parameters": {"type": "object", "properties": "{}"}
                                                      }
                                                  }]
                                              }
                                              """;

    private const string FirstResponseBody = $$"""
                                               {
                                                   "id": "chatcmpl-1",
                                                   "object": "chat.completion",
                                                   "model": "{{Model}}",
                                                   "choices": [{
                                                       "index": 0,
                                                       "message": {
                                                           "role": "assistant",
                                                           "content": null,
                                                           "tool_calls": [{
                                                               "id": "{{ToolCallId}}",
                                                               "type": "function",
                                                               "function": {"name": "{{ToolName}}", "arguments": "{}"}
                                                           }]
                                                       },
                                                       "finish_reason": "tool_calls"
                                                   }],
                                                   "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
                                               }
                                               """;

    // Plain multi-turn chat (no tools) — used for conversation grouping tests
    private const string ChatTurn1RequestBody = $$"""
                                                  {
                                                      "model": "{{Model}}",
                                                      "messages": [
                                                          {"role": "system", "content": "{{SystemPrompt}}"},
                                                          {"role": "user", "content": "What is 2+2?"}
                                                      ],
                                                      "tools": [{
                                                          "type": "function",
                                                          "function": {
                                                              "name": "{{ToolName}}",
                                                              "description": "Get current weather",
                                                              "parameters": {"type": "object", "properties": "{}"}
                                                          }
                                                      }]
                                                  }
                                                  """;

    private const string ChatTurn1ResponseBody = $$"""
                                                   {
                                                       "id": "chatcmpl-4",
                                                       "object": "chat.completion",
                                                       "model": "{{Model}}",
                                                       "choices": [{
                                                           "index": 0,
                                                           "message": {"role": "assistant", "content": "2+2 equals 4."},
                                                           "finish_reason": "stop"
                                                       }],
                                                       "usage": {"prompt_tokens": 15, "completion_tokens": 5, "total_tokens": 20}
                                                   }
                                                   """;

    // Turn 2 — includes the assistant reply from turn 1 in history, no tools re-sent
    private const string ChatTurn2RequestBodyNoTools = $$"""
                                                         {
                                                             "model": "{{Model}}",
                                                             "messages": [
                                                                 {"role": "system", "content": "{{SystemPrompt}}"},
                                                                 {"role": "user", "content": "What is 2+2?"},
                                                                 {"role": "assistant", "content": "2+2 equals 4."},
                                                                 {"role": "user", "content": "What about 3+3?"}
                                                             ]
                                                         }
                                                         """;

    private const string ChatTurn2ResponseBody = $$"""
                                                   {
                                                       "id": "chatcmpl-5",
                                                       "object": "chat.completion",
                                                       "model": "{{Model}}",
                                                       "choices": [{
                                                           "index": 0,
                                                           "message": {"role": "assistant", "content": "3+3 equals 6."},
                                                           "finish_reason": "stop"
                                                       }],
                                                       "usage": {"prompt_tokens": 20, "completion_tokens": 5, "total_tokens": 25}
                                                   }
                                                   """;

    private const string UnrelatedRequestBody = $$"""
                                                  {
                                                      "model": "{{Model}}",
                                                      "messages": [
                                                          {"role": "system", "content": "{{SystemPrompt}}"},
                                                          {"role": "user", "content": "Tell me a joke."}
                                                      ],
                                                      "tools": [{
                                                          "type": "function",
                                                          "function": {
                                                              "name": "{{ToolName}}",
                                                              "description": "Get current weather",
                                                              "parameters": {"type": "object", "properties": "{}"}
                                                          }
                                                      }]
                                                  }
                                                  """;

    private const string UnrelatedResponseBody = $$"""
                                                   {
                                                       "id": "chatcmpl-3",
                                                       "object": "chat.completion",
                                                       "model": "{{Model}}",
                                                       "choices": [{
                                                           "index": 0,
                                                           "message": {"role": "assistant", "content": "Why did the chicken cross the road?"},
                                                           "finish_reason": "stop"
                                                       }],
                                                       "usage": {"prompt_tokens": 7, "completion_tokens": 9, "total_tokens": 16}
                                                   }
                                                   """;

    private async Task<(IModelProvider provider, IProject project)> GetProviderAndProjectAsync(
        IServiceProvider services)
    {
        var providerGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>();
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var provider = await providerGenerator.GetOrCreateAsync(CancellationToken);
        var project = await projectGenerator.GetOrCreateAsync(CancellationToken);
        return (provider, project);
    }

    [TestMethod]
    public async Task Worker_ConsumesPublishedMessage_RehydratesProviderAndProject_AndPersistsCall()
    {
        var services = GetServices();
        var stream = services.GetRequiredService<IIngestionStream>();
        var worker = services.GetRequiredService<AgentCallIngestionWorker>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await worker.StartAsync(CancellationToken);
        try
        {
            // Producer side ships only ids; the worker must re-hydrate the provider/project.
            await stream.PublishAsync(
                new IngestMessage(
                    ProviderId: provider.Id,
                    ProjectId: project.Id,
                    RequestBody: ChatTurn1RequestBody,
                    ResponseBody: ChatTurn1ResponseBody,
                    DurationMs: 100,
                    HttpStatus: (int)HttpStatusCode.OK,
                    SessionId: null),
                CancellationToken);

            await WaitUntilAsync(async () => await callRepo.CountAsync(CancellationToken) == 1);
        }
        finally
        {
            await worker.StopAsync(CancellationToken);
        }

        var calls = (await callRepo.GetFilteredAsync(
            new AgentCallFilter { ProjectId = project.Id }, 1, 10, CancellationToken)).Items;
        calls.Should().HaveCount(1);
        calls[0].Endpoint.Provider.Id.Should().Be(provider.Id);
    }

    private async Task WaitUntilAsync(Func<Task<bool>> condition)
    {
        var deadline = DateTimeOffset.UtcNow.AddSeconds(5);
        while (DateTimeOffset.UtcNow < deadline)
        {
            if (await condition())
            {
                return;
            }

            await Task.Delay(50, CancellationToken);
        }

        throw new TimeoutException("Condition not met within the timeout.");
    }

    [TestMethod]
    public async Task IngestAsync_WhenSessionIdProvided_GroupsCallsUnderSameConversationId()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);
        var sessionId = Guid.NewGuid().ToString();

        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: ChatTurn1RequestBody,
                ResponseBody: ChatTurn1ResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK,
                SessionId: sessionId),
            cancellationToken: CancellationToken);

        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: ChatTurn2RequestBodyNoTools,
                ResponseBody: ChatTurn2ResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK,
                SessionId: sessionId),
            cancellationToken: CancellationToken);

        (await callRepo.CountAsync(CancellationToken)).Should().Be(2);

        var calls = (await callRepo.GetFilteredAsync(
            new AgentCallFilter { ProjectId = project.Id }, 1, 10, CancellationToken)).Items;

        var sharedConversationId = calls[0].ConversationId;
        sharedConversationId.Should().NotBeNull();
        calls[1].ConversationId.Should().Be(sharedConversationId);
    }

    [TestMethod]
    public async Task IngestAsync_WhenSessionIdAndToolsNotResent_InheritsAgentFromPriorCall()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var agentRepo = services.GetRequiredService<IRepository<Proxytrace.Domain.Agent.IAgent>>();
        var (provider, project) = await GetProviderAndProjectAsync(services);
        var sessionId = Guid.NewGuid().ToString();

        // Turn 1: request includes tool definitions → creates agent A
        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: ChatTurn1RequestBody,
                ResponseBody: ChatTurn1ResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK,
                SessionId: sessionId),
            cancellationToken: CancellationToken);

        // Turn 2: same session, no tools re-sent → should reuse agent A (not create agent B)
        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: ChatTurn2RequestBodyNoTools,
                ResponseBody: ChatTurn2ResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK,
                SessionId: sessionId),
            cancellationToken: CancellationToken);

        // There should be exactly one agent (not two)
        (await agentRepo.CountAsync(CancellationToken)).Should().Be(1);

        var calls = (await callRepo.GetFilteredAsync(
            new AgentCallFilter { ProjectId = project.Id }, 1, 10, CancellationToken)).Items;
        calls[0].Agent.Id.Should().Be(calls[1].Agent.Id);
    }

    private const string RequestWithModelParameters = $$"""
                                                        {
                                                            "model": "{{Model}}",
                                                            "messages": [
                                                                {"role": "system", "content": "{{SystemPrompt}}"},
                                                                {"role": "user", "content": "{{UserPrompt}}"}
                                                            ],
                                                            "tools": [{
                                                                "type": "function",
                                                                "function": {
                                                                    "name": "{{ToolName}}",
                                                                    "description": "Get current weather",
                                                                    "parameters": {"type": "object", "properties": "{}"}
                                                                }
                                                            }],
                                                            "temperature": 0.2,
                                                            "top_p": 0.9,
                                                            "reasoning_effort": "high",
                                                            "frequency_penalty": 0.1,
                                                            "presence_penalty": 0.2,
                                                            "max_tokens": 512,
                                                            "seed": 42,
                                                            "stop": ["END"],
                                                            "n": 1
                                                        }
                                                        """;

    private const string RequestWithDifferentTemperature = $$"""
                                                             {
                                                                 "model": "{{Model}}",
                                                                 "messages": [
                                                                     {"role": "system", "content": "{{SystemPrompt}}"},
                                                                     {"role": "user", "content": "{{UserPrompt}}"}
                                                                 ],
                                                                 "tools": [{
                                                                     "type": "function",
                                                                     "function": {
                                                                         "name": "{{ToolName}}",
                                                                         "description": "Get current weather",
                                                                         "parameters": {"type": "object", "properties": "{}"}
                                                                     }
                                                                 }],
                                                                 "temperature": 0.7,
                                                                 "top_p": 0.9,
                                                                 "reasoning_effort": "high",
                                                                 "frequency_penalty": 0.1,
                                                                 "presence_penalty": 0.2,
                                                                 "max_tokens": 512,
                                                                 "seed": 42,
                                                                 "stop": ["END"],
                                                                 "n": 1
                                                             }
                                                             """;

    [TestMethod]
    public async Task IngestAsync_WithModelParameters_StoresParametersOnAgentAndCall()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: RequestWithModelParameters,
                ResponseBody: FirstResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        var calls = (await callRepo.GetFilteredAsync(
            new AgentCallFilter { ProjectId = project.Id }, 1, 10, CancellationToken)).Items;

        calls.Should().HaveCount(1);
        var call = calls[0];

        call.ModelParameters.Temperature.Should().Be(0.2);
        call.ModelParameters.TopP.Should().Be(0.9);
        call.ModelParameters.ReasoningEffort.Should().Be("high");
        call.ModelParameters.FrequencyPenalty.Should().Be(0.1);
        call.ModelParameters.PresencePenalty.Should().Be(0.2);
        call.ModelParameters.MaxTokens.Should().Be(512);
        call.ModelParameters.Seed.Should().Be(42);
        call.ModelParameters.Stop.Should().BeEquivalentTo(new[] { "END" });
        call.ModelParameters.N.Should().Be(1);

        call.Agent.ModelParameters.Temperature.Should().Be(0.2);
    }

    [TestMethod]
    public async Task IngestAsync_WhenParametersChange_UpdatesAgentParameters_ButFingerprintUnchanged()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var agentRepo = services.GetRequiredService<Proxytrace.Domain.Agent.IAgentRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: RequestWithModelParameters,
                ResponseBody: FirstResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: RequestWithDifferentTemperature,
                ResponseBody: FirstResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        (await agentRepo.CountAsync(CancellationToken)).Should().Be(1);

        var calls = (await callRepo.GetFilteredAsync(
            new AgentCallFilter { ProjectId = project.Id }, 1, 10, CancellationToken)).Items;

        calls.Should().HaveCount(2);
        calls[0].Agent.Id.Should().Be(calls[1].Agent.Id);

        var fpFirst = agentRepo.GetAgentFingerprint(calls[0].Agent);
        var fpSecond = agentRepo.GetAgentFingerprint(calls[1].Agent);
        fpFirst.Should().Be(fpSecond);

        var perCallTemps = calls.Select(c => c.ModelParameters.Temperature).ToHashSet();
        perCallTemps.Should().BeEquivalentTo(new double?[] { 0.2, 0.7 });

        var refreshed = await agentRepo.GetAsync(calls[0].Agent.Id, CancellationToken);
        refreshed.ModelParameters.Temperature.Should().Be(0.7);
    }

    [TestMethod]
    public async Task IngestAsync_WhenParametersUnchanged_DoesNotUpdateAgent()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var agentRepo = services.GetRequiredService<Proxytrace.Domain.Agent.IAgentRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            new IngestJob(provider, project, RequestWithModelParameters, FirstResponseBody,
                TimeSpan.FromMilliseconds(100), HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        var afterFirst = (await agentRepo.GetAllAsync(CancellationToken)).Single();
        var firstUpdatedAt = afterFirst.UpdatedAt;

        await ingestion.IngestAsync(
            new IngestJob(provider, project, RequestWithModelParameters, FirstResponseBody,
                TimeSpan.FromMilliseconds(100), HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        var afterSecond = (await agentRepo.GetAllAsync(CancellationToken)).Single();
        afterSecond.UpdatedAt.Should().Be(firstUpdatedAt);
    }

    [TestMethod]
    public async Task IngestAsync_WhenParametersAbsent_AgentParametersAreEmpty()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            new IngestJob(provider, project, FirstRequestBody, FirstResponseBody,
                TimeSpan.FromMilliseconds(100), HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        var calls = (await callRepo.GetFilteredAsync(
            new AgentCallFilter { ProjectId = project.Id }, 1, 10, CancellationToken)).Items;

        calls.Should().HaveCount(1);
        calls[0].ModelParameters.Temperature.Should().BeNull();
        calls[0].ModelParameters.TopP.Should().BeNull();
        calls[0].ModelParameters.MaxTokens.Should().BeNull();
        calls[0].Agent.ModelParameters.Temperature.Should().BeNull();
    }

    [TestMethod]
    public async Task IngestAsync_WhenContinuationDoesNotMatch_CreatesNewAgentCall()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var repository = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: FirstRequestBody,
                ResponseBody: FirstResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: UnrelatedRequestBody,
                ResponseBody: UnrelatedResponseBody,
                Duration: TimeSpan.FromMilliseconds(150),
                HttpStatus: HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        var count = await repository.CountAsync(CancellationToken);
        count.Should().Be(2);
    }
}