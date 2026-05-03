using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.AI;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Model;
using Trsr.Domain.ModelProvider;

namespace Trsr.Domain.ModelEndpoint.Internal;

internal record ModelEndpoint : DomainEntity<IModelEndpoint>, IModelEndpoint
{
    private readonly IModelClient.Factory modelClientFactory;
    public IModel Model { get; }
    public IModelProvider Provider { get; }
    public decimal? InputTokenCost { get; }
    public decimal? OutputTokenCost { get; }

    public ModelEndpoint(
        IModel model,
        IModelProvider provider,
        decimal? inputTokenCost,
        decimal? outputTokenCost,
        IModelClient.Factory modelClientFactory,
        IRepository<IModelEndpoint> repository) : base(repository)
    {
        this.modelClientFactory = modelClientFactory;
        Model = model;
        Provider = provider;
        InputTokenCost = inputTokenCost;
        OutputTokenCost = outputTokenCost;
    }

    public ModelEndpoint(
        IModel model,
        IModelProvider provider,
        decimal? inputTokenCost,
        decimal? outputTokenCost,
        IDomainEntityData existing,
        IModelClient.Factory modelClientFactory,
        IRepository<IModelEndpoint> repository)
        : base(existing, repository)
    {
        this.modelClientFactory = modelClientFactory;
        Model = model;
        Provider = provider;
        InputTokenCost = inputTokenCost;
        OutputTokenCost = outputTokenCost;
    }
    
    public IModelClient CreateClient() 
        => modelClientFactory(this);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        foreach (var result in Model.Validate(validationContext))
            yield return result;

        foreach (var result in Provider.Validate(validationContext))
            yield return result;

        if (InputTokenCost.HasValue)
            yield return Validation.Positive(InputTokenCost.Value, nameof(InputTokenCost));

        if (OutputTokenCost.HasValue)
            yield return Validation.Positive(OutputTokenCost.Value, nameof(OutputTokenCost));

        if (InputTokenCost.HasValue && OutputTokenCost.HasValue)
            yield return Validation.LessThanOrEqual(InputTokenCost.Value, OutputTokenCost.Value, nameof(InputTokenCost));
    }
}

