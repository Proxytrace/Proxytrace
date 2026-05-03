using System.ComponentModel.DataAnnotations;

namespace Trsr.Prompting;

/// <summary>
/// A template for a LLM prompt that can be rendered with a set of values.
/// </summary>
public interface IPromptTemplate : IValidatableObject
{
    /// <summary>
    /// The name of the prompt template.
    /// </summary>
    public string Name { get; }
    
    /// <summary>
    /// The template string with variables in {curly braces}.
    /// </summary>
    string Template { get; }
    
    /// <summary>
    /// The names of the variables in the template.
    /// </summary>
    IReadOnlyCollection<string> Variables { get; }

    /// <summary>
    /// Replaces the variables in the template with the given <paramref name="values"/>
    /// and returns a rendered <see cref="IPrompt"/>.
    /// </summary>
    IPrompt Render(IReadOnlyDictionary<string, string> values);
}