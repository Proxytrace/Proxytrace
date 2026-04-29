using System.ComponentModel.DataAnnotations;
using System.Net.NetworkInformation;
using System.Text.Json.Serialization;
using Autofac;
using Trsr.Common.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.Agent.Internal;
using Trsr.Domain.Message.Internal;
using Trsr.Domain.Tools.Internal;

namespace Trsr.Domain;

public sealed class Module : Autofac.Module
{
    /// <summary>
    /// Adds the services for the AI.Agents.Cloud
    /// </summary>
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterModule<Common.Module>();

        // discover domain entity types
        // they all live in assembly Cloud.Domain and implement IDomainEntity 
        var domainInterfaceTypes = typeof(Module).Assembly
            .GetTypes()
            .Where(t => t is { IsInterface: true } && t != typeof(IDomainEntity) && t != typeof(IDomainObject))
            .Where(t => t.GetInterfaces().Any(i => i == typeof(IDomainEntity) || i == typeof(IDomainObject)))
            .ToList();

        foreach (Type domainInterfaceType in domainInterfaceTypes)
        {
            ConfigureEntity(builder, domainInterfaceType);
        }
        
        // Register generators for concrete domain object types (value objects without a repository)
        builder.RegisterAssemblyTypes(ThisAssembly)
            .Where(t => !t.IsAbstract && !t.IsInterface)
            .Where(t => t.GetInterfaces().Any(i =>
                i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IDomainObjectGenerator<>)))
            .Where(t => !t.GetInterfaces().Any(i =>
                i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IDomainEntityGenerator<>)))
            .AsImplementedInterfaces();

        // Fallback — overridden by the real LLM-backed implementation registered in Trsr.Api.
        builder.RegisterType<AgentNameGenerator>()
            .As<IAgentNameGenerator>()
            .IfNotRegistered(typeof(IAgentNameGenerator));

        builder.RegisterType<ContentJsonConverter>()
            .As<JsonConverter>()
            .SingleInstance();

        builder.RegisterType<ToolArgumentsJsonConverter>()
            .As<JsonConverter>()
            .SingleInstance();
    }

    private void ConfigureEntity(ContainerBuilder builder, Type domainInterfaceType)
    {
        // find implementation of domainInterfaceType
        var domainObjectType = typeof(Module).Assembly
            .GetTypes()
            .FirstOrDefault(t => domainInterfaceType.IsAssignableFrom(t) && t is { IsInterface: false, IsAbstract: false });
        if (domainObjectType is null)
        {
            throw new InvalidOperationException($"No implementation of {domainInterfaceType.FullName} found");
        }
        
        builder.RegisterType(domainObjectType)
            .As(domainInterfaceType)
            .OnActivated(context =>
            {
                if (context.Instance is IValidatableObject validatable)
                {
                    Validator.ValidateObject(validatable, new ValidationContext(context.Instance), true);
                }
            });
        
        // register generator
        var generatorInterfaceType = typeof(IDomainObjectGenerator<>).MakeGenericType(domainInterfaceType);
        var generatorImplementationType = typeof(Module).Assembly
            .GetTypes()
            .FirstOrDefault(t => generatorInterfaceType.IsAssignableFrom(t) && t is { IsInterface: false, IsAbstract: false });
        if (generatorImplementationType is null)
        {
            throw new InvalidOperationException($"No implementation of {generatorInterfaceType.FullName} found");
        }
        // register the generator implementation as all interfaces it implements
        var generatorInterfaces = generatorImplementationType.GetInterfaces();
        foreach (var generatorInterface in generatorInterfaces)
        {
            builder.RegisterType(generatorImplementationType).As(generatorInterface);
        }
    }
}