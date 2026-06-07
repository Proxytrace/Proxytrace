using Proxytrace.Domain.ApplicationError;

namespace Proxytrace.Storage.Internal.Entities.ApplicationError;

[StoredDomainEntity(typeof(IApplicationError))]
internal record ApplicationErrorEntity : Entity
{
    public required string Message { get; init; }

    public required ApplicationErrorLevel Level { get; init; }

    public required string Category { get; init; }

    public string? ExceptionType { get; init; }

    public string? StackTrace { get; init; }
}
