using Autofac;
using Proxytrace.Application.Demo;

namespace Proxytrace.PerfHarness.Bootstrap;

/// <summary>
/// Owns the root Autofac container for a harness run and hands out per-operation lifetime scopes
/// (each scope mimics one request: a fresh ambient DB context / transaction).
/// </summary>
internal sealed class PerfContainer : IAsyncDisposable
{
    private readonly IContainer container;

    private PerfContainer(IContainer container)
    {
        this.container = container;
    }

    public static PerfContainer Build(string connectionString)
    {
        var builder = new ContainerBuilder();
        builder.RegisterModule(new PerfModule(connectionString));
        return new PerfContainer(builder.Build());
    }

    /// <summary>Applies all EF migrations to the (real, relational) perf database.</summary>
    public async Task ApplyMigrationsAsync(CancellationToken cancellationToken)
    {
        await using var scope = container.BeginLifetimeScope();
        var initializer = scope.Resolve<IDatabaseInitializer>();
        await initializer.EnsureDatabaseReadyAsync(cancellationToken);
    }

    /// <summary>Resolves a service from a throwaway scope and runs <paramref name="work"/> with it.</summary>
    public async Task<T> InScopeAsync<T>(Func<ILifetimeScope, Task<T>> work)
    {
        await using var scope = container.BeginLifetimeScope();
        return await work(scope);
    }

    public async Task InScopeAsync(Func<ILifetimeScope, Task> work)
    {
        await using var scope = container.BeginLifetimeScope();
        await work(scope);
    }

    /// <summary>A fresh lifetime scope the caller owns and disposes.</summary>
    public ILifetimeScope BeginScope() => container.BeginLifetimeScope();

    public ValueTask DisposeAsync() => container.DisposeAsync();
}
