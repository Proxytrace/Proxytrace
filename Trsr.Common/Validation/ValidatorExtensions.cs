using System.ComponentModel.DataAnnotations;

namespace Trsr.Common.Validation;

public static class ValidatorExtensions
{
    public static void Validate(this IValidatableObject validatableObject) 
        => Validator.ValidateObject(validatableObject, new ValidationContext(validatableObject), true);
}