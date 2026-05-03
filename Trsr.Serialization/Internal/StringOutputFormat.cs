using System.ComponentModel.DataAnnotations;

namespace Trsr.Serialization.Internal;

/// <inheritdoc />
internal record StringOutputFormat : IOutputFormat
{
    /// <inheritdoc />
    public string? ToPromptString()
        // not relevant (we don't parse string output)
        => null;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield break;
    }
}