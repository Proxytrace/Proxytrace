using Proxytrace.Domain.ApplicationError;

namespace Proxytrace.Api.Dto.ApplicationErrors;

public record ApplicationErrorDto(
    Guid Id,
    string Message,
    ApplicationErrorLevel Level,
    string Category,
    string? ExceptionType,
    string? StackTrace,
    DateTimeOffset CreatedAt);
