namespace Proxytrace.Domain.Message;

/// <summary>
/// The role of a message in the conversation
/// </summary>
public enum Role
{
    /// <summary>
    /// The system message, usually the initial prompt
    /// </summary>
    System,
    
    /// <summary>
    /// Message from the user
    /// </summary>
    User,
    
    /// <summary>
    /// Message from the assistant (the model)
    /// </summary>
    Assistant,
    
    /// <summary>
    /// The response from a tool request
    /// </summary>
    Tool,
}