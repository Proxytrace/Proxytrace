using System.ComponentModel.DataAnnotations;
using Trsr.Common.Conversion;
using Trsr.Common.Validation;

namespace Trsr.Domain.Internal;

/// <inheritdoc cref="IDomainEntity" />
internal abstract record DomainEntity<TSelf> : 
    IDomainEntity<TSelf> 
    where TSelf : class, IDomainEntity
{
    private readonly IRepository<TSelf> repository;

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
        foreach (var __r in Validation.NotDefault(Id).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.InPast(CreatedAt).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.InPast(UpdatedAt).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.NotBefore(UpdatedAt, CreatedAt).AsEnumerable()) yield return __r;
    }

    public Task<TSelf> ReloadAsync(CancellationToken cancellationToken = default)
        => repository.GetAsync(Id, cancellationToken);

    public Task<TSelf> AddAsync(CancellationToken cancellationToken = default)
        => repository.AddAsync(this.As<TSelf>(), cancellationToken);

    public Task<TSelf> UpdateAsync(CancellationToken cancellationToken = default)
        => repository.UpdateAsync(this.As<TSelf>(), cancellationToken);

    /// <summary>
    /// Validates the mutated copy and persists it. Use with `with` expressions:
    /// <code>return ApplyAsync(this with { Endpoint = newEndpoint }, cancellationToken);</code>
    /// </summary>
    protected Task<TSelf> ApplyAsync(TSelf updated, CancellationToken cancellationToken = default)
    {
        Validator.ValidateObject(updated, new ValidationContext(updated), validateAllProperties: true);
        return repository.UpdateAsync(updated, cancellationToken);
    }

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