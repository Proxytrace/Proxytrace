using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Trsr.Common.Validation;

namespace Trsr.Domain.Message;

/// <summary>
/// The response from a tool
/// </summary>
public sealed record ToolResponse : IDomainObject
{
    /// <summary>
    /// The id of the tool call
    /// </summary>
    public string Id { get; }

    /// <summary>
    /// The response from the tool, if successful
    /// </summary>
    public IReadOnlyList<Content> Results { get; }

    /// <summary>
    /// The error from the tool, if unsuccessful
    /// </summary>
    public Exception? Error { get; }

    /// <summary>
    /// Whether the tool call was successful
    /// </summary>
    public bool Success { get; }

    /// <summary>
    /// The result of a successful tool call
    /// </summary>
    public ToolResponse(
        ToolRequest request,
        IReadOnlyList<Content> results) : this(
        id: request.Id,
        results: results,
        success: true,
        error: null)
    {
    }

    /// <summary>
    /// The result of a tool call
    /// </summary>
    [JsonConstructor]
    public ToolResponse(
        string id,
        IReadOnlyList<Content> results,
        bool success,
        Exception? error)
    {
        Id = id;
        Results = results;
        Success = success;
        Error = error;
    }

    /// <summary>
    /// The result of a failed tool call
    /// </summary>
    public ToolResponse(ToolRequest request, Exception error) : this(
        id: request.Id,
        results: [],
        success: false,
        error: error)
    {
    }

    /// <inheritdoc />
    public bool Equals(ToolResponse? other)
        => other is not null &&
           Id == other.Id &&
           Results.SequenceEqual(other.Results) &&
           Equals(Error, other.Error) &&
           Success == other.Success;

    /// <inheritdoc />
    public override int GetHashCode() 
        => HashCode.Combine(Id, Results, Error, Success);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var __r in Validation.NotNullOrWhiteSpace(Id).AsEnumerable()) yield return __r;
        if (Success)
        {
            foreach (var __r in Validation.Null(Error).AsEnumerable()) yield return __r;
        }
        else
        {
            foreach (var __r in Validation.NotNull(Error).AsEnumerable()) yield return __r;
        }
    }
}