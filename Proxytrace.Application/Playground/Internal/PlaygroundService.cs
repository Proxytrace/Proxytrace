using System.ComponentModel.DataAnnotations;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Tools;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Application.Playground.Internal;

internal sealed class PlaygroundService : IPlaygroundService
{
    private readonly IRepository<IAgent> agentRepository;
    private readonly IRepository<IModelEndpoint> endpointRepository;

    public PlaygroundService(
        IRepository<IAgent> agentRepository,
        IRepository<IModelEndpoint> endpointRepository)
    {
        this.agentRepository = agentRepository;
        this.endpointRepository = endpointRepository;
    }

    public async IAsyncEnumerable<PlaygroundEvent> CompleteStreamAsync(
        PlaygroundCompleteRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        IAgent? agent = null;
        IModelEndpoint? endpoint = null;
        string? setupError = null;
        try
        {
            agent = await agentRepository.GetAsync(request.AgentId, cancellationToken);
            endpoint = await endpointRepository.GetAsync(request.EndpointId, cancellationToken);
        }
        catch (Exception ex)
        {
            setupError = ex.Message;
        }

        if (setupError != null || agent is null || endpoint is null)
        {
            yield return new ErrorEvent(setupError ?? "agent or endpoint not found");
            yield break;
        }

        SystemMessage systemMessage = new(request.SystemPrompt);
        IReadOnlyList<ToolSpecification> tools = ResolveTools(agent.Tools, request.Tools);
        ModelOptions options = new(endpoint.Model.Name, tools);
        Conversation conversation = BuildConversation(request.Messages);

        IModelClient client = agent.CreateClient(endpoint, skipIngestion: true);

        ulong inputTokens = 0;
        ulong outputTokens = 0;
        ulong cachedInputTokens = 0;
        long latencyMs = 0;
        string? finishReason = null;
        string? streamError = null;

        IAsyncEnumerator<ModelStreamUpdate>? enumerator = null;
        try
        {
            enumerator = client.StreamAsync(systemMessage, conversation, options, cancellationToken)
                .GetAsyncEnumerator(cancellationToken);
        }
        catch (Exception ex)
        {
            streamError = ex.Message;
        }

        if (streamError != null || enumerator is null)
        {
            yield return new ErrorEvent(streamError ?? "failed to start stream");
            yield break;
        }

        try
        {
            while (true)
            {
                ModelStreamUpdate? update = null;
                bool hasNext = false;
                try
                {
                    hasNext = await enumerator.MoveNextAsync();
                    if (hasNext) update = enumerator.Current;
                }
                catch (Exception ex)
                {
                    streamError = ex.Message;
                }

                if (streamError != null) break;
                if (!hasNext || update is null) break;

                switch (update)
                {
                    case TextDelta td:
                        yield return new TokenEvent(td.Text);
                        break;
                    case ToolRequested tr:
                        yield return new ToolRequestEvent(tr.Request.Id, tr.Request.Name, tr.Request.Arguments);
                        break;
                    case Completed done:
                        inputTokens = done.Usage?.InputTokenCount ?? 0;
                        outputTokens = done.Usage?.OutputTokenCount ?? 0;
                        cachedInputTokens = done.Usage?.CachedInputTokenCount ?? 0;
                        latencyMs = (long)done.Latency.TotalMilliseconds;
                        finishReason = done.FinishReason;
                        break;
                }
            }
        }
        finally
        {
            await enumerator.DisposeAsync();
        }

        if (streamError != null)
        {
            yield return new ErrorEvent(streamError);
            yield break;
        }

        decimal? cost = null;
        if (endpoint.InputTokenCost is not null && endpoint.OutputTokenCost is not null && (inputTokens > 0 || outputTokens > 0))
        {
            cost = endpoint.CalculateCost(new TokenUsage(inputTokens, outputTokens, cachedInputTokens));
        }

        yield return new DoneEvent(inputTokens, outputTokens, cachedInputTokens, latencyMs, cost, finishReason);
    }

    /// <summary>
    /// Apply override list onto agent's tools: keep only tools whose name appears in the override,
    /// substitute description and per-arg description from the override.
    /// Tools in the override that don't match an agent tool by name are skipped (no schema available).
    /// </summary>
    private static IReadOnlyList<ToolSpecification> ResolveTools(
        IReadOnlyList<ToolSpecification> agentTools,
        IReadOnlyList<PlaygroundToolSpecification> overrides)
    {
        if (overrides.Count == 0) return [];

        var byName = agentTools.ToDictionary(t => t.Name, StringComparer.Ordinal);
        var result = new List<ToolSpecification>(overrides.Count);

        foreach (var ov in overrides)
        {
            if (!byName.TryGetValue(ov.Name, out var original)) continue;

            var argOverrides = ov.Arguments.ToDictionary(a => a.Name, StringComparer.Ordinal);
            var newArgs = original.Arguments.Arguments
                .Select(arg =>
                    argOverrides.TryGetValue(arg.Name, out var ao) && !string.Equals(ao.Description, arg.Description)
                        ? CloneArgWithDescription(arg, ao.Description)
                        : arg)
                .ToList();

            result.Add(new ToolSpecification(ov.Name, ov.Description, new ToolArguments(newArgs)));
        }

        return result;
    }

    private static IToolArgument CloneArgWithDescription(IToolArgument arg, string? description)
    {
        try
        {
            using var doc = JsonDocument.Parse(arg.JsonSchema);
            var dict = new Dictionary<string, object?>();
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.NameEquals("description")) continue;
                dict[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText());
            }
            if (!string.IsNullOrWhiteSpace(description)) dict["description"] = description;
            var json = JsonSerializer.SerializeToElement(dict);
            return new OverriddenJsonArgument(arg.Name, arg.IsRequired, json);
        }
        catch
        {
            return arg;
        }
    }

    private sealed record OverriddenJsonArgument(string Name, bool IsRequired, JsonElement Json) : IToolArgument
    {
        public string? Description
            => Json.TryGetProperty("description", out var d) && d.ValueKind == JsonValueKind.String ? d.GetString() : null;

        public Type Type => typeof(object);
        public object? DefaultValue => null;
        public string JsonSchema => Json.GetRawText();

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
            => [];
    }

    private static Conversation BuildConversation(IReadOnlyList<PlaygroundMessage> messages)
    {
        var converted = new List<Message>();
        foreach (var m in messages)
        {
            var role = m.Role.ToLowerInvariant();
            if (role == "system") continue; // system message provided separately

            switch (role)
            {
                case "user":
                    converted.Add(Message.CreateUserMessage(m.Content));
                    break;
                case "assistant":
                {
                    IReadOnlyList<Content> contents = string.IsNullOrEmpty(m.Content)
                        ? Array.Empty<Content>()
                        : new[] { Content.FromText(m.Content) };
                    var toolRequests = (m.ToolRequests)
                        .Select(tr => new ToolRequest(tr.Id, tr.Name, tr.Arguments))
                        .ToList();
                    converted.Add(Message.CreateAssistantMessage(contents, toolRequests));
                    break;
                }
                case "tool":
                {
                    var id = m.ToolCallId ?? string.Empty;
                    if (string.IsNullOrEmpty(id)) continue;
                    var request = new ToolRequest(id, "", "{}");
                    ToolResponse response = m.ToolSucceeded
                        ? new ToolResponse(request, [Content.FromText(m.Content)])
                        : new ToolResponse(request, new InvalidOperationException(m.ToolError ?? "tool error"));
                    converted.Add(Message.CreateToolMessage(response));
                    break;
                }
            }
        }
        return new Conversation(converted);
    }
}
