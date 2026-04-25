using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.ModelProvider.Internal;

internal record ModelProvider : DomainEntity, IModelProvider
{
    public string Name { get; }
    public Uri Endpoint { get; }
    public string ApiKey { get; }

    public ModelProvider(string name, Uri endpoint, string apiKey)
    {
        Name = name;
        Endpoint = endpoint;
        ApiKey = apiKey;
    }

    public ModelProvider(string name, Uri endpoint, string apiKey, IDomainEntityData existing) : base(existing)
    {
        Name = name;
        Endpoint = endpoint;
        ApiKey = apiKey;
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

