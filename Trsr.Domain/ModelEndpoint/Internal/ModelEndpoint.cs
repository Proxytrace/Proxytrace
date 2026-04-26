using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Model;
using Trsr.Domain.ModelProvider;

namespace Trsr.Domain.ModelEndpoint.Internal;

internal record ModelEndpoint : DomainEntity, IModelEndpoint
{
    public IModel Model { get; }
    public IModelProvider Provider { get; }
    public decimal InputTokenCost { get; }
    public decimal OutputTokenCost { get; }

    public ModelEndpoint(
        IModel model,
        IModelProvider provider,
        decimal inputTokenCost,
        decimal outputTokenCost)
    {
        Model = model;
        Provider = provider;
        InputTokenCost = inputTokenCost;
        OutputTokenCost = outputTokenCost;
    }

    public ModelEndpoint(
        IModel model, 
        IModelProvider provider, 
        decimal inputTokenCost,
        decimal outputTokenCost,
        IDomainEntityData existing)
        : base(existing)
    {
        Model = model;
        Provider = provider;
        InputTokenCost = inputTokenCost;
        OutputTokenCost = outputTokenCost;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in Model.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in Provider.Validate(validationContext))
        {
            yield return result;
        }

        yield return Validation.Positive(InputTokenCost);
        yield return Validation.Positive(OutputTokenCost);
        
        // sanity check -> input token cost is always less than or equal to outputtoken cost
        yield return Validation.LessThanOrEqual(InputTokenCost, OutputTokenCost);
    }
}

