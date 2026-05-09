using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.ModelProvider.Internal;

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
            foreach (var __r in Validation.NotNullOrWhiteSpace(Name).AsEnumerable()) yield return __r;
        }

        if (string.IsNullOrWhiteSpace(ApiKey))
        {
            foreach (var __r in Validation.NotNullOrWhiteSpace(ApiKey).AsEnumerable()) yield return __r;
        }
    }
}
