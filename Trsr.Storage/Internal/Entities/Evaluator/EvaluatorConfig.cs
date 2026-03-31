using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
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

    public Task<IEvaluator> Map(EvaluatorEntity stored, CancellationToken cancellationToken = default)
        => factory(stored.Kind, stored).ToTaskResult();

    public Task<EvaluatorEntity> Map(IEvaluator domain, CancellationToken cancellationToken = default)
        => new EvaluatorEntity
        {
            Id = domain.Id,
            Kind = domain.Kind,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
