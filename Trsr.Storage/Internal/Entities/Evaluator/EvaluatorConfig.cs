using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain.Evaluator;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Storage.Internal.Entities.Evaluator;

internal class EvaluatorConfig : AbstractEntityConfiguration<EvaluatorEntity>, IMapper<IEvaluator, EvaluatorEntity>
{
    private readonly IExactMatchEvaluator.CreateExisting createExactMatch;
    private readonly IAgenticEvaluator.CreateExisting createAgentic;
    private readonly IRepository<IModelEndpoint> modelEndpoints;
    private readonly ISerializer serializer;

    public EvaluatorConfig(
        IExactMatchEvaluator.CreateExisting createExactMatch,
        IAgenticEvaluator.CreateExisting createAgentic,
        IRepository<IModelEndpoint> modelEndpoints,
        ISerializer serializer)
    {
        this.createExactMatch = createExactMatch;
        this.createAgentic = createAgentic;
        this.modelEndpoints = modelEndpoints;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<EvaluatorEntity> builder)
    {
        builder.HasIndex(e => e.Kind);
    }

    public async Task<IEvaluator> Map(EvaluatorEntity stored, CancellationToken cancellationToken = default)
        => stored.Kind switch
        {
            EvaluatorKind.ExactMatch => createExactMatch(stored),
            EvaluatorKind.Agentic => await MapAgentic(stored, cancellationToken),
            _ => throw new InvalidOperationException($"Unknown evaluator kind: {stored.Kind}")
        };

    private async Task<IAgenticEvaluator> MapAgentic(EvaluatorEntity stored, CancellationToken cancellationToken)
    {
        var data = serializer.DeserializeRequired<AgenticEvaluatorData>(stored.Data);
        var endpoint = await modelEndpoints.GetAsync(data.EndpointId, cancellationToken);
        return createAgentic(data.SystemMessage, endpoint, stored);
    }

    public Task<EvaluatorEntity> Map(IEvaluator domain, CancellationToken cancellationToken = default)
    {
        string data = domain switch
        {
            IAgenticEvaluator agentic => serializer.Serialize(new AgenticEvaluatorData
            {
                SystemMessage = agentic.SystemMessage,
                EndpointId = agentic.Endpoint.Id
            }),
            _ => serializer.Serialize(new ExactMatchEvaluatorData())
        };

        return new EvaluatorEntity
        {
            Id = domain.Id,
            Kind = domain.Kind,
            Data = data,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
    }
}
