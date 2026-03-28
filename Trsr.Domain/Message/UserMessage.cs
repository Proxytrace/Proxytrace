namespace Trsr.Domain.Message;

/// <summary>
/// A message from the user to the agent.
/// </summary>
public sealed record UserMessage : Message
{
    /// <summary>
    /// Initializes a new instance of the <see cref="UserMessage"/> class with the specified contents.
    /// </summary>
    /// <param name="contents">The contents of the user message.</param>
    public UserMessage(IReadOnlyList<Content> contents) : base(Role.User, contents)
    {
    }
    
    /// <summary>
    /// adds additional content to the message and returns a new instance.
    /// </summary>
    public UserMessage Add(Content content) 
        => new ([..Contents,  content]);
}