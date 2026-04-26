using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Model.Internal;

internal record Model : DomainEntity, IModel
{
    public string Name { get; }

    public Model(string name)
    {
        Name = name;
    }

    public Model(string name, IDomainEntityData existing) : base(existing)
    {
        Name = name;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }
        yield return Validation.NotNullOrWhiteSpace(Name);
    }
}

