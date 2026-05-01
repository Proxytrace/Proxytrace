using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Trsr.Domain.Message;

/// <summary>
/// A message from the assistant, which may include tool requests.
/// </summary>
public sealed record AssistantMessage : Message
{
    /// <summary>
    /// The tool requests made by the assistant in this message.
    /// </summary>
    public IReadOnlyList<ToolRequest> ToolRequests { get; }

    /// <summary>
    /// Initializes a new instance of the <see cref="AssistantMessage"/> class with the specified contents and tool requests.
    /// </summary>
    /// <param name="contents">The contents of the message.</param>
    /// <param name="toolRequests">The tool requests made by the assistant.</param>
    public AssistantMessage(
        IReadOnlyList<Content> contents,
        IReadOnlyList<ToolRequest> toolRequests)
        : base(Role.Assistant, contents)
    {
        ToolRequests = [..toolRequests];
    }

    /// <inheritdoc />
    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;    
        }
        
        foreach (var result in ToolRequests.SelectMany(tr => tr.Validate(validationContext)))
        {
            yield return result;
        }
    }

    public string GetTextResponse()
    {
        if (ToolRequests.Any())
        {
            throw new InvalidOperationException("Cannot get text response from an AssistantMessage that contains tool requests.");
        }
        
        if(Contents.Any(x => x.Kind != ContentKind.Text))
        {
            throw new InvalidOperationException("Cannot get text response from an AssistantMessage that contains non-text content.");
        }
        
        return string.Join(string.Empty, Contents.Select(x => x.Text));
    }

    /// <inheritdoc />
    public bool Equals(AssistantMessage? other)
        => other is not null
           && base.Equals(other)
           && ToolRequests.SequenceEqual(other.ToolRequests);

    /// <inheritdoc />
    public override int GetHashCode() 
        => HashCode.Combine(base.GetHashCode(), ToolRequests);
}