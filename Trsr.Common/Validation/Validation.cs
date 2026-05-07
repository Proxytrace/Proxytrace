using System.ComponentModel.DataAnnotations;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.RegularExpressions;
// ReSharper disable NullableWarningSuppressionIsUsed

namespace Trsr.Common.Validation;

public static class Validation
{
    public static ValidationResult NotNull(object? value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value is null
            ? new ValidationResult($"{memberName} cannot be null", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult Null(object? value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value is not null
            ? new ValidationResult($"{memberName} must be null", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult NotNullOrWhiteSpace(string? value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => string.IsNullOrWhiteSpace(value)
            ? new ValidationResult($"{memberName} cannot be empty", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult NotNullOrEmpty(string? value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => string.IsNullOrEmpty(value)
            ? new ValidationResult($"{memberName} cannot be null or empty", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult NotDefault<T>(T value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => EqualityComparer<T>.Default.Equals(value, default!)
            ? new ValidationResult($"{memberName} cannot be default", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult InPast(DateTimeOffset value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value > DateTimeOffset.UtcNow
            ? new ValidationResult($"{memberName} must be in the past", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult InFuture(DateTimeOffset value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value <= DateTimeOffset.UtcNow
            ? new ValidationResult($"{memberName} must be in the future", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult NotBefore(DateTimeOffset value, DateTimeOffset minValue, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value < minValue
            ? new ValidationResult($"{memberName} cannot be before {minValue}", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult NotAfter(DateTimeOffset value, DateTimeOffset maxValue, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value > maxValue
            ? new ValidationResult($"{memberName} cannot be after {maxValue}", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult NotNegative(decimal value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value < 0
            ? new ValidationResult($"{memberName} cannot be negative", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult Positive(decimal value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value <= 0
            ? new ValidationResult($"{memberName} must be positive", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult LessThan(decimal value, decimal maxValue, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value >= maxValue
            ? new ValidationResult($"{memberName} must be less than {maxValue}", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult LessThanOrEqual(decimal value, decimal maxValue, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value > maxValue
            ? new ValidationResult($"{memberName} must be less than or equal to {maxValue}", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult GreaterThan(decimal value, decimal minValue, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value <= minValue
            ? new ValidationResult($"{memberName} must be greater than {minValue}", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult GreaterThanOrEqual(decimal value, decimal minValue, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value < minValue
            ? new ValidationResult($"{memberName} must be greater than or equal to {minValue}", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult HasCount<T>(IReadOnlyCollection<T> value, int count, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value.Count != count
            ? new ValidationResult($"{memberName} must have {count} items", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult MaxLength(string? value, int maxLength, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => (value?.Length ?? 0) > maxLength
            ? new ValidationResult($"{memberName} cannot be longer than {maxLength} characters", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult MinLength(string? value, int minLength, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => (value?.Length ?? 0) < minLength
            ? new ValidationResult($"{memberName} cannot be shorter than {minLength} characters", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult ExactLength(string? value, int length, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => (value?.Length ?? 0) != length
            ? new ValidationResult($"{memberName} must be exactly {length} characters", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult NotEmpty(string? value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => MinLength(value, 1, memberName);

    public static ValidationResult NotEmpty<T>(IReadOnlyCollection<T> value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value.Count == 0
            ? new ValidationResult($"{memberName} cannot be empty", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult Matches(string? value, string pattern, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value is null || !Regex.IsMatch(value, pattern)
            ? new ValidationResult($"{memberName} does not match the required pattern", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult ValidUri(string? value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => !Uri.TryCreate(value, UriKind.Absolute, out var uri) || string.IsNullOrEmpty(uri.Host)
            ? new ValidationResult($"{memberName} must be a valid absolute URI", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult Defined<TEnum>(TEnum value, [CallerArgumentExpression(nameof(value))] string memberName = "")
        where TEnum : struct, Enum
        => !Enum.IsDefined(typeof(TEnum), value)
            ? new ValidationResult($"{memberName} has an undefined value {value}", [memberName])
            : ValidationResult.Success!;

    public static ValidationResult Json(string value, [CallerArgumentExpression(nameof(value))] string memberName = "")
    {
        try
        {
            JsonDocument.Parse(value);
            return ValidationResult.Success!;
        }
        catch
        {
            return new ValidationResult($"{memberName} is not valid JSON", [memberName]);
        }
    }

    public static ValidationResult InRange(int value, int greateOrEqual, int lessOrEqual, [CallerArgumentExpression(nameof(value))] string memberName = "")
        => value < greateOrEqual || value > lessOrEqual
            ? new ValidationResult($"{memberName} must be between {greateOrEqual} and {lessOrEqual}")
            : ValidationResult.Success!;

    public static ValidationResult GreaterThan(int variable, int greaterThan, [CallerArgumentExpression(nameof(variable))] string memberName = "")
        => variable <= greaterThan
            ? new ValidationResult($"{memberName} must be greater than {greaterThan}")
            : ValidationResult.Success!;

    public static ValidationResult Positive(TimeSpan variable, [CallerArgumentExpression(nameof(variable))] string memberName = "")
        => variable <= TimeSpan.Zero
            ? new ValidationResult($"{memberName} must be positive")
            : ValidationResult.Success!;
}
