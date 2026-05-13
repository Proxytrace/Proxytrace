using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;

namespace Trsr.Domain.ApiKey.Internal;

internal record ApiKey : DomainEntity<IApiKey>, IApiKey
{
    private readonly string apiKey;

    public string Name { get; }
    string IApiKey.ApiKey => apiKey;
    public IProject Project { get; }
    public IModelProvider Provider { get; }

    public ApiKey(
        string name,
        string apiKey,
        IProject project,
        IModelProvider provider,
        IRepository<IApiKey> repository) : base(repository)
    {
        Name = name;
        this.apiKey = apiKey;
        Project = project;
        Provider = provider;
    }

    public ApiKey(
        string name,
        string apiKey,
        IProject project,
        IModelProvider provider,
        IDomainEntityData existing,
        IRepository<IApiKey> repository) : base(existing, repository)
    {
        Name = name;
        this.apiKey = apiKey;
        Project = project;
        Provider = provider;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (string.IsNullOrWhiteSpace(Name))
        {
            foreach (var r in Validation.NotNullOrWhiteSpace(Name).AsEnumerable()) yield return r;
        }

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            foreach (var r in Validation.NotNullOrWhiteSpace(apiKey, nameof(IApiKey.ApiKey)).AsEnumerable()) yield return r;
        }
    }
}
