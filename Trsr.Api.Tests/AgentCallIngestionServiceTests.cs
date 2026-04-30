using System.Net;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Services;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Domain.AgentToolCall;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class AgentCallIngestionServiceTests : BaseTest<Module>
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
                    "parameters": {"type": "object", "properties": {}}
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
                    "parameters": {"type": "object", "properties": {}}
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
                    "parameters": {"type": "object", "properties": {}}
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

    private async Task<(IModelProvider provider, IProject project)> GetProviderAndProjectAsync(IServiceProvider services)
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
        var ingestion = services.GetRequiredService<IAgentCallIngestionService>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var toolCallRepo = services.GetRequiredService<IAgentToolCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            provider: provider,
            project: project,
            requestBody: FirstRequestBody,
            responseBody: FirstResponseBody,
            duration: TimeSpan.FromMilliseconds(100),
            httpStatus: HttpStatusCode.OK,
            cancellationToken: CancellationToken);

        (await callRepo.CountAsync(CancellationToken)).Should().Be(1);

        var call = await callRepo.FindFirstAsync(CancellationToken);
        var toolCalls = await toolCallRepo.GetByAgentCallAsync(call!.Id, CancellationToken);
        toolCalls.Should().ContainSingle();
        toolCalls[0].ToolCallId.Should().Be(ToolCallId);
        toolCalls[0].Response.Should().BeNull();
        toolCalls[0].Duration.Should().BeNull();
    }

    [TestMethod]
    public async Task IngestAsync_WhenToolCallContinuation_UpdatesExistingAgentCallAndFillsToolResponse()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<IAgentCallIngestionService>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var toolCallRepo = services.GetRequiredService<IAgentToolCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            provider: provider,
            project: project,
            requestBody: FirstRequestBody,
            responseBody: FirstResponseBody,
            duration: TimeSpan.FromMilliseconds(100),
            httpStatus: HttpStatusCode.OK,
            cancellationToken: CancellationToken);

        await ingestion.IngestAsync(
            provider: provider,
            project: project,
            requestBody: ContinuationRequestBody,
            responseBody: ContinuationResponseBody,
            duration: TimeSpan.FromMilliseconds(200),
            httpStatus: HttpStatusCode.OK,
            cancellationToken: CancellationToken);

        (await callRepo.CountAsync(CancellationToken)).Should().Be(1);

        var call = await callRepo.FindFirstAsync(CancellationToken);
        call.Should().NotBeNull();
        call!.Usage.InputTokenCount.Should().Be(30);
        call.Usage.OutputTokenCount.Should().Be(13);
        call.Duration.Should().Be(TimeSpan.FromMilliseconds(300));
        call.FinishReason.Should().Be("stop");
        call.Response.Contents.Should().ContainSingle()
            .Which.Text.Should().Be(FinalReply);
        call.Request.Messages.Should().HaveCount(4);

        var toolCalls = await toolCallRepo.GetByAgentCallAsync(call.Id, CancellationToken);
        toolCalls.Should().ContainSingle();
        toolCalls[0].ToolCallId.Should().Be(ToolCallId);
        toolCalls[0].Response.Should().NotBeNull();
        toolCalls[0].Response!.Results.Should().ContainSingle()
            .Which.Text.Should().Be(ToolResult);
        toolCalls[0].Duration.Should().NotBeNull();
    }

    [TestMethod]
    public async Task IngestAsync_WhenContinuationDoesNotMatch_CreatesNewAgentCall()
    {
        var services = GetServices();
        var ingestion = services.GetRequiredService<IAgentCallIngestionService>();
        var repository = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await ingestion.IngestAsync(
            provider: provider,
            project: project,
            requestBody: FirstRequestBody,
            responseBody: FirstResponseBody,
            duration: TimeSpan.FromMilliseconds(100),
            httpStatus: HttpStatusCode.OK,
            cancellationToken: CancellationToken);

        await ingestion.IngestAsync(
            provider: provider,
            project: project,
            requestBody: UnrelatedRequestBody,
            responseBody: UnrelatedResponseBody,
            duration: TimeSpan.FromMilliseconds(150),
            httpStatus: HttpStatusCode.OK,
            cancellationToken: CancellationToken);

        var count = await repository.CountAsync(CancellationToken);
        count.Should().Be(2);
    }
}
