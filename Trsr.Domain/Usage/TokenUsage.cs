using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;

namespace Trsr.Domain.Usage;

/// <summary>
/// Represents the token usage statistics for a language model interaction.
/// </summary>
public sealed record TokenUsage : IDomainObject
{
    /// <summary>
    /// The number of input tokens (prompt) used.
    /// </summary>
    public ulong InputTokenCount { get; private set; }
    
    /// <summary>
    /// The number of output tokens (response) generated.
    /// </summary>
    public ulong OutputTokenCount { get; private set; }
    
    /// <summary>
    /// No tokens used
    /// </summary>
    public static TokenUsage None => new TokenUsage(0, 0);
    
    /// <summary>
    /// Initializes a new instance of the <see cref="TokenUsage"/> class with zero input and output tokens.
    /// </summary>
    public TokenUsage() : this(inputTokenCount: 0,outputTokenCount: 0)
    {
    }
    
    /// <summary>
    /// Initializes a new instance of the <see cref="TokenUsage"/> class with the specified input and output token counts.
    /// </summary>
    /// <param name="inputTokenCount">The number of input tokens.</param>
    /// <param name="outputTokenCount">The number of output tokens.</param>
    public TokenUsage(ulong inputTokenCount, ulong outputTokenCount)
    {
        InputTokenCount = inputTokenCount;
        OutputTokenCount = outputTokenCount;
    }
    
    /// <summary>
    /// Overloads the - operator to add two TokenUsage instances.
    /// </summary>
    public static TokenUsage? operator -(TokenUsage? a, TokenUsage? b)
        => a == null || b == null
            ? a ?? b
            : new(
                a.InputTokenCount - b.InputTokenCount,
                a.OutputTokenCount - b.OutputTokenCount);

    /// <summary>
    /// Overloads the + operator to add two TokenUsage instances.
    /// </summary>
    public static TokenUsage? operator +(TokenUsage? a, TokenUsage? b)
        => a == null || b == null
            ? a ?? b
            : new(
                a.InputTokenCount + b.InputTokenCount,
                a.OutputTokenCount + b.OutputTokenCount);
    
    public static TokenUsage? Create(ulong? inputTokenCount, ulong? outputTokenCount)
        => inputTokenCount.HasValue && outputTokenCount.HasValue
            ? new TokenUsage(inputTokenCount.Value, outputTokenCount.Value)
            : null;

    /// <inheritdoc />
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield break;
    }
}