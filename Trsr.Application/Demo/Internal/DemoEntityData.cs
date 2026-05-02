using Trsr.Domain;

namespace Trsr.Application.Demo.Internal;

internal record DemoEntityData(
    Guid Id,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt) : IDomainEntityData;
