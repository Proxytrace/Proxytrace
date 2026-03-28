using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;

namespace Trsr.Domain.Message;

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
    /// Increments the token usage by the values from another <paramref name="usage"/>.
    /// </summary>
    /// <param name="usage"></param>
    public void Increment(TokenUsage usage)
        => Increment(usage.InputTokenCount, usage.OutputTokenCount);  
    
    /// <summary>
    /// Increments the token usage by the specified <paramref name="inputTokens"/> and <paramref name="outputTokens"/>.
    /// </summary>
    public void Increment(ulong inputTokens, ulong outputTokens)
    {
        InputTokenCount += inputTokens;
        OutputTokenCount += outputTokens;
    }
    
    /// <summary>
    /// Overloads the - operator to subtract two TokenUsage instances.
    /// </summary>
    public static TokenUsage operator -(TokenUsage a, TokenUsage b) =>
        new(
            Math.Max(a.InputTokenCount - b.InputTokenCount, 0), 
            Math.Max(a.OutputTokenCount - b.OutputTokenCount, 0));
    
    /// <summary>
    /// Overloads the + operator to add two TokenUsage instances.
    /// </summary>
    public static TokenUsage operator +(TokenUsage a, TokenUsage b) =>
        new(
            Math.Max(a.InputTokenCount + b.InputTokenCount, 0), 
            Math.Max(a.OutputTokenCount + b.OutputTokenCount, 0));

    /// <inheritdoc />
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield return Validation.NotNegative(InputTokenCount);
        yield return Validation.NotNegative(OutputTokenCount);
    }
}