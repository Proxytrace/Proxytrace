using System.ComponentModel.DataAnnotations;
using System.Runtime.CompilerServices;

namespace Trsr.Common.Validation;

public static class Validation
{
    public static ValidationResult NotNullOrWhitespace(string value, [CallerMemberName] string memberName = "") 
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
}