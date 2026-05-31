using System.Net;
using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Application.Ingestion.Internal;
using Proxytrace.Messaging;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Licensing;
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

    // Reasoning models receive the system prompt under the "developer" role (emitted by the AI SDK
    // for Tracey's own calls); the parser must treat it like "system" or the whole call is dropped.
    private const string DeveloperRoleRequestBody = $$"""
                                                      {
                                                          "model": "{{Model}}",
                                                          "messages": [
                                                              {"role": "developer", "content": "{{SystemPrompt}}"},
                                                              {"role": "user", "content": "{{UserPrompt}}"}
                                                          ]
                                                      }
                                                      """;

    [TestMethod]
    public async Task IngestAsync_WhenSystemPromptSentAsDeveloperRole_PersistsCall()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: DeveloperRoleRequestBody,
                ResponseBody: ChatTurn1ResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK,
                SessionId: null),
            cancellationToken: CancellationToken);

        var calls = (await callRepo.GetFilteredAsync(
            new AgentCallFilter { ProjectId = project.Id }, 1, 10, CancellationToken)).Items;
        calls.Should().HaveCount(1);
        calls[0].Version.SystemPrompt.Template.Should().Contain(SystemPrompt);
    }

    // A second request with a *different* system prompt (so its strict fingerprint differs) — used
    // to prove a name-attributed call appends a new version to the same named agent rather than
    // spawning a separate one.
    private const string NamedAgentSecondPromptRequestBody = $$"""
                                                              {
                                                                  "model": "{{Model}}",
                                                                  "messages": [
                                                                      {"role": "system", "content": "You are Tracey, a totally different prompt."},
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

    // A well-formed tool schema (the shared fixtures use a malformed "properties":"{}" that the
    // parser drops) — lets us prove the named agent's version is captured straight from the wire.
    private const string NamedAgentRequestBody = $$"""
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
                                                               "parameters": { "type": "object", "properties": { "city": { "type": "string" } } }
                                                           }
                                                       }]
                                                   }
                                                   """;

    [TestMethod]
    public async Task IngestAsync_WhenAgentNameProvidedAndAgentMissing_CreatesNamedAgentFromWire()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider,
                Project: project,
                RequestBody: NamedAgentRequestBody,
                ResponseBody: FirstResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK,
                SessionId: null,
                AgentName: "Tracey"),
            cancellationToken: CancellationToken);

        var calls = (await callRepo.GetFilteredAsync(
            new AgentCallFilter { ProjectId = project.Id }, 1, 10, CancellationToken)).Items;
        calls.Should().HaveCount(1);
        calls[0].Agent.Name.Should().Be("Tracey");
        // The version is captured from the actual request — the backend mirrors nothing.
        calls[0].Version.Tools.Should().ContainSingle(t => t.Name == ToolName);
    }

    [TestMethod]
    public async Task IngestAsync_WhenAgentNameProvided_AttributesToSameAgentAndBypassesSimilarity()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var agentRepo = services.GetRequiredService<IRepository<IAgent>>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        // First named call creates the "Tracey" agent + v1.
        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider, Project: project,
                RequestBody: FirstRequestBody, ResponseBody: FirstResponseBody,
                Duration: TimeSpan.FromMilliseconds(100), HttpStatus: HttpStatusCode.OK,
                SessionId: null, AgentName: "Tracey"),
            cancellationToken: CancellationToken);

        // Second named call with a different system prompt: a brand-new fingerprint that the
        // similarity matcher would split into its own agent — but name attribution keeps it under
        // the same "Tracey" agent as a new version.
        await ingestion.IngestAsync(
            new IngestJob(
                Provider: provider, Project: project,
                RequestBody: NamedAgentSecondPromptRequestBody, ResponseBody: FirstResponseBody,
                Duration: TimeSpan.FromMilliseconds(100), HttpStatus: HttpStatusCode.OK,
                SessionId: null, AgentName: "Tracey"),
            cancellationToken: CancellationToken);

        (await agentRepo.CountAsync(CancellationToken)).Should().Be(1);

        var calls = (await callRepo.GetFilteredAsync(
            new AgentCallFilter { ProjectId = project.Id }, 1, 10, CancellationToken)).Items;
        calls.Should().HaveCount(2);
        calls[0].Agent.Id.Should().Be(calls[1].Agent.Id);
        calls[0].Version.Id.Should().NotBe(calls[1].Version.Id);
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

    // Distinct system prompt + no tools → a different agent fingerprint than FirstRequestBody.
    private const string SecondAgentRequestBody = $$"""
                                                    {
                                                        "model": "{{Model}}",
                                                        "messages": [
                                                            {"role": "system", "content": "You are a strict math tutor."},
                                                            {"role": "user", "content": "What is 2+2?"}
                                                        ]
                                                    }
                                                    """;

    [TestMethod]
    public async Task IngestAsync_WhenAgentLimitReached_DropsTraceForNewAgent()
    {
        // Default license is Free, which caps non-system agents at 1.
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var agentRepo = services.GetRequiredService<IAgentRepository>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        // First distinct agent: allowed (count 0 < 1).
        await ingestion.IngestAsync(
            new IngestJob(provider, project, FirstRequestBody, FirstResponseBody,
                TimeSpan.FromMilliseconds(100), HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        // Second distinct agent: would be agent #2 → dropped, and its trace with it.
        await ingestion.IngestAsync(
            new IngestJob(provider, project, SecondAgentRequestBody, ChatTurn1ResponseBody,
                TimeSpan.FromMilliseconds(100), HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        (await agentRepo.CountNonSystemAsync(CancellationToken)).Should().Be(1);
        (await callRepo.CountAsync(CancellationToken)).Should().Be(1);
    }

    [TestMethod]
    public async Task IngestAsync_WhenAgentLimitUnlimited_CreatesSecondAgent()
    {
        var services = GetServices(builder =>
        {
            var license = Substitute.For<ILicenseService>();
            license.GetLimit(Arg.Any<LicenseLimit>()).Returns(long.MaxValue);
            builder.RegisterInstance(license).As<ILicenseService>();
        });
        var ingestion = services.GetRequiredService<AgentCallProcessor>();
        var agentRepo = services.GetRequiredService<IAgentRepository>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            new IngestJob(provider, project, FirstRequestBody, FirstResponseBody,
                TimeSpan.FromMilliseconds(100), HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        await ingestion.IngestAsync(
            new IngestJob(provider, project, SecondAgentRequestBody, ChatTurn1ResponseBody,
                TimeSpan.FromMilliseconds(100), HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        (await agentRepo.CountNonSystemAsync(CancellationToken)).Should().Be(2);
        (await callRepo.CountAsync(CancellationToken)).Should().Be(2);
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