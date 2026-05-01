using System.Text;
using Microsoft.Extensions.AI;
using Trsr.Domain.Message;
using Trsr.Domain.Model;

namespace Trsr.Infrastructure.Internal;

/// <summary>
/// Extension methods for Microsoft.Extensions.AI
/// </summary>
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

        var contentText = new StringBuilder();
        foreach (var content in message.Contents)
        {
            if (content is { Kind: ContentKind.Text, Text: not null })
            {
                contentText.AppendLine(content.Text);
            }
            else if (content.Kind == ContentKind.Image)
            {
                throw new NotSupportedException("Image content is not supported in chat messages yet");
            }
        }

        return new ChatMessage(role, contentText.ToString().Trim());
    }

    public static ChatOptions ToOptions(this IModel model)
        => new ChatOptions()
        {
            ModelId = model.Name
        };
}