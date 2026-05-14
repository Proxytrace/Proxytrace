namespace Trsr.Application.Demo;

internal interface IDemoScenario
{
    int Order { get; }

    Task SeedAsync(CancellationToken cancellationToken);
}
