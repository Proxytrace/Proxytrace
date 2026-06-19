using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using JetBrains.Annotations;

namespace Proxytrace.Domain.Message;

/// <summary>
/// A system message, typically used to set the behavior of the AI assistant.
/// </summary>
public sealed record SystemMessage : Message
{
    /// <summary>
    /// Initializes a new instance of the <see cref="SystemMessage"/> class with the specified contents.
    /// </summary>
    /// <param name="contents">The contents of the system message.</param>
    [UsedImplicitly]
    [JsonConstructor]
    public SystemMessage(IReadOnlyList<Content> contents)
        : base(Role.System, contents)
    {
    }
    
    /// <summary>
    /// Initializes a new instance of the <see cref="SystemMessage"/> class with the specified prompt and output format.
    /// </summary>
    /// <param name="prompt">The prompt to use.</param>
    public SystemMessage(string prompt)
        : base(Role.System, [Content.FromText(prompt)])
    {
    }

    /// <inheritdoc />
    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        // base (Message.Validate) already cascades into each Content; layer only the
        // SystemMessage-specific "must be text" rule on top.
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        foreach (Content content in Contents)
        {
            if (content.Kind != ContentKind.Text)
            {
                yield return new ValidationResult(
                    $"SystemMessage content must be of kind Text. Found content with kind {content.Kind}.",
                    [nameof(Contents)]);
            }
        }
    }

    /// <inheritdoc />
    public override string ToString() 
        => base.ToString();
}