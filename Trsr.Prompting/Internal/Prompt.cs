using System.ComponentModel.DataAnnotations;
using System.Diagnostics.Contracts;
using Trsr.Common.Validation;

namespace Trsr.Prompting.Internal;

/// <inheritdoc />
internal record Prompt : IPrompt
{
    /// <inheritdoc />
    public string Name { get; }

    /// <summary>
    /// The rendered prompt string.
    /// </summary>
    private readonly string promptString;

    public Prompt(
        string name,
        string promptString)
    {
        Name = name;
        this.promptString = promptString;
    }

    /// <inheritdoc />
    public string ToPromptString() 
        => promptString;

    /// <inheritdoc />
    [Pure]
    public IPrompt Append(IPrompt other) 
        => new Prompt(
            name: $"{this.Name}_{other.Name}",
            promptString: string.Join(Environment.NewLine, this.ToPromptString(), other.ToPromptString()));

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield return Validation.NotNullOrWhiteSpace(Name);
        yield return Validation.NotNullOrWhiteSpace(promptString);
    }
}
