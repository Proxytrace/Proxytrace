using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;

namespace Trsr.Storage.Internal.Entities.Evaluator;

internal class EvaluatorConfig : AbstractEntityConfiguration<EvaluatorEntity>, IMapper<IEvaluator, EvaluatorEntity>
{
    private readonly IExactMatchEvaluator.CreateExisting createExactMatch;
    private readonly IAgenticEvaluator.CreateExisting createAgentic;
    private readonly ISerializer serializer;

    public EvaluatorConfig(
        IExactMatchEvaluator.CreateExisting createExactMatch,
        IAgenticEvaluator.CreateExisting createAgentic,
        ISerializer serializer)
    {
        this.createExactMatch = createExactMatch;
        this.createAgentic = createAgentic;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<EvaluatorEntity> builder)
    {
        builder.HasIndex(e => e.Kind);
    }
    
    public Task<IEvaluator> Map(EvaluatorEntity stored, CancellationToken cancellationToken = default)
        => throw new NotImplementedException();


    public Task<EvaluatorEntity> Map(IEvaluator domain, CancellationToken cancellationToken = default)
        => throw new NotImplementedException();
}
