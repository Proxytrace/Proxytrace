using System.ComponentModel.DataAnnotations;

namespace Trsr.Prompting;

/// <summary>
/// Builder for <see cref="IPrompt"/> instances
/// </summary>
public interface IPromptBuilder : IValidatableObject
{
    /// <summary>
    /// The name of the prompt template to use (e.g. "email-summarization").
    /// </summary>
    IPromptBuilder Name(string promptName);

    /// <summary>
    /// Replaces a variable in the prompt template (e.g. {email}) with the given value.
    /// </summary>
    IPromptBuilder With(string variableName, string value);

    /// <summary>
    /// Builds the <see cref="IPrompt"/> instance.
    /// </summary>
    Task<IPrompt> BuildAsync(CancellationToken cancellationToken = default);
}