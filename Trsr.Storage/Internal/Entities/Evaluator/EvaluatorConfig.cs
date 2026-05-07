using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Evaluator;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

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
    private readonly IPromptTemplate.Create promptTemplateFactory;
    private readonly IRepository<IProject> projects;
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
        IPromptTemplate.Create promptTemplateFactory,
        IRepository<IModelEndpoint> modelEndpoints,
        IRepository<IProject> projects,
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
        this.promptTemplateFactory = promptTemplateFactory;
        this.projects = projects;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<EvaluatorEntity> builder)
    {
        builder.HasIndex(e => e.Kind);
    }

    public async Task<IEvaluator> Map(EvaluatorEntity stored, CancellationToken cancellationToken = default)
    {
        IProject project = await projects.GetAsync(stored.Project, cancellationToken);
        return stored.Kind switch
        {
            EvaluatorKind.ExactMatch => createExactMatch(project, stored),
            EvaluatorKind.Custom => MapCustom(stored, project),
            EvaluatorKind.Helpfulness => createHelpfulness(project, stored),
            EvaluatorKind.Politeness => createPoliteness(project, stored),
            EvaluatorKind.Safety => createSafety(project, stored),
            EvaluatorKind.ToolUsage => createToolUsage(project, stored),
            EvaluatorKind.JsonSchemaMatch => MapJsonSchemaMatch(stored, project),
            EvaluatorKind.NumericMatch => MapNumericMatch(stored, project),
            _ => throw new InvalidOperationException($"Unknown evaluator kind: {stored.Kind}")
        };
    }
    
    private ICustomEvaluator MapCustom(EvaluatorEntity stored, IProject project)
    {
        var data = serializer.DeserializeRequired<CustomEvaluatorData>(stored.Data);
        var promptTemplate = promptTemplateFactory(data.Name, data.SystemPrompt);
        return createCustom(promptTemplate, project, stored);
    }

    private IJsonSchemaMatchEvaluator MapJsonSchemaMatch(EvaluatorEntity stored, IProject project)
    {
        var data = serializer.DeserializeRequired<JsonSchemaMatchEvaluatorData>(stored.Data);
        return createJsonSchemaMatch(data.JsonSchema, project, stored);
    }

    private INumericMatchEvaluator MapNumericMatch(EvaluatorEntity stored, IProject project)
    {
        var data = serializer.DeserializeRequired<NumericMatchEvaluatorData>(stored.Data);
        return createNumericMatch(new Regex(data.ExtractionPattern), data.Tolerance, project, stored);
    }

    public Task<EvaluatorEntity> Map(IEvaluator domain, CancellationToken cancellationToken = default)
    {
        string data = domain switch
        {
            ICustomEvaluator agentic =>
                serializer.Serialize(new CustomEvaluatorData(agentic.SystemPrompt.Name, agentic.SystemPrompt.Template)),
            IAgenticEvaluator =>
                serializer.Serialize(new AgenticEvaluatorData()),
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
            Project = domain.Project.Id,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
    }
}
