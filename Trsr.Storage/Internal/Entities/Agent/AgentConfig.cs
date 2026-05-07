using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Tools;
using Trsr.Storage.Internal.Entities.ModelEndpoint;
using Trsr.Storage.Internal.Entities.Project;

namespace Trsr.Storage.Internal.Entities.Agent;

internal class AgentConfig : AbstractEntityConfiguration<AgentEntity>, IMapper<IAgent, AgentEntity>
{
    private readonly IAgent.CreateExisting factory;
    private readonly IPromptTemplate.Create promptTemplateFactory;
    private readonly ISerializer serializer;
    private readonly Lazy<IAgentRepository> repository;
    private readonly IRepository<IProject> projects;
    private readonly IRepository<IModelEndpoint> endpoints;

    public AgentConfig(
        IAgent.CreateExisting factory,
        IPromptTemplate.Create promptTemplateFactory,
        ISerializer serializer,
        Lazy<IAgentRepository> repository,
        IRepository<IProject> projects,
        IRepository<IModelEndpoint> endpoints)
    {
        this.factory = factory;
        this.promptTemplateFactory = promptTemplateFactory;
        this.serializer = serializer;
        this.repository = repository;
        this.projects = projects;
        this.endpoints = endpoints;
    }

    public override void Configure(EntityTypeBuilder<AgentEntity> builder)
    {
        builder.HasIndex(e => e.Fingerprint).IsUnique();
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
    }

    public async Task<IAgent> Map(AgentEntity stored, CancellationToken cancellationToken = default)
    {
        var project = await projects.GetAsync(stored.Project, cancellationToken);
        var endpoint = await endpoints.GetAsync(stored.Endpoint, cancellationToken);
        var systemPrompt = promptTemplateFactory(stored.SystemPrompt.Name, stored.SystemPrompt.Template);
        return factory(
            name: stored.Name,
            project: project, 
            systemPrompt: systemPrompt,
            tools: stored.Tools,
            endpoint: endpoint,
            isSystemAgent: stored.IsSystemAgent,
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
            Endpoint = domain.Endpoint.Id,
            IsSystemAgent = domain.IsSystemAgent,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}