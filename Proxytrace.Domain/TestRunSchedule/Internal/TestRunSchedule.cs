using System.ComponentModel.DataAnnotations;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Domain.TestRunSchedule.Internal;

internal record TestRunSchedule : DomainEntity<ITestRunSchedule>, ITestRunSchedule
{
    public string Name { get; private init; }
    public ITestSuite Suite { get; private init; }
    public IReadOnlyCollection<IModelEndpoint> Endpoints { get; private init; }
    public TimeSpan Interval { get; private init; }
    public bool IsEnabled { get; private init; }
    public DateTimeOffset NextRunAt { get; private init; }
    public DateTimeOffset? LastRunAt { get; private init; }

    public TestRunSchedule(
        string name, ITestSuite suite, IReadOnlyCollection<IModelEndpoint> endpoints,
        TimeSpan interval, bool isEnabled, IRepository<ITestRunSchedule> repository) : base(repository)
    {
        Name = name;
        Suite = suite;
        Endpoints = endpoints.ToArray();
        Interval = interval;
        IsEnabled = isEnabled;
        NextRunAt = CreatedAt + interval;
        LastRunAt = null;
    }

    public TestRunSchedule(
        string name, ITestSuite suite, IReadOnlyCollection<IModelEndpoint> endpoints,
        TimeSpan interval, bool isEnabled, DateTimeOffset nextRunAt, DateTimeOffset? lastRunAt,
        IDomainEntityData existing, IRepository<ITestRunSchedule> repository) : base(existing, repository)
    {
        Name = name;
        Suite = suite;
        Endpoints = endpoints.ToArray();
        Interval = interval;
        IsEnabled = isEnabled;
        NextRunAt = nextRunAt;
        LastRunAt = lastRunAt;
    }

    public Task<ITestRunSchedule> Disable(CancellationToken cancellationToken = default)
        => ApplyAsync(this with { IsEnabled = false }, cancellationToken);

    public Task<ITestRunSchedule> Enable(CancellationToken cancellationToken = default)
        => ApplyAsync(this with { IsEnabled = true }, cancellationToken);

    public Task<ITestRunSchedule> RecordFired(DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var next = NextRunAt;
        // Validation guarantees a positive (>= 1 minute) interval, so this loop always terminates.
        while (next <= now)
            next += Interval;

        return ApplyAsync(this with { LastRunAt = now, NextRunAt = next }, cancellationToken);
    }

    public Task<ITestRunSchedule> Update(
        string name, IReadOnlyCollection<IModelEndpoint> endpoints,
        TimeSpan interval, bool isEnabled, CancellationToken cancellationToken = default)
        => ApplyAsync(this with
        {
            Name = name,
            Endpoints = endpoints.ToArray(),
            Interval = interval,
            IsEnabled = isEnabled,
        }, cancellationToken);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        if (string.IsNullOrWhiteSpace(Name))
            yield return Validation.NotNullOrWhiteSpace(Name);

        if (Interval < TimeSpan.FromMinutes(1))
            yield return new ValidationResult("Schedule interval must be at least one minute.", [nameof(Interval)]);

        if (Endpoints.Count == 0)
            yield return new ValidationResult("A schedule must target at least one endpoint.", [nameof(Endpoints)]);

        foreach (var result in Suite.Validate(validationContext))
            yield return result;
    }
}
