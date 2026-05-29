namespace Proxytrace.Application.Auth.Local;

public interface IPasswordPolicy
{
    PasswordValidationResult Validate(string password);
}

public sealed record PasswordValidationResult(
    bool IsValid,
    IReadOnlyList<string> Errors)
{
    public static PasswordValidationResult Ok() => new(true, []);
    public static PasswordValidationResult Fail(params string[] errors) => new(false, errors);
}
