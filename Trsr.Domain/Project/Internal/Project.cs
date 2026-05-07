using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Project.Internal;

internal record Project : DomainEntity<IProject>, IProject
{
    public string Name { get; }

    public Project(string name, IRepository<IProject> repository) : base(repository)
    {
        Name = name;
    }

    public Project(string name, IDomainEntityData existing, IRepository<IProject> repository) : base(existing, repository)
    {
        Name = name;
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
    }
}
