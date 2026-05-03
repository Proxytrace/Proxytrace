using System.ComponentModel.DataAnnotations;

namespace Trsr.Serialization.Internal;

/// <inheritdoc />
internal class StringOutputParser : IOutputParser<string>
{
    /// <inheritdoc />
    public IOutputFormat Format
        => new StringOutputFormat();

    /// <inheritdoc />
    public async Task<string?> ParseAsync(
        string? output,
        CancellationToken cancellationToken = default) 
        => await Task.FromResult(output);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (ValidationResult validationResult in Format.Validate(validationContext))
        {
            yield return validationResult;
        }
    }
}