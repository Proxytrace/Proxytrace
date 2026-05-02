using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Evaluator;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Storage.Internal.Entities.Evaluator;

internal class EvaluatorConfig : AbstractEntityConfiguration<EvaluatorEntity>, IMapper<IEvaluator, EvaluatorEntity>
{
    private readonly IExactMatchEvaluator.CreateExisting createExactMatch;
    private readonly ICustomEvaluator.CreateExisting createCustom;
    private readonly IHelpfulnessEvaluator.CreateExisting createHelpfulness;
    private readonly IPolitenessEvaluator.CreateExisting createPoliteness;
    private readonly ISafetyClassifier.CreateExisting createSafety;
    private readonly IToolUsageEvaluator.CreateExisting createToolUsage;
    private readonly IJsonSchemaMatchEvaluator.CreateExisting createJsonSchemaMatch;
    private readonly INumericMatchEvaluator.CreateExisting createNumericMatch;
    private readonly IRepository<IModelEndpoint> modelEndpoints;
    private readonly ISerializer serializer;

    public EvaluatorConfig(
        IExactMatchEvaluator.CreateExisting createExactMatch,
        ICustomEvaluator.CreateExisting createCustom,
        IHelpfulnessEvaluator.CreateExisting createHelpfulness,
        IPolitenessEvaluator.CreateExisting createPoliteness,
        ISafetyClassifier.CreateExisting createSafety,
        IToolUsageEvaluator.CreateExisting createToolUsage,
        IJsonSchemaMatchEvaluator.CreateExisting createJsonSchemaMatch,
        INumericMatchEvaluator.CreateExisting createNumericMatch,
        IRepository<IModelEndpoint> modelEndpoints,
        ISerializer serializer)
    {
        this.createExactMatch = createExactMatch;
        this.createCustom = createCustom;
        this.createHelpfulness = createHelpfulness;
        this.createPoliteness = createPoliteness;
        this.createSafety = createSafety;
        this.createToolUsage = createToolUsage;
        this.createJsonSchemaMatch = createJsonSchemaMatch;
        this.createNumericMatch = createNumericMatch;
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
            EvaluatorKind.Helpfulness => await MapAgentic(stored, (ep, ex) => createHelpfulness(ep, ex), cancellationToken),
            EvaluatorKind.Politeness => await MapAgentic(stored, (ep, ex) => createPoliteness(ep, ex), cancellationToken),
            EvaluatorKind.Safety => await MapAgentic(stored, (ep, ex) => createSafety(ep, ex), cancellationToken),
            EvaluatorKind.ToolUsage => await MapAgentic(stored, (ep, ex) => createToolUsage(ep, ex), cancellationToken),
            EvaluatorKind.JsonSchemaMatch => MapJsonSchemaMatch(stored),
            EvaluatorKind.NumericMatch => MapNumericMatch(stored),
            _ => throw new InvalidOperationException($"Unknown evaluator kind: {stored.Kind}")
        };

    private async Task<IEvaluator> MapAgentic(
        EvaluatorEntity stored,
        Func<IModelEndpoint, IDomainEntityData, IEvaluator> create,
        CancellationToken cancellationToken)
    {
        var data = serializer.DeserializeRequired<AgenticEvaluatorData>(stored.Data);
        var endpoint = await modelEndpoints.GetAsync(data.EndpointId, cancellationToken);
        return create(endpoint, stored);
    }

    private async Task<ICustomEvaluator> MapCustom(EvaluatorEntity stored, CancellationToken cancellationToken)
    {
        var data = serializer.DeserializeRequired<CustomEvaluatorData>(stored.Data);
        var endpoint = await modelEndpoints.GetAsync(data.EndpointId, cancellationToken);
        return createCustom(data.Name, data.SystemMessage, endpoint, stored);
    }

    private IJsonSchemaMatchEvaluator MapJsonSchemaMatch(EvaluatorEntity stored)
    {
        var data = serializer.DeserializeRequired<JsonSchemaMatchEvaluatorData>(stored.Data);
        return createJsonSchemaMatch(data.JsonSchema, stored);
    }

    private INumericMatchEvaluator MapNumericMatch(EvaluatorEntity stored)
    {
        var data = serializer.DeserializeRequired<NumericMatchEvaluatorData>(stored.Data);
        return createNumericMatch(new Regex(data.ExtractionPattern), data.Tolerance, stored);
    }

    public Task<EvaluatorEntity> Map(IEvaluator domain, CancellationToken cancellationToken = default)
    {
        string data = domain switch
        {
            ICustomEvaluator agentic =>
                serializer.Serialize(new CustomEvaluatorData(agentic.Name, agentic.SystemMessage, agentic.Endpoint.Id)),
            IAgenticEvaluator agentic =>
                serializer.Serialize(new AgenticEvaluatorData(agentic.Endpoint.Id)),
            IExactMatchEvaluator =>
                serializer.Serialize(new ExactMatchEvaluatorData()),
            IJsonSchemaMatchEvaluator jsonSchema =>
                serializer.Serialize(new JsonSchemaMatchEvaluatorData(jsonSchema.JsonSchema)),
            INumericMatchEvaluator numeric =>
                serializer.Serialize(new NumericMatchEvaluatorData(numeric.ExtractionPattern.ToString(), numeric.Tolerance)),
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
