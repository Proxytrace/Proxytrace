using System.Net;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Ingestion.Internal;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Domain.AgentToolCall;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Testing;

namespace Trsr.Application.Tests;

[TestClass]
public sealed class AgentCallIngestorTests : BaseTest<Module>
{
    private const string SystemPrompt = "You are a helpful assistant.";
    private const string UserPrompt = "What's the weather in Berlin?";
    private const string ToolCallId = "call_abc123";
    private const string ToolName = "get_weather";
    private const string ToolResult = "Sunny, 25C";
    private const string FinalReply = "It's sunny and 25C in Berlin.";
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

    private const string ContinuationRequestBody = $$"""
                                                     {
                                                         "model": "{{Model}}",
                                                         "messages": [
                                                             {"role": "system", "content": "{{SystemPrompt}}"},
                                                             {"role": "user", "content": "{{UserPrompt}}"},
                                                             {
                                                                 "role": "assistant",
                                                                 "content": null,
                                                                 "tool_calls": [{
                                                                     "id": "{{ToolCallId}}",
                                                                     "type": "function",
                                                                     "function": {"name": "{{ToolName}}", "arguments": "{}"}
                                                                 }]
                                                             },
                                                             {"role": "tool", "tool_call_id": "{{ToolCallId}}", "content": "{{ToolResult}}"}
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

    private const string ContinuationResponseBody = $$"""
                                                      {
                                                          "id": "chatcmpl-2",
                                                          "object": "chat.completion",
                                                          "model": "{{Model}}",
                                                          "choices": [{
                                                              "index": 0,
                                                              "message": {"role": "assistant", "content": "{{FinalReply}}"},
                                                              "finish_reason": "stop"
                                                          }],
                                                          "usage": {"prompt_tokens": 20, "completion_tokens": 8, "total_tokens": 28}
                                                      }
                                                      """;

    // Same conversation but second call has a different system message (tool info stripped), simulating
    // agents that inject tool descriptions into the system message on the first call only.
    private const string ContinuationRequestBodyDifferentSystemMessage = $$"""
                                                                           {
                                                                               "model": "{{Model}}",
                                                                               "messages": [
                                                                                   {"role": "system", "content": "Different system message without tool info"},
                                                                                   {"role": "user", "content": "{{UserPrompt}}"},
                                                                                   {
                                                                                       "role": "assistant",
                                                                                       "content": null,
                                                                                       "tool_calls": [{
                                                                                           "id": "{{ToolCallId}}",
                                                                                           "type": "function",
                                                                                           "function": {"name": "{{ToolName}}", "arguments": "{}"}
                                                                                       }]
                                                                                   },
                                                                                   {"role": "tool", "tool_call_id": "{{ToolCallId}}", "content": "{{ToolResult}}"}
                                                                               ]
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
    public async Task IngestAsync_WhenSingleCallWithToolRequests_CreatesPendingToolCalls()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallIngestor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var toolCallRepo = services.GetRequiredService<IAgentToolCallRepository>();
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

        (await callRepo.CountAsync(CancellationToken)).Should().Be(1);

        var call = await callRepo.FindFirstAsync(CancellationToken);
        call.Should().NotBeNull();

        var toolCalls = await toolCallRepo.GetByAgentCallAsync(call.Id, CancellationToken);
        toolCalls.Should().ContainSingle();
        toolCalls[0].ToolCallId.Should().Be(ToolCallId);
        toolCalls[0].Response.Should().BeNull();
        toolCalls[0].Duration.Should().BeNull();
    }

    [TestMethod]
    public async Task IngestAsync_WhenToolCallContinuation_UpdatesExistingAgentCallAndFillsToolResponse()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallIngestor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var toolCallRepo = services.GetRequiredService<IAgentToolCallRepository>();
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
                RequestBody: ContinuationRequestBody,
                ResponseBody: ContinuationResponseBody,
                Duration: TimeSpan.FromMilliseconds(200),
                HttpStatus: HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        (await callRepo.CountAsync(CancellationToken)).Should().Be(1);

        var call = await callRepo.FindFirstAsync(CancellationToken);
        call.Should().NotBeNull();
        call.Response.Should().NotBeNull();
        call.Response!.Usage!.InputTokenCount.Should().Be(30);
        call.Response.Usage.OutputTokenCount.Should().Be(13);
        call.Response.Latency.Should().Be(TimeSpan.FromMilliseconds(300));
        call.FinishReason.Should().Be("stop");
        call.Response.Response.Contents.Should().ContainSingle()
            .Which.Text.Should().Be(FinalReply);
        call.Request.Messages.Should().HaveCount(4);

        var toolCalls = await toolCallRepo.GetByAgentCallAsync(call.Id, CancellationToken);
        toolCalls.Should().ContainSingle();
        toolCalls[0].ToolCallId.Should().Be(ToolCallId);
        var response = toolCalls[0].Response;
        response.Should().NotBeNull();
        response.Results.Should().ContainSingle()
            .Which.Text.Should().Be(ToolResult);
        toolCalls[0].Duration.Should().NotBeNull();
    }

    [TestMethod]
    public async Task IngestAsync_WhenContinuationHasDifferentSystemMessage_StillMergesIntoExistingAgentCall()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallIngestor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
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
                RequestBody: ContinuationRequestBodyDifferentSystemMessage,
                ResponseBody: ContinuationResponseBody,
                Duration: TimeSpan.FromMilliseconds(100),
                HttpStatus: HttpStatusCode.OK),
            cancellationToken: CancellationToken);

        // Should merge into the same agent call despite the different system message
        (await callRepo.CountAsync(CancellationToken)).Should().Be(1);
    }

    [TestMethod]
    public async Task IngestAsync_WhenSessionIdProvided_GroupsCallsUnderSameConversationId()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallIngestor>();
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
        var ingestion = services.GetRequiredService<AgentCallIngestor>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var agentRepo = services.GetRequiredService<IRepository<Trsr.Domain.Agent.IAgent>>();
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

    [TestMethod]
    public async Task IngestAsync_WhenContinuationDoesNotMatch_CreatesNewAgentCall()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<AgentCallIngestor>();
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