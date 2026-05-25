using System.ComponentModel.DataAnnotations;
using System.Diagnostics.Contracts;
using Proxytrace.Common.Validation;

namespace Proxytrace.Domain.Prompt.Internal;

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
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentNullException(nameof(name), "Prompt name cannot be null or whitespace.");
        }

        if (string.IsNullOrWhiteSpace(promptString))
        {
            throw  new ArgumentNullException(nameof(promptString), "Prompt string cannot be null or whitespace.");
        }
        
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
            name: $"{Name}_{other.Name}",
            promptString: string.Join(Environment.NewLine, ToPromptString(), other.ToPromptString()));

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield return Validation.NotNullOrWhiteSpace(Name);
        yield return Validation.NotNullOrWhiteSpace(promptString);
    }
}
