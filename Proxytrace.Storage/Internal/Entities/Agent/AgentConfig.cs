using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Proxytrace.Common.Async;
using Proxytrace.Common.Serialization;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Tools;
using Proxytrace.Storage.Internal.Entities.Inference;
using Proxytrace.Storage.Internal.Entities.ModelEndpoint;
using Proxytrace.Storage.Internal.Entities.Project;

namespace Proxytrace.Storage.Internal.Entities.Agent;

internal class AgentConfig : AbstractEntityConfiguration<AgentEntity>, IMapper<IAgent, AgentEntity>
{
    private readonly IAgent.CreateExisting factory;
    private readonly IPromptTemplate.Create promptTemplateFactory;
    private readonly IModelParameters.Create modelParametersFactory;
    private readonly ISerializer serializer;
    private readonly Lazy<IAgentRepository> repository;
    private readonly IRepository<IProject> projects;
    private readonly IRepository<IModelEndpoint> endpoints;

    public AgentConfig(
        IAgent.CreateExisting factory,
        IPromptTemplate.Create promptTemplateFactory,
        IModelParameters.Create modelParametersFactory,
        ISerializer serializer,
        Lazy<IAgentRepository> repository,
        IRepository<IProject> projects,
        IRepository<IModelEndpoint> endpoints)
    {
        this.factory = factory;
        this.promptTemplateFactory = promptTemplateFactory;
        this.modelParametersFactory = modelParametersFactory;
        this.serializer = serializer;
        this.repository = repository;
        this.projects = projects;
        this.endpoints = endpoints;
    }

    public override void Configure(EntityTypeBuilder<AgentEntity> builder)
    {
        builder.HasIndex(e => e.Fingerprint).IsUnique();
        builder.HasIndex(e => e.IsSystemAgent);
        builder.Property(e => e.Fingerprint).HasMaxLength(64);
        builder.Property(e => e.Name).HasMaxLength(200);

        builder
            .HasOne<ProjectEntity>()
            .WithMany()
            .HasForeignKey(e => e.Project)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne<ModelEndpointEntity>()
            .WithMany()
            .HasForeignKey(e => e.Endpoint)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .Property(e => e.SystemPrompt)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<SystemPromptData>(v) ?? new SystemPromptData(string.Empty, string.Empty)
            );

        builder
            .Property(e => e.Tools)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<IReadOnlyList<ToolSpecification>>(v) ?? Array.Empty<ToolSpecification>()
            );

        builder
            .Property(e => e.ModelParameters)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<ModelParametersData>(v) ?? ModelParametersData.Empty
            );
    }

    public async Task<IAgent> Map(AgentEntity stored, CancellationToken cancellationToken = default)
    {
        var project = await projects.GetAsync(stored.Project, cancellationToken);
        var endpoint = await endpoints.GetAsync(stored.Endpoint, cancellationToken);
        var systemPrompt = promptTemplateFactory(stored.SystemPrompt.Name, stored.SystemPrompt.Template);
        var modelParameters = ToDomain(stored.ModelParameters, modelParametersFactory);
        return factory(
            name: stored.Name,
            project: project,
            systemPrompt: systemPrompt,
            tools: stored.Tools,
            endpoint: endpoint,
            isSystemAgent: stored.IsSystemAgent,
            modelParameters: modelParameters,
            existing: stored);
    }

    public Task<AgentEntity> Map(IAgent domain, CancellationToken cancellationToken = default)
        => new AgentEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            Project = domain.Project.Id,
            Fingerprint = repository.Value.GetAgentFingerprint(domain),
            SystemPrompt = new SystemPromptData(
                Name: domain.SystemPrompt.Name,
                Template: domain.SystemPrompt.Template),
            Tools = domain.Tools,
            ModelParameters = ToData(domain.ModelParameters),
            Endpoint = domain.Endpoint.Id,
            IsSystemAgent = domain.IsSystemAgent,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();

    internal static ModelParametersData ToData(IModelParameters domain)
        => new(
            domain.Temperature,
            domain.TopP,
            domain.ReasoningEffort,
            domain.FrequencyPenalty,
            domain.PresencePenalty,
            domain.MaxTokens,
            domain.Seed,
            domain.Stop,
            domain.N);

    internal static IModelParameters ToDomain(ModelParametersData data, IModelParameters.Create factory)
        => factory(
            temperature: data.Temperature,
            topP: data.TopP,
            reasoningEffort: data.ReasoningEffort,
            frequencyPenalty: data.FrequencyPenalty,
            presencePenalty: data.PresencePenalty,
            maxTokens: data.MaxTokens,
            seed: data.Seed,
            stop: data.Stop,
            n: data.N);
}
