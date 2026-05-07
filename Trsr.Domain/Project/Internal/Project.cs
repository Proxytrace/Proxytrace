using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Organization;

namespace Trsr.Domain.Project.Internal;

internal record Project : DomainEntity<IProject>, IProject
{
    public string Name { get; }
    public IModelEndpoint SystemEndpoint { get; }
    public IOrganization Organization { get; }

    public Project(
        string name,
        IModelEndpoint systemEndpoint,
        IOrganization organization,
        IRepository<IProject> repository) : base(repository)
    {
        Name = name;
        SystemEndpoint = systemEndpoint;
        Organization = organization;
    }

    public Project(
        string name,
        IModelEndpoint systemEndpoint,
        IOrganization organization,
        IDomainEntityData existing,
        IRepository<IProject> repository) : base(existing, repository)
    {
        Name = name;
        SystemEndpoint = systemEndpoint;
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
        
        foreach (var result in SystemEndpoint.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in Organization.Validate(validationContext))
        {
            yield return result;
        }
    }
}
