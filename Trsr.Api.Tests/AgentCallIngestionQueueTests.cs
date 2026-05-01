using System.Net;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Services.Internal;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Domain.AgentToolCall;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class AgentCallIngestionQueueTests : BaseTest<Module>
{
    private const string SystemPrompt = "You are a helpful assistant.";
    private const string UserPrompt = "What's the weather in Berlin?";
    private const string ToolCallId = "call_queue_abc";
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
            "id": "chatcmpl-q1",
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
            "id": "chatcmpl-q2",
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

    private async Task<(IModelProvider provider, IProject project)> GetProviderAndProjectAsync(IServiceProvider services)
    {
        var providerGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>();
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var provider = await providerGenerator.GetOrCreateAsync(CancellationToken);
        var project = await projectGenerator.GetOrCreateAsync(CancellationToken);
        return (provider, project);
    }

    [TestMethod]
    public async Task Queue_DrainsContinuationInOrder_MergesIntoSingleAgentCall()
    {
        var services = GetServices();
        var queue = services.GetRequiredService<AgentCallIngestionQueue>();
        var worker = services.GetRequiredService<AgentCallIngestionWorker>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var toolCallRepo = services.GetRequiredService<IAgentToolCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        await queue.EnqueueAsync(provider, project, FirstRequestBody, FirstResponseBody,
            TimeSpan.FromMilliseconds(100), HttpStatusCode.OK, CancellationToken);
        await queue.EnqueueAsync(provider, project, ContinuationRequestBody, ContinuationResponseBody,
            TimeSpan.FromMilliseconds(200), HttpStatusCode.OK, CancellationToken);
        queue.Complete();

        await worker.RunAsync(CancellationToken);

        (await callRepo.CountAsync(CancellationToken)).Should().Be(1);

        var call = await callRepo.FindFirstAsync(CancellationToken);
        call.Should().NotBeNull();
        call.FinishReason.Should().Be("stop");
        call.Usage.InputTokenCount.Should().Be(30);
        call.Usage.OutputTokenCount.Should().Be(13);

        var toolCalls = await toolCallRepo.GetByAgentCallAsync(call.Id, CancellationToken);
        toolCalls.Should().ContainSingle();
        toolCalls[0].Response.Should().NotBeNull();
    }

    [TestMethod]
    public async Task Queue_WhenContinuationEnqueuedBeforeFirstIsProcessed_StillMergesCorrectly()
    {
        // Regression test for the fire-and-forget race: previously the proxy enqueued two HTTP
        // ingestions concurrently, and the second could begin before the first wrote its pending
        // tool-call row, missing the merge. With a single-consumer FIFO queue this can't happen —
        // the worker processes the first job to completion before touching the second.
        var services = GetServices();
        var queue = services.GetRequiredService<AgentCallIngestionQueue>();
        var worker = services.GetRequiredService<AgentCallIngestionWorker>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        // Enqueue both jobs back-to-back with no awaiting between them, mimicking two proxy
        // requests landing in rapid succession.
        var enqueueFirst = queue.EnqueueAsync(provider, project, FirstRequestBody, FirstResponseBody,
            TimeSpan.FromMilliseconds(100), HttpStatusCode.OK, CancellationToken);
        var enqueueSecond = queue.EnqueueAsync(provider, project, ContinuationRequestBody, ContinuationResponseBody,
            TimeSpan.FromMilliseconds(200), HttpStatusCode.OK, CancellationToken);
        await enqueueFirst;
        await enqueueSecond;
        queue.Complete();

        await worker.RunAsync(CancellationToken);

        (await callRepo.CountAsync(CancellationToken)).Should().Be(1);
    }

    [TestMethod]
    public async Task Queue_ProcessesIndependentJobsInEnqueueOrder()
    {
        var services = GetServices();
        var queue = services.GetRequiredService<AgentCallIngestionQueue>();
        var worker = services.GetRequiredService<AgentCallIngestionWorker>();
        var callRepo = services.GetRequiredService<IAgentCallRepository>();
        var (provider, project) = await GetProviderAndProjectAsync(services);

        const int jobCount = 8;
        for (var i = 0; i < jobCount; i++)
        {
            await queue.EnqueueAsync(provider, project, BuildSimpleRequest(i), BuildSimpleResponse(i),
                TimeSpan.FromMilliseconds(10), HttpStatusCode.OK, CancellationToken);
        }
        queue.Complete();

        await worker.RunAsync(CancellationToken);

        (await callRepo.CountAsync(CancellationToken)).Should().Be(jobCount);
    }

    private static string BuildSimpleRequest(int seed) => $$"""
        {
            "model": "{{Model}}",
            "messages": [
                {"role": "system", "content": "{{SystemPrompt}} ({{seed}})"},
                {"role": "user", "content": "Question {{seed}}?"}
            ]
        }
        """;

    private static string BuildSimpleResponse(int seed) => $$"""
        {
            "id": "chatcmpl-bulk-{{seed}}",
            "object": "chat.completion",
            "model": "{{Model}}",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": "Answer {{seed}}."},
                "finish_reason": "stop"
            }],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}
        }
        """;
}
