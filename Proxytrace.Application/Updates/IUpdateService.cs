namespace Proxytrace.Application.Updates;

/// <summary>
/// Exposes the latest known update status, maintained by a daily background check against
/// the public release feed.
/// </summary>
public interface IUpdateService
{
    UpdateStatus Current { get; }
}
