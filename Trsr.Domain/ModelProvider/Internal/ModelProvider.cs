using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Organization;

namespace Trsr.Domain.ModelProvider.Internal;

internal record ModelProvider : DomainEntity, IModelProvider
{
    public string Name { get; }
    public Uri Endpoint { get; }
    public string ApiKey { get; }
    public ModelProviderKind Kind { get; }
    public IOrganization Organization { get; }

    public ModelProvider(string name, Uri endpoint, string apiKey, ModelProviderKind kind, IOrganization organization)
    {
        Name = name;
        Endpoint = endpoint;
        ApiKey = apiKey;
        Kind = kind;
        Organization = organization;
    }

    public ModelProvider(string name, Uri endpoint, string apiKey, ModelProviderKind kind, IOrganization organization, IDomainEntityData existing) : base(existing)
    {
        Name = name;
        Endpoint = endpoint;
        ApiKey = apiKey;
        Kind = kind;
        Organization = organization;
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

        if (string.IsNullOrWhiteSpace(ApiKey))
        {
            yield return Validation.NotNullOrWhiteSpace(ApiKey, nameof(ApiKey));
        }

        if (Organization is null)
        {
            yield return Validation.NotNull(Organization, nameof(Organization));
        }
    }
}
