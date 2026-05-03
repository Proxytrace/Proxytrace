using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;

namespace Trsr.Serialization.Internal;

/// <inheritdoc />
internal record JsonOutputFormat : IOutputFormat
{
    /// <summary>
    /// The JSON schema definition that the output must adhere to
    /// </summary>
    public string Schema { get; }

    public JsonOutputFormat(string schema)
    {
        Schema = schema;
    }
    
    /// <inheritdoc />
    public string ToPromptString()
        => $"Respond only in JSON format that adheres to the following JSON schema definition:\n{Schema}";
    
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield return Validation.NotNullOrWhiteSpace(Schema, nameof(Schema));
        yield return Validation.Json(Schema);
    }
}