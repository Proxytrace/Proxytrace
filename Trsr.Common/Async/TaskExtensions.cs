using System.Diagnostics.CodeAnalysis;

namespace Trsr.Common.Async;

public static class TaskExtensions
{
    public static Task<T> ToTaskResult<T>(this T value)
        => Task.FromResult(value);
}