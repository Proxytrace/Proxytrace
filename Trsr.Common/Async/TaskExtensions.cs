using System.Diagnostics.CodeAnalysis;

namespace Trsr.Common.Async;

public static class TaskExtensions
{
    public static Task<T> ToTaskResult<T>(this T value)
        => Task.FromResult(value);
    
    public static async Task<IReadOnlyCollection<T>> Await<T>(this IEnumerable<Task<T>> tasks)
        => await Task.WhenAll(tasks);
}