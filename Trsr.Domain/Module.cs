using System.ComponentModel.DataAnnotations;
using System.Net.NetworkInformation;
using System.Text.Json.Serialization;
using Autofac;
using Trsr.Common.DependencyInjection;

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
        
        builder.RegisterAllGeneric(typeof(JsonConverter<>), ThisAssembly)
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