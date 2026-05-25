using System.Diagnostics.Contracts;

namespace Proxytrace.Domain.Prompt;

/// <summary>
/// A prompt that can be sent to a language model.
/// It is rendered from a <see cref="IPromptTemplate"/> and a set of values.
/// </summary>
public interface IPrompt : IDomainObject
{
    /// <summary>
    /// The template from which this prompt was rendered.
    /// </summary>
    string Name { get; }

    /// <summary>
    /// Appends the <paramref name="other"/> prompt to this prompt, creating a new prompt that combines the templates and values of both prompts.
    /// </summary>
    [Pure]
    IPrompt Append(IPrompt other);
    
    /// <summary>
    /// Gets the rendered prompt string that can be sent to a language model.
    /// </summary>
    string ToPromptString();
}