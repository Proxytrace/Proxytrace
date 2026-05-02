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
    private readonly ICustomEvaluator.CreateExisting createCustom;
    private readonly IHelpfulnessEvaluator.CreateExisting createHelpfulness;
    private readonly IRepository<IModelEndpoint> modelEndpoints;
    private readonly ISerializer serializer;

    public EvaluatorConfig(
        IExactMatchEvaluator.CreateExisting createExactMatch,
        ICustomEvaluator.CreateExisting createCustom,
        IHelpfulnessEvaluator.CreateExisting createHelpfulness,
        IRepository<IModelEndpoint> modelEndpoints,
        ISerializer serializer)
    {
        this.createExactMatch = createExactMatch;
        this.createCustom = createCustom;
        this.createHelpfulness = createHelpfulness;
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
            EvaluatorKind.Custom => await MapCustom(stored, cancellationToken),
            EvaluatorKind.Helpfulness => await MapHelpfulness(stored, cancellationToken),
            _ => throw new InvalidOperationException($"Unknown evaluator kind: {stored.Kind}")
        };

    private async Task<IEvaluator> MapHelpfulness(EvaluatorEntity stored, CancellationToken cancellationToken)
    {
        var data = serializer.DeserializeRequired<CustomEvaluatorData>(stored.Data);
        var endpoint = await modelEndpoints.GetAsync(data.EndpointId, cancellationToken);
        return createHelpfulness(endpoint, stored);
    }

    private async Task<ICustomEvaluator> MapCustom(EvaluatorEntity stored, CancellationToken cancellationToken)
    {
        var data = serializer.DeserializeRequired<CustomEvaluatorData>(stored.Data);
        var endpoint = await modelEndpoints.GetAsync(data.EndpointId, cancellationToken);
        return createCustom(data.SystemMessage, endpoint, stored);
    }

    public Task<EvaluatorEntity> Map(IEvaluator domain, CancellationToken cancellationToken = default)
    {
        string data = domain switch
        {
            ICustomEvaluator agentic => serializer.Serialize(new CustomEvaluatorData(agentic.SystemMessage, agentic.Endpoint.Id)),
            IHelpfulnessEvaluator helpfulness => serializer.Serialize(new CustomEvaluatorData(helpfulness.SystemMessage, helpfulness.Endpoint.Id)),
            IExactMatchEvaluator => serializer.Serialize(new ExactMatchEvaluatorData()),
            _ => throw new NotSupportedException($"Unsupported evaluator type: {domain.GetType()}")
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
