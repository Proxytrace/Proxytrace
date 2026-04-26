using Trsr.Domain;

namespace Trsr.Api.Services.Internal;

internal record DemoEntityData(
    Guid Id,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt) : IDomainEntityData;
