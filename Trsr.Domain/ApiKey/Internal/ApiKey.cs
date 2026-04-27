using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;

namespace Trsr.Domain.ApiKey.Internal;

internal record ApiKey : DomainEntity, IApiKey
{
    private readonly string _apiKey;

    public string Name { get; }
    string IApiKey.ApiKey => _apiKey;
    public IProject Project { get; }
    public IModelProvider Provider { get; }

    public ApiKey(string name, string apiKey, IProject project, IModelProvider provider)
    {
        Name = name;
        _apiKey = apiKey;
        Project = project;
        Provider = provider;
    }

    public ApiKey(string name, string apiKey, IProject project, IModelProvider provider, IDomainEntityData existing) : base(existing)
    {
        Name = name;
        _apiKey = apiKey;
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
            yield return Validation.NotNullOrWhiteSpace(Name, nameof(Name));
        }

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            yield return Validation.NotNullOrWhiteSpace(_apiKey, nameof(IApiKey.ApiKey));
        }

        if (Project is null)
        {
            yield return Validation.NotNull(Project, nameof(Project));
        }

        if (Provider is null)
        {
            yield return Validation.NotNull(Provider, nameof(Provider));
        }
    }
}
