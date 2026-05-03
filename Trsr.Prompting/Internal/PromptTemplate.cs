using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Trsr.Common.Validation;

namespace Trsr.Prompting.Internal;

/// <inheritdoc />
internal record PromptTemplate : IPromptTemplate
{
    private static readonly Regex VariableRegex = new(@"\{\{([a-zA-Z0-9_-]+)\}\}", RegexOptions.Compiled);

    /// <inheritdoc />
    public string Name { get; }

    /// <inheritdoc />
    public string Template { get; }

    /// <inheritdoc />
    public IReadOnlyCollection<string> Variables { get; }

    public PromptTemplate(
        string name, 
        string template)
    {
        Name = name;
        Template = template;
        Variables = ExtractVariables(template);
    }

    /// <inheritdoc />
    public IPrompt Render(IReadOnlyDictionary<string, string> values)
    {
        this.Validate();
        string renderedTemplate = Template;

        // Replace each variable with its value
        foreach (string variable in Variables)
        {
            if (!values.TryGetValue(variable, out string? value))
            {
                throw new ArgumentException($"Value for variable '{variable}' was not provided.");
            }
            renderedTemplate = renderedTemplate.Replace($"{{{{{variable}}}}}", value);
        }

        var prompt = new Prompt(Name, renderedTemplate);
        prompt.Validate();
        return prompt;
    }

    private IReadOnlyCollection<string> ExtractVariables(string template)
    {
        HashSet<string> variables = [];
        foreach (Match match in VariableRegex.Matches(template))
        {
            string variableName = match.Groups[1].Value;
            variables.Add(variableName);
        }
        return variables;
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (string variable in Variables)
        {
            yield return Validation.NotNullOrWhiteSpace(variable);
            var letterCount = variable.Count(char.IsLetter);
            yield return Validation.GreaterThan(letterCount, 1);
        }
    }
}