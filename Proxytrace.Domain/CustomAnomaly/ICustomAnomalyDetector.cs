using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Project;

namespace Proxytrace.Domain.CustomAnomaly;

/// <summary>
/// A user-defined, LLM-based anomaly detector. Trigger words/regexes gate an asynchronous LLM
/// review of each new conversation turn; an anomalous verdict flags the call
/// (<c>OutlierFlags.CustomAnomaly</c>) and records an <see cref="ICustomAnomalyResult"/>. The
/// review instructions live as the system prompt of a hidden system <see cref="Agent"/>, mirroring
/// <c>IAgenticEvaluator</c>.
/// </summary>
public interface ICustomAnomalyDetector : IDomainEntity<ICustomAnomalyDetector>
{
    public const int MaxTriggers = 20;

    string Name { get; }

    /// <summary>
    /// The hidden system agent that performs the LLM review; its system prompt holds the
    /// detector's review instructions and its endpoint selects the judge model.
    /// </summary>
    IAgent Agent { get; }

    IReadOnlyList<AnomalyTrigger> Triggers { get; }

    /// <summary>Whether the detector applies to every agent of the project.</summary>
    bool AllAgents { get; }

    /// <summary>The agents the detector applies to when <see cref="AllAgents"/> is false.</summary>
    IReadOnlyCollection<IAgent> ScopedAgents { get; }

    bool IsEnabled { get; }

    /// <summary>The owning project (the hidden agent's project).</summary>
    IProject Project { get; }

    public delegate ICustomAnomalyDetector CreateNew(
        string name,
        IAgent agent,
        IReadOnlyList<AnomalyTrigger> triggers,
        bool allAgents,
        IReadOnlyCollection<IAgent> scopedAgents,
        bool isEnabled);

    public delegate ICustomAnomalyDetector CreateExisting(
        string name,
        IAgent agent,
        IReadOnlyList<AnomalyTrigger> triggers,
        bool allAgents,
        IReadOnlyCollection<IAgent> scopedAgents,
        bool isEnabled,
        IDomainEntityData existing);

    /// <summary>
    /// Updates the detector's editable fields (name, triggers, scope, enabled). The review
    /// instructions are not touched here — they live on <see cref="Agent"/>'s system prompt and
    /// change via <c>IAgent.CreateNewVersionAsync</c>.
    /// </summary>
    Task<ICustomAnomalyDetector> Update(
        string name,
        IReadOnlyList<AnomalyTrigger> triggers,
        bool allAgents,
        IReadOnlyCollection<IAgent> scopedAgents,
        bool isEnabled,
        CancellationToken cancellationToken = default);
}
