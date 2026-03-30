using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Domain.Evaluator;

namespace Trsr.Storage.Internal.Entities.Evaluator;

internal class EvaluatorConfig : AbstractEntityConfiguration<EvaluatorEntity>, IMapper<IEvaluator, EvaluatorEntity>
{
    private readonly IEvaluator.CreateExisting factory;

    public EvaluatorConfig(IEvaluator.CreateExisting factory)
    {
        this.factory = factory;
    }

    public override void Configure(EntityTypeBuilder<EvaluatorEntity> builder)
    {
        builder.HasIndex(e => e.Kind);
    }

    public IEvaluator Map(EvaluatorEntity storedEntity)
        => factory(storedEntity);

    public EvaluatorEntity Map(IEvaluator domainEntity)
        => new()
        {
            Id = domainEntity.Id,
            Kind = domainEntity.Kind,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        };
}
