using System.ComponentModel.DataAnnotations;

namespace Trsr.Serialization;

/// <summary>
/// Handles model output parsing and validation.
/// </summary>
public interface  IOutputParser<TOutput> : IValidatableObject
{
    /// <summary>
    /// The schema of <typeparamref name="TOutput"/>
    /// </summary>
    IOutputFormat Format { get; }

    /// <summary>
    /// Parses model output to <typeparamref name="TOutput"/> and validates it
    /// </summary>
    Task<TOutput?> ParseAsync(string? output, CancellationToken cancellationToken = default);
}