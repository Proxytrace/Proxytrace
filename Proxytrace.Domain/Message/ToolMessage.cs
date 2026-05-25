using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Proxytrace.Common.Validation;

namespace Proxytrace.Domain.Message;

/// <summary>
/// A message representing a tool response.
/// </summary>
public sealed record ToolMessage : Message
{
    /// <summary>
    /// The unique identifier of the tool response.
    /// </summary>
    public string Id => Deconstruct().Id;

    /// <summary>
    /// Initializes a new instance of the <see cref="ToolMessage"/> class from a <see cref="ToolResponse"/>.
    /// </summary>
    /// <param name="response">The tool response to represent.</param>
    public ToolMessage(ToolResponse response)
        : this(response.Id, GetResponseContent(response))
    {
    }

    private static IReadOnlyList<Content> GetResponseContent(ToolResponse response)
    {
        if (response.Success)
        {
            var results = response.Results.ToList();
            if (results.Count == 0)
            {
                results.Add(Content.FromText("Tool executed successfully. No result returned."));
            }
            return results;
        }
        
        return [
            Content.FromText($"""
                             Status: Failure
                             Error: {response.Error?.Message ?? "Unknown error"}
                             """)
        ];
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ToolMessage"/> class with the specified id and response.
    /// </summary>
    /// <param name="id">The unique identifier of the tool response.</param>
    /// <param name="contents">The response content.</param>
    private ToolMessage(string id, IReadOnlyList<Content> contents)
        : this(
        [
            Content.FromText(id),
            ..contents
        ])
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ToolMessage"/> class with the specified contents.
    /// </summary>
    /// <param name="contents">The contents of the tool message.</param>
    [JsonConstructor]
    public ToolMessage(IReadOnlyList<Content> contents)
        : base(Role.Tool, contents)
    {
    }

    /// <summary>
    /// Deconstructs the ToolMessage into its Id and Response components.
    /// </summary>
    public (string Id, IReadOnlyList<Content> Contents) Deconstruct()
    {
        if (Contents.Count < 2)
        {
            throw new InvalidOperationException("Invalid ToolMessage content.");
        }

        var id = Contents[0].Text;
        return id.NullOrWhiteSpace() 
            ? throw new InvalidOperationException("Invalid ToolMessage content.") 
            : (id, Contents.Skip(1).ToList());
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }
        
        yield return Validation.HasCount(Contents, 2);
        yield return Validation.NotNullOrWhiteSpace(Contents[0].Text);
    }
    
    public override string ToString() 
        => base.ToString();
}