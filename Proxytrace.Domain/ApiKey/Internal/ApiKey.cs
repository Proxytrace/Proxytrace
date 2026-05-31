using System.ComponentModel.DataAnnotations;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;

namespace Proxytrace.Domain.ApiKey.Internal;

internal record ApiKey : DomainEntity<IApiKey>, IApiKey
{
    private readonly string apiKey;

    public string Name { get; }
    string IApiKey.ApiKey => apiKey;
    public IProject Project { get; }
    public IModelProvider Provider { get; }
    public DateTimeOffset? ExpiresAt { get; }

    public ApiKey(
        string name,
        string apiKey,
        IProject project,
        IModelProvider provider,
        DateTimeOffset? expiresAt,
        IRepository<IApiKey> repository) : base(repository)
    {
        Name = name;
        this.apiKey = apiKey;
        Project = project;
        Provider = provider;
        ExpiresAt = expiresAt;
    }

    public ApiKey(
        string name,
        string apiKey,
        IProject project,
        IModelProvider provider,
        DateTimeOffset? expiresAt,
        IDomainEntityData existing,
        IRepository<IApiKey> repository) : base(existing, repository)
    {
        Name = name;
        this.apiKey = apiKey;
        Project = project;
        Provider = provider;
        ExpiresAt = expiresAt;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        yield return Validation.NotNullOrWhiteSpace(Name);
        yield return Validation.NotNullOrWhiteSpace(apiKey);
    }
}
