using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;

namespace Trsr.Domain.Message;

/// <summary>
/// Represents a conversation consisting of a sequence of messages.
/// </summary>
public sealed record Conversation : IDomainObject
{
    private IList<Message> messages = [];
    
    /// <summary>
    /// The unique identifier of the conversation
    /// </summary>
    public Guid Id { get; }
    
    /// <summary>
    /// The messages in the conversation
    /// </summary>
    public IReadOnlyList<Message> Messages 
        => messages.ToArray();

    /// <summary>
    /// Initializes a new instance of the <see cref="Conversation"/> class with the specified id, title, user name, and messages.
    /// </summary>
    /// <param name="id">The unique identifier of the conversation.</param>
    /// <param name="messages">The messages in the conversation.</param>
    public Conversation(
        Guid id,
        IReadOnlyList<Message> messages)
    {
        Id = id;
        this.messages = messages.ToList();
    }

    /// <summary>
    /// Creates a new empty conversation
    /// </summary>
    public static Conversation Create()
        => new(
            Guid.NewGuid(),
            []);

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
    /// <param name="systemMessage"></param>
    /// <returns></returns>
    public void AddSystemMessage(SystemMessage systemMessage)
    {
        if (Messages.Any(x => x.Role == Role.System))
        {
            throw new InvalidOperationException("Conversation already contains a system message");
        }
        messages = [systemMessage, ..Messages];
    }

    /// <inheritdoc />
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        Validation.NotDefault(Id);
        return Messages.SelectMany(x => x.Validate(validationContext));
    }

    /// <inheritdoc />
    public bool Equals(Conversation? other)
        => other is not null && 
           Id == other.Id && 
           Messages.SequenceEqual(other.Messages);

    /// <inheritdoc />
    public override int GetHashCode() 
        => HashCode.Combine(Id, Messages);

}