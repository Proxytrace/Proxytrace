using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Text.Json;
using Trsr.Domain.Message;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Tools;
using Trsr.Domain.Usage;

namespace Trsr.Api.Services.Internal;

internal class OpenAiCallParser : IOpenAiCallParser
{
    public bool TryParse(
        IModelProvider provider,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        [NotNullWhen(true)] out OpenAiCallParseResult? result)
    {
        var conversation = ParseConversation(requestBody);
        if (conversation is null)
        {
            result = null;
            return false;
        }

        var agentMessage = ParseAgentMessage(responseBody);
        if (agentMessage is null)
        {
            result = null;
            return false;
        }

        var model = ParseModel(requestBody);
        var (inputTokens, outputTokens, finishReason) = ParseUsage(responseBody);
        var errorMessage = (int)httpStatus >= 400 ? ParseErrorMessage(responseBody) : null;
        var systemMessage = ParseSystemMessage(requestBody);
        if(systemMessage is null)
        {
            result = null;
            return false;
        }
        
        var tools = ParseTools(requestBody);

        result = new OpenAiCallParseResult(
            Model: model,
            Provider: provider,
            Request: conversation,
            Response: agentMessage,
            Usage: new TokenUsage((ulong)(inputTokens ?? 0), (ulong)(outputTokens ?? 0)),
            Duration: duration,
            HttpStatus: httpStatus,
            FinishReason: finishReason,
            ErrorMessage: errorMessage,
            SystemMessage: systemMessage,
            Tools: tools);
        return true;
    }

    // ── OpenAI request → Conversation ────────────────────────────────────────

    private static Conversation? ParseConversation(string requestBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(requestBody);
            if (!doc.RootElement.TryGetProperty("messages", out var messagesEl))
            {
                return null;
            }

            var conversation = Conversation.Create();
            foreach (var msgEl in messagesEl.EnumerateArray())
            {
                var role = msgEl.TryGetProperty("role", out var rp) ? rp.GetString() : null;
                var message = ParseMessage(role, msgEl);
                if (message is null)
                {
                    return null;
                }

                if (message is SystemMessage sys)
                {
                    conversation.AddSystemMessage(sys);
                }
                else
                {
                    conversation.Add(message);
                }
            }
            return conversation;
        }
        catch { return null; }
    }

    private static Message? ParseMessage(string? role, JsonElement el) => role switch
    {
        "system"    => new SystemMessage(ParseContents(el)),
        "user"      => new UserMessage(ParseContents(el)),
        "assistant" => new AssistantMessage(ParseContents(el), ParseToolRequests(el)),
        "tool"      => ParseToolMessage(el),
        _           => null
    };

    private static IReadOnlyList<Content> ParseContents(JsonElement el)
    {
        if (!el.TryGetProperty("content", out var content))
        {
            return [];
        }

        if (content.ValueKind == JsonValueKind.Null)
        {
            return [];
        }

        if (content.ValueKind == JsonValueKind.String)
        {
            return [Content.FromText(content.GetString() ?? "")];
        }

        if (content.ValueKind == JsonValueKind.Array)
        {
            return content.EnumerateArray()
                .Where(p => p.TryGetProperty("type", out var t) && t.GetString() == "text"
                         && p.TryGetProperty("text", out _))
                .Select(p => Content.FromText(p.GetProperty("text").GetString() ?? ""))
                .ToArray();
        }

        return [];
    }

    private static IReadOnlyList<ToolRequest> ParseToolRequests(JsonElement el)
    {
        if (!el.TryGetProperty("tool_calls", out var toolCalls))
        {
            return [];
        }

        var result = new List<ToolRequest>();
        foreach (var tc in toolCalls.EnumerateArray())
        {
            var id = tc.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "" : "";
            var name = "";
            var arguments = "{}";
            if (tc.TryGetProperty("function", out var fn))
            {
                if (fn.TryGetProperty("name", out var nameProp))
                {
                    name = nameProp.GetString() ?? "";
                }

                if (fn.TryGetProperty("arguments", out var argsProp))
                {
                    arguments = argsProp.GetString() ?? "{}";
                }
            }
            result.Add(new ToolRequest(id, name, arguments));
        }
        return result;
    }

    private static ToolMessage? ParseToolMessage(JsonElement el)
    {
        var id = el.TryGetProperty("tool_call_id", out var idProp) ? idProp.GetString() : null;
        if (string.IsNullOrEmpty(id))
        {
            return null;
        }

        var contents = ParseContents(el);
        var resultContent = contents.Count switch
        {
            0 => Content.FromText("(no result)"),
            1 => contents[0],
            _ => Content.FromText(string.Concat(contents.Select(c => c.Text ?? "")))
        };

        return new ToolMessage(new ToolResponse(id, [resultContent], success: true, error: null));
    }

    // ── Agent identity extraction ─────────────────────────────────────────────

    private static SystemMessage? ParseSystemMessage(string requestBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(requestBody);
            if (!doc.RootElement.TryGetProperty("messages", out var messages))
            {
                return null;
            }

            foreach (var msg in messages.EnumerateArray())
            {
                if (!msg.TryGetProperty("role", out var role) || role.GetString() != "system")
                {
                    continue;
                }

                var contents = ParseContents(msg);
                if (contents.Count > 0)
                {
                    return new SystemMessage(contents);
                }
            }
        }
        catch { /* ignored */ }
        return null;
    }

    private static IReadOnlyCollection<ToolSpecification> ParseTools(string requestBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(requestBody);
            if (!doc.RootElement.TryGetProperty("tools", out var toolsEl)
                || toolsEl.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var result = new List<ToolSpecification>();
            foreach (var tool in toolsEl.EnumerateArray())
            {
                // OpenAI format: { "type": "function", "function": { "name": "...", "description": "...", "parameters": {...} } }
                if (!tool.TryGetProperty("function", out var fn))
                {
                    continue;
                }

                var name = fn.TryGetProperty("name", out var n) ? n.GetString() : null;
                var description = fn.TryGetProperty("description", out var d) ? d.GetString() : null;
                if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(description))
                {
                    continue;
                }

                var arguments = fn.TryGetProperty("parameters", out var p)
                    ? ToolArguments.FromJsonSchema(p)
                    : ToolArguments.None;

                result.Add(new ToolSpecification(name, description, arguments));
            }
            return result;
        }
        catch { return []; }
    }

    // ── OpenAI response → AssistantMessage ───────────────────────────────────

    private static AssistantMessage? ParseAgentMessage(string? responseBody)
    {
        if (responseBody is null)
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            if (!doc.RootElement.TryGetProperty("choices", out var choices)
                || choices.GetArrayLength() == 0)
            {
                return null;
            }

            if (!choices[0].TryGetProperty("message", out var msg))
            {
                return null;
            }

            var role = msg.TryGetProperty("role", out var rp) ? rp.GetString() : null;
            return role != "assistant"
                ? null 
                : new AssistantMessage(ParseContents(msg), ParseToolRequests(msg));
        }
        catch { return null; }
    }

    // ── Scalar field extraction ───────────────────────────────────────────────

    private static string ParseModel(string requestBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(requestBody);
            if (doc.RootElement.TryGetProperty("model", out var model))
            {
                return model.GetString() ?? "unknown";
            }
        }
        catch { /* ignored */ }
        return "unknown";
    }

    private static (int? inputTokens, int? outputTokens, string? finishReason) ParseUsage(string? responseBody)
    {
        if (responseBody is null)
        {
            return (null, null, null);
        }

        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            int? inputTokens = null;
            int? outputTokens = null;
            string? finishReason = null;

            if (root.TryGetProperty("usage", out var usage))
            {
                if (usage.TryGetProperty("prompt_tokens", out var pt))
                {
                    inputTokens = pt.GetInt32();
                }

                if (usage.TryGetProperty("completion_tokens", out var ct))
                {
                    outputTokens = ct.GetInt32();
                }
            }

            if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var first = choices[0];
                if (first.TryGetProperty("finish_reason", out var fr) && fr.ValueKind != JsonValueKind.Null)
                {
                    finishReason = fr.GetString();
                }
            }

            return (inputTokens, outputTokens, finishReason);
        }
        catch { return (null, null, null); }
    }

    private static string? ParseErrorMessage(string? responseBody)
    {
        if (responseBody is null)
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            if (doc.RootElement.TryGetProperty("error", out var error) &&
                error.TryGetProperty("message", out var msg))
            {
                return msg.GetString();
            }
        }
        catch { /* ignored */ }
        return null;
    }
}
