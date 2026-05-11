using Trsr.Common.Random;

namespace Trsr.Domain.Internal;

internal abstract class DomainObjectGenerator<TDomainObject> : IDomainObjectGenerator<TDomainObject>
    where TDomainObject : IDomainObject
{
    protected readonly IRandom Random;
    
    protected DomainObjectGenerator(
        IRandom random)
    {
        this.Random = random;
    }

    public abstract Task<TDomainObject> CreateAsync(CancellationToken cancellationToken = default);
}