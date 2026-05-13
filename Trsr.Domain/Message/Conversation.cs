using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;

namespace Trsr.Domain.Message;

/// <summary>
/// Represents a conversation consisting of a sequence of messages.
/// </summary>
public sealed record Conversation : IDomainObject
{
    private IList<Message> messages = [];
    
    /// <summary>
    /// The messages in the conversation
    /// </summary>
    public IReadOnlyList<Message> Messages 
        => messages.ToArray();
    
    public SystemMessage? SystemMessage 
        => Messages.FirstOrDefault(x => x.Role == Role.System) as SystemMessage;

    /// <summary>
    /// Initializes a new instance of the <see cref="Conversation"/> class with the specified id, title, user name, and messages.
    /// </summary>
    /// <param name="messages">The messages in the conversation.</param>
    public Conversation(
        IReadOnlyList<Message> messages)
    {
        this.messages = messages.ToList();
    }

    /// <summary>
    /// Creates a new empty conversation
    /// </summary>
    public static Conversation Create()
        => new([]);

    /// <summary>
    /// Adds a message to the conversation
    /// </summary>
    public void Add(Message message)
    {
        if (message.Role == Role.System)
        {
            throw new InvalidOperationException("System messages must be added using AddSystemMessage");
        }
        messages = [..Messages, message];
    }

    /// <summary>
    /// Adds a system message to the start of the conversation
    /// </summary>
    public void AddSystemMessage(SystemMessage systemMessage)
    {
        if (Messages.Any(x => x.Role == Role.System))
        {
            throw new InvalidOperationException("Conversation already contains a system message");
        }
        messages = [systemMessage, ..Messages];
    }
    
    /// <summary>
    /// Returns the Conversation without the system message
    /// </summary>
    [Pure]
    public Conversation WithoutSystemMessage() 
        => new(Messages.Where(x => x.Role != Role.System).ToArray());

    /// <inheritdoc />
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        return Messages.SelectMany(x => x.Validate(validationContext));
    }

    /// <inheritdoc />
    public bool Equals(Conversation? other)
        => other is not null && 
           Messages.SequenceEqual(other.Messages);

    /// <inheritdoc />
    public override int GetHashCode() 
        => HashCode.Combine(Messages);
    
    /// <summary>
    /// Replaces any existing system Prompt with this system prompt
    /// </summary>
    [Pure]
    public static Conversation ReplaceSystemMessage(Conversation conversation, SystemMessage systemMessage)
    {
        var newConversation = conversation.WithoutSystemMessage();
        newConversation.AddSystemMessage(systemMessage);
        return newConversation;
    }

    public override string ToString() 
        => string.Join(Environment.NewLine, messages.Select(x => x.ToString()));
}