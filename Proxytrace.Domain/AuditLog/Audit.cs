namespace Proxytrace.Domain.AuditLog;

/// <summary>
/// Logger category marker for audit events. Inject <c>ILogger&lt;Audit&gt;</c> and call
/// <see cref="AuditLogExtensions.LogAudit"/>; the dedicated category lets the audit capture provider
/// recognize these entries and persist them to the audit log (everything else on the category is ignored).
/// </summary>
public sealed class Audit;
