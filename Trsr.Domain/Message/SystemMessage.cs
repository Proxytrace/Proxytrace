using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json.Serialization;
using JetBrains.Annotations;

namespace Trsr.Domain.Message;

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
        foreach (Content content in Contents)
        {
            if (content.Kind != ContentKind.Text)
            {
                yield return new ValidationResult(
                    $"SystemMessage content must be of kind Text. Found content with kind {content.Kind}.",
                    [nameof(Contents)]);
            }
            
            foreach (var validationResult in content.Validate(validationContext))
            {
                yield return validationResult;
            }
        }
    }

    /// <inheritdoc />
    public override string ToString()
    {
        var sb = new StringBuilder();
        foreach (var content in Contents)
        {
            if (content.Text != null)
            {
                sb.AppendLine(content.Text);
            }
        }
        return sb.ToString().TrimEnd();
    }
}