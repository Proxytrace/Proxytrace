using System.ComponentModel.DataAnnotations;

namespace Proxytrace.Serialization.Internal;

/// <inheritdoc />
internal record StringOutputFormat : IOutputFormat
{
    /// <inheritdoc />
    public string? ToPromptString()
        // not relevant (we don't parse string output)
        => null;
    
    public Task<TOutput?> ParseAsync<TOutput>(
        string? output,
        CancellationToken cancellationToken = default) 
        => typeof(TOutput) != typeof(string)
            ? throw new InvalidOperationException($"StringOutputFormat can only parse to string, not {typeof(TOutput).FullName}") 
            : Task.FromResult((TOutput?)(object?)output);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield break;
    }
}