namespace Proxytrace.Domain.AuditLog;

/// <summary>
/// Generator for <see cref="IAuditLogEntry"/> test data, with an overload that persists an entry
/// at a specific <c>CreatedAt</c> (used to exercise age-based retention).
/// </summary>
public interface IAuditLogEntryGenerator : IDomainEntityGenerator<IAuditLogEntry>
{
    Task<IAuditLogEntry> CreateAsync(DateTimeOffset createdAt, CancellationToken cancellationToken = default);
}
