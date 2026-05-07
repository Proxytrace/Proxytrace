using System.Resources;
using Trsr.Common.Validation;

namespace Trsr.Domain.Prompt.Internal;

/// <summary>
/// A repository that loads prompt templates from embedded resources.
/// </summary>
internal class ResourcesPromptRepository : IPromptTemplateRepository
{
    private readonly IReadOnlyCollection<ResourceManager> resources;

    public ResourcesPromptRepository(IReadOnlyCollection<ResourceManager> resources)
    {
        this.resources = resources;
    }
    
    /// <inheritdoc />
    public Task<IPromptTemplate?> FindAsync(string name, CancellationToken cancellationToken = default)
    {
        string? templateContent = resources.Select(res => res.GetString(name))
            .FirstOrDefault(content => !string.IsNullOrWhiteSpace(content));
        if (string.IsNullOrWhiteSpace(templateContent))
        {
            return Task.FromResult<IPromptTemplate?>(null);
        }
        
        IPromptTemplate template = new PromptTemplate(name, templateContent);
        template.Validate();
        return Task.FromResult<IPromptTemplate?>(template);
    }
}