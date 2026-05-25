using System.ComponentModel.DataAnnotations;

namespace Proxytrace.Common.Validation;

public static class ValidatorExtensions
{
    public static void Validate(this IValidatableObject validatableObject) 
        => Validator.ValidateObject(validatableObject, new ValidationContext(validatableObject), true);
}