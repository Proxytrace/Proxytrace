using System.ComponentModel.DataAnnotations;
using Trsr.Common.Conversion;
using Trsr.Common.Validation;

namespace Trsr.Domain.Internal;

/// <inheritdoc cref="IDomainEntity" />
internal abstract record DomainEntity<TSelf> : 
    IDomainEntity<TSelf> 
    where TSelf : class, IDomainEntity
{
    protected readonly IRepository<TSelf> repository;

    /// <inheritdoc />
    public Guid Id { get; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAt { get; }

    /// <inheritdoc />
    public DateTimeOffset UpdatedAt { get; }

    /// <summary>
    /// Creates a new instance
    /// </summary>
    protected DomainEntity(IRepository<TSelf> repository)
    {
        this.repository = repository;
        
        Id = Guid.NewGuid();
        CreatedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
    
    /// <summary>
    /// Creates a new instance from existing data
    /// </summary>
    protected DomainEntity(IDomainEntityData existing, IRepository<TSelf> repository)
    {
        this.repository = repository;
        
        Id = existing.Id;
        CreatedAt = existing.CreatedAt;
        UpdatedAt = existing.UpdatedAt;
    }
    
    /// <inheritdoc />
    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield return Validation.NotDefault(Id);
        yield return Validation.InPast(CreatedAt);
        yield return Validation.InPast(UpdatedAt);
        yield return Validation.NotBefore(UpdatedAt, CreatedAt);
    }

    public Task<TSelf> ReloadAsync(CancellationToken cancellationToken = default)
        => repository.GetAsync(Id, cancellationToken);

    public Task<TSelf> AddAsync(CancellationToken cancellationToken = default)
        => repository.AddAsync(this.As<TSelf>(), cancellationToken);

    public Task<TSelf> UpdateAsync(CancellationToken cancellationToken = default)
        => repository.UpdateAsync(this.As<TSelf>(), cancellationToken);

    public Task<TSelf> UpsertAsync(CancellationToken cancellationToken = default)
        => repository.UpsertAsync(this.As<TSelf>(), cancellationToken);

    public Task RemoveAsync(CancellationToken cancellationToken = default)
        => repository.RemoveAsync(Id, cancellationToken);

    public virtual bool Equals(DomainEntity<TSelf>? other)
        => other is not null
           && EqualityContract == other.EqualityContract
           && Id == other.Id
           && CreatedAt == other.CreatedAt
           && UpdatedAt == other.UpdatedAt;

    public override int GetHashCode()
        => HashCode.Combine(EqualityContract, Id, CreatedAt, UpdatedAt);
}