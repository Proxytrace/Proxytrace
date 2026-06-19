using System.ComponentModel.DataAnnotations;
using Proxytrace.Common.Conversion;
using Proxytrace.Common.Validation;

namespace Proxytrace.Domain.Internal;

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

    /// <inheritdoc />
    public bool IsArchived { get; }

    /// <summary>
    /// Creates a new instance
    /// </summary>
    protected DomainEntity(IRepository<TSelf> repository)
    {
        this.repository = repository;

        Id = Guid.NewGuid();
        CreatedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
        IsArchived = false;
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
        IsArchived = existing.IsArchived;
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

    // Identity is the Id alone. Two instances of the same entity — the pre- and post-save copies of
    // an UpdatedAt-bumping persist, or a reloaded row — must compare equal and hash identically.
    // CreatedAt/UpdatedAt are deliberately excluded: folding the storage-stamped UpdatedAt into
    // equality would make a reloaded/re-saved entity unequal to its in-memory original and give it a
    // different hash bucket, silently breaking set/dictionary membership.
    public virtual bool Equals(DomainEntity<TSelf>? other)
        => other is not null
           && EqualityContract == other.EqualityContract
           && Id == other.Id;

    public override int GetHashCode()
        => HashCode.Combine(EqualityContract, Id);
}