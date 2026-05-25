using System.ComponentModel.DataAnnotations;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Internal;

namespace Proxytrace.Domain.ModelProvider.Internal;

internal record ModelProvider : DomainEntity<IModelProvider>, IModelProvider
{
    private readonly IProviderClient.Factory clientFactory;
    public string Name { get; }
    public Uri Endpoint { get; }
    public string ApiKey { get; }
    public ModelProviderKind Kind { get; }

    public ModelProvider(
        string name,
        Uri endpoint,
        string apiKey,
        ModelProviderKind kind,
        IProviderClient.Factory clientFactory,
        IRepository<IModelProvider> repository) : base(repository)
    {
        this.clientFactory = clientFactory;
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
        IProviderClient.Factory clientFactory,
        IRepository<IModelProvider> repository) : base(existing, repository)
    {
        this.clientFactory = clientFactory;
        Name = name;
        Endpoint = endpoint;
        ApiKey = apiKey;
        Kind = kind;
    }
    
    public IProviderClient CreateClient()
        => clientFactory(this);

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
