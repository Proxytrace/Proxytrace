namespace Proxytrace.Domain.AuditLog;

/// <summary>
/// The kind of audited system action. Values are stable (persisted as ints and reused as the
/// <c>EventId</c> of the audit log messages) — append new members, never renumber existing ones.
/// </summary>
public enum AuditAction
{
    TestRunStarted = 0,
    ApiKeyMinted = 1,
    ApiKeyDeleted = 2,
    ProjectDeleted = 3,
    ProjectMemberAdded = 4,
    ProjectMemberRemoved = 5,
    LicenseSet = 6,
    LicenseRemoved = 7,
    TestSuiteDeleted = 8,
    EvaluatorDeleted = 9,
    TestCaseDeleted = 10,
    ProviderConfigCreated = 11,
    ProviderConfigUpdated = 12,
    EndpointConfigCreated = 13,
    EndpointConfigUpdated = 14,
    ProviderConfigDeleted = 15,
    EndpointConfigDeleted = 16,
    UserRoleChanged = 17,
    UserDeleted = 18,
    AgentDeleted = 19,

    // Creation / modification of project-scoped entities (the delete counterparts are above).
    ProjectCreated = 20,
    ProjectRenamed = 21,
    AgentEndpointChanged = 22,
    EvaluatorCreated = 23,
    EvaluatorUpdated = 24,
    TestSuiteCreated = 25,
    TestSuiteUpdated = 26,
    TestCaseCreated = 27,

    // Authentication & identity lifecycle.
    UserInvited = 28,
    InviteRevoked = 29,
    UserSignedUp = 30,
    UserLoggedIn = 31,
    LoginFailed = 32,
    UserLoggedOut = 33,
    AdminBootstrapped = 34,
    LegacyAccountClaimed = 35,

    // Optimization proposal state transitions (e.g. via the MCP server).
    ProposalStatusChanged = 36,
}
