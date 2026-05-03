using System.ComponentModel.DataAnnotations;

namespace Trsr.Serialization;

/// <summary>
/// A format for the output of an agent
/// </summary>
public interface IOutputFormat : IValidatableObject
{
    /// <summary>
    /// Creates a <see cref="IOutputFormat"/> from a json schema string
    /// </summary>
    delegate IOutputFormat FromJsonSchema(string jsonSchema);

    /// <summary>
    /// Returns an instruction that tells the model how to format its output
    /// </summary>
    string? ToPromptString();
}