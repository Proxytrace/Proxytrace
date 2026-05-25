using System.Text;
using System.Text.Json;
using Microsoft.Extensions.AI;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;

namespace Proxytrace.Infrastructure.Internal;

internal static class ChatClientExtensions
{
    public static IEnumerable<ChatMessage> ToChatMessages(this Conversation conversation)
        => conversation.Messages.Select(m => m.ToChatMessage());

    public static ChatMessage ToChatMessage(this Message message)
    {
        ChatRole role = message.Role switch
        {
            Role.User => ChatRole.User,
            Role.Assistant => ChatRole.Assistant,
            Role.Tool => ChatRole.Tool,
            Role.System => ChatRole.System,
            _ => throw new InvalidOperationException($"Unknown role: {message.Role}")
        };

        if (message is AssistantMessage { ToolRequests.Count: > 0 } assistantMessage)
        {
            var aiContents = new List<AIContent>();
            var text = BuildText(message.Contents);
            if (!string.IsNullOrEmpty(text))
                aiContents.Add(new TextContent(text));
            foreach (var req in assistantMessage.ToolRequests)
            {
                var args = JsonSerializer.Deserialize<IDictionary<string, object?>>(req.Arguments);
                aiContents.Add(new FunctionCallContent(req.Id, req.Name, args));
            }
            return new ChatMessage(role, aiContents);
        }

        if (message is ToolMessage toolMessage)
        {
            var (id, contents) = toolMessage.Deconstruct();
            return new ChatMessage(role, [new FunctionResultContent(id, BuildText(contents))]);
        }

        return new ChatMessage(role, BuildText(message.Contents));
    }

    private static string BuildText(IReadOnlyList<Content> contents)
    {
        var sb = new StringBuilder();
        foreach (var content in contents)
        {
            if (content is { Kind: ContentKind.Text, Text: not null })
                sb.AppendLine(content.Text);
            else if (content.Kind == ContentKind.Image)
                throw new NotSupportedException("Image content is not supported in chat messages yet");
        }
        return sb.ToString().Trim();
    }

    public static ChatOptions ToChatOptions(this ModelOptions options)
    {
        var chatOptions = new ChatOptions { ModelId = options.ModelName };

        if (options.Tools.Any())
        {
            chatOptions.Tools = options.Tools
                .Select(t => (AITool)AIFunctionFactory.CreateDeclaration(
                    t.Name,
                    t.Description,
                    JsonDocument.Parse(t.Arguments.JsonSchema).RootElement.Clone()))
                .ToList();
        }

        return chatOptions;
    }
}