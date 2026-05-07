using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.ModelProvider.Internal;

internal record ModelProvider : DomainEntity<IModelProvider>, IModelProvider
{
    public string Name { get; }
    public Uri Endpoint { get; }
    public string ApiKey { get; }
    public ModelProviderKind Kind { get; }

    public ModelProvider(
        string name,
        Uri endpoint,
        string apiKey,
        ModelProviderKind kind,
        IRepository<IModelProvider> repository) : base(repository)
    {
        Name = name;
        Endpoint = endpoint;
        ApiKey = apiKey;
        Kind = kind;
    }

    public ModelProvider(
        string name, 
        Uri endpoint,
        string apiKey,
        ModelProviderKind kind,
        IDomainEntityData existing,
        IRepository<IModelProvider> repository) : base(existing, repository)
    {
        Name = name;
        Endpoint = endpoint;
        ApiKey = apiKey;
        Kind = kind;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (string.IsNullOrWhiteSpace(Name))
        {
            yield return Validation.NotNullOrWhiteSpace(Name);
        }

        if (string.IsNullOrWhiteSpace(ApiKey))
        {
            yield return Validation.NotNullOrWhiteSpace(ApiKey);
        }
    }
}
