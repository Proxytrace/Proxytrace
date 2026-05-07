using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Model;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Usage;

namespace Trsr.Domain.ModelEndpoint.Internal;

internal record ModelEndpoint : DomainEntity<IModelEndpoint>, IModelEndpoint
{
    public IModel Model { get; }
    public IModelProvider Provider { get; }
    public decimal? InputTokenCost { get; }
    public decimal? OutputTokenCost { get; }

    public ModelEndpoint(
        IModel model,
        IModelProvider provider,
        decimal? inputTokenCost,
        decimal? outputTokenCost,
        IRepository<IModelEndpoint> repository) : base(repository)
    {
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
        IRepository<IModelEndpoint> repository)
        : base(existing, repository)
    {
        Model = model;
        Provider = provider;
        InputTokenCost = inputTokenCost;
        OutputTokenCost = outputTokenCost;
    }

    public decimal? CalculateCost(TokenUsage usage) 
        => this is { InputTokenCost: not null, OutputTokenCost: not null }
            ? (InputTokenCost.Value * usage.InputTokenCount + OutputTokenCost.Value * usage.OutputTokenCount) /
              1_000_000m
            : null;

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

