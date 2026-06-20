namespace Proxytrace.Domain.User;

/// <summary>
/// The set of UI languages the application can be displayed in, as BCP-47 culture codes.
/// English (<see cref="Default"/>) is the canonical source language; the others are produced by the
/// frontend translation tooling. Kept in sync with the frontend's <c>lingui.config.ts</c>
/// <c>locales</c> array.
/// </summary>
public static class SupportedLanguages
{
    /// <summary>The source language and the default for newly created users.</summary>
    public const string Default = "en";

    /// <summary>All selectable UI language codes, including <see cref="Default"/>.</summary>
    public static IReadOnlyList<string> All { get; } = ["en", "de", "fr", "es", "it"];

    /// <summary>True when <paramref name="code"/> is a language the UI can be displayed in.</summary>
    public static bool IsSupported(string? code) => code is not null && All.Contains(code);
}
