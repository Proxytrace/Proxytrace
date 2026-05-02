using System.Collections;
using System.ComponentModel.DataAnnotations;
using System.Runtime.CompilerServices;
// ReSharper disable NullableWarningSuppressionIsUsed

namespace Trsr.Common.Validation;

public static class Validation
{
    public static ValidationResult NotNull(object? value, [CallerMemberName] string memberName = "")
        => value is null
            ? new ValidationResult($"{memberName} cannot be null", [memberName]) 
            : ValidationResult.Success!;
    
    public static ValidationResult Null(object? value, [CallerMemberName] string memberName = "")
        => value is not null
            ? new ValidationResult($"{memberName} must be null", [memberName]) 
            : ValidationResult.Success!;
    
    public static ValidationResult NotNullOrWhiteSpace(string? value, [CallerMemberName] string memberName = "") 
        => string.IsNullOrWhiteSpace(value)
            ? new ValidationResult($"{memberName} cannot be empty", [memberName]) 
            : ValidationResult.Success!;
    
    public static ValidationResult NotDefault<T>(T value, [CallerMemberName] string memberName = "")
        => EqualityComparer<T>.Default.Equals(value, default!)
            ? new ValidationResult($"{memberName} cannot be default", [memberName]) 
            : ValidationResult.Success!;
    
    public static ValidationResult InPast(DateTimeOffset  value, [CallerMemberName] string memberName = "")
        => value > DateTimeOffset.UtcNow
            ? new ValidationResult($"{memberName} must be in the past", [memberName]) 
            : ValidationResult.Success!;
    
    public static ValidationResult NotBefore(DateTimeOffset value, DateTimeOffset minValue, [CallerMemberName] string memberName = "")
        => value < minValue
            ? new ValidationResult($"{memberName} cannot be before {minValue}", [memberName]) 
            : ValidationResult.Success!;
    
    public static ValidationResult NotNegative(decimal value, [CallerMemberName] string memberName = "")
        => value < 0
            ? new ValidationResult($"{memberName} cannot be negative", [memberName]) 
            : ValidationResult.Success!;
    
    public static ValidationResult HasCount<T>(IReadOnlyCollection<T> value, int count, [CallerMemberName] string memberName = "")
        => value.Count != count
            ? new ValidationResult($"{memberName} must have {count} items", [memberName]) 
            : ValidationResult.Success!;
    
    public static ValidationResult MaxLength(string? value, int maxLength, [CallerMemberName] string memberName = "")
        => (value?.Length ?? 0) > maxLength
            ? new ValidationResult($"{memberName} cannot be longer than {maxLength} characters", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult MinLength(string? value, int minLength, [CallerMemberName] string memberName = "")
        => (value?.Length ?? 0) < minLength
            ? new ValidationResult($"{memberName} cannot be shorter than {minLength} characters", [memberName])
            : ValidationResult.Success!;
    
    public static ValidationResult NotEmpty(string? value, [CallerMemberName] string memberName = "")
        => MinLength(value, 1, memberName);
    
    public static ValidationResult NotEmpty<T>(IReadOnlyCollection<T> value, [CallerMemberName] string memberName = "")
        => value.Count == 0
            ? new ValidationResult($"{memberName} cannot be empty", [memberName]) 
            : ValidationResult.Success!;

    public static ValidationResult Positive(decimal value, [CallerMemberName] string memberName = "")
        => value <= 0
            ? new ValidationResult($"{memberName} must be positive")
            : ValidationResult.Success!;

    public static ValidationResult LessThan(decimal value, decimal maxValue, [CallerMemberName] string memberName = "") 
        => value >= maxValue
            ? new ValidationResult($"{memberName} must be less than {maxValue}")
            : ValidationResult.Success!;

    public static ValidationResult LessThanOrEqual(decimal value, decimal maxValue, [CallerMemberName] string memberName = "") 
        => value > maxValue
            ? new ValidationResult($"{memberName} must be less than or equal to {maxValue}")
            : ValidationResult.Success!;
    
    public static ValidationResult Defined<TEnum>(TEnum value, [CallerMemberName] string memberName = "")
        where TEnum : struct, Enum
        => !Enum.IsDefined(typeof(TEnum), value)
            ? new ValidationResult($"{memberName} has an undefined value {value}")
            : ValidationResult.Success!;
}