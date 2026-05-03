using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;

namespace Trsr.Prompting.Internal;

/// <inheritdoc />
internal class PromptBuilder : IPromptBuilder
{
    private readonly IReadOnlyCollection<IPromptTemplateRepository> repositories;
    private string? name;
    private readonly Dictionary<string, string> values = new();

    public PromptBuilder(
        IEnumerable<IPromptTemplateRepository> repositories)
    {
        this.repositories = repositories.ToArray();
    }

    /// <inheritdoc />
    public IPromptBuilder Name(string promptName)
    {
        name = promptName;
        return this;
    }

    /// <inheritdoc />
    public IPromptBuilder With(string variableName, string value)
    {
        values[variableName] = value;
        return this;
    }

    /// <inheritdoc />
    public async Task<IPrompt> BuildAsync(CancellationToken cancellationToken = default)
    {
        this.Validate();       
        string promptName = name ?? throw new ArgumentNullException(nameof(name), "Prompt name must be set before building.");

        IPromptTemplate template = await GetTemplateAsync(promptName, cancellationToken);
        return template.Render(values);
    }

    private async Task<IPromptTemplate> GetTemplateAsync(string promptName, CancellationToken cancellationToken) 
        => await FindTemplateAsync(promptName, cancellationToken)
            ?? throw new InvalidOperationException($"Prompt Template '{promptName}' not found in any repository.");

    private async Task<IPromptTemplate?> FindTemplateAsync(string promptName, CancellationToken cancellationToken)
    {
        foreach (IPromptTemplateRepository repository in repositories)
        {
            IPromptTemplate? template = await repository.GetAsync(promptName, cancellationToken);
            if (template != null)
            {
                return template;
            }
        }
        return null;
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield return Validation.NotNullOrWhiteSpace(name);
    }
}