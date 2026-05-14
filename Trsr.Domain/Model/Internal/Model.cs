using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Model.Internal;

internal record Model : DomainEntity<IModel>, IModel
{
    public string Name { get; }

    public Model(string name, IRepository<IModel> repository) : base(repository)
    {
        Name = name;
    }

    public Model(string name, IDomainEntityData existing, IRepository<IModel> repository) : base(existing, repository)
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

