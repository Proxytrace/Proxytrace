using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Autofac;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Domain.Evaluator.Internal;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Events.Internal;
using Proxytrace.Domain.Message.Internal;
using Proxytrace.Domain.OptimizationProposal.Internal;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Prompt.Internal;
using Proxytrace.Domain.Tools.Internal;

namespace Proxytrace.Domain;

public sealed class Module : Autofac.Module
{
    /// <summary>
    /// Adds the services for the AI.Agents.Cloud
    /// </summary>
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterModule<Common.Module>();

        // discover top-level domain entity/object interfaces — those that directly extend
        // IDomainEntity or IDomainObject, with no intermediate domain interface in between.
        var directBases = new HashSet<Type> { typeof(IDomainEntity), typeof(IDomainObject) };
        var domainInterfaceTypes = typeof(Module).Assembly
            .GetTypes()
            .Where(t => t is { IsInterface: true } && t != typeof(IDomainEntity) && t != typeof(IDomainObject)
                && !(t.IsGenericTypeDefinition && t.GetGenericTypeDefinition() == typeof(IDomainEntity<>)))
            .Where(t =>
            {
                // compute the "direct" interfaces (not reachable through another intermediate interface)
                var all = t.GetInterfaces();
                var transitive = all.SelectMany(i => i.GetInterfaces()).ToHashSet();
                var direct = all.Where(i => !transitive.Contains(i));
                return direct.Any(i => directBases.Contains(i)
                    || (i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IDomainEntity<>)));
            })
            .ToList();

        foreach (Type domainInterfaceType in domainInterfaceTypes)
        {
            ConfigureEntity(builder, domainInterfaceType);
        }

        // Register evaluators explicitly — IEvaluator has multiple concrete variants so
        // auto-discovery can't pick the right default. ExactMatchEvaluator is the default IEvaluator.
        // RegisterEvaluators(builder);
        
        // Register generators for concrete domain object types (value objects without a repository)
        builder.RegisterAssemblyTypes(ThisAssembly)
            .Where(t => t is { IsAbstract: false, IsInterface: false })
            .Where(t => t.GetInterfaces().Any(i =>
                i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IDomainObjectGenerator<>)))
            .Where(t => !t.GetInterfaces().Any(i =>
                i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IDomainEntityGenerator<>)))
            .AsImplementedInterfaces();

        builder.RegisterType<ContentJsonConverter>()
            .As<JsonConverter>()
            .SingleInstance();

        builder.RegisterType<ToolArgumentsJsonConverter>()
            .As<JsonConverter>()
            .SingleInstance();

        builder.RegisterType<EvaluatorGenerator>()
            .AsImplementedInterfaces();

        builder.RegisterType<OptimizationProposalGenerator>()
            .AsImplementedInterfaces();

        builder.RegisterType<EntityEventService>()
            .As<IEntityEventService>()
            .SingleInstance();

        builder.RegisterType<ResourcesPromptRepository>()
            .As<IPromptTemplateRepository>();
    }

    private void ConfigureEntity(ContainerBuilder builder, Type domainInterfaceType)
    {
        // find implementation of domainInterfaceType
        foreach (var domainObjectType in domainInterfaceType.GetImplementations())
        {
            // find closes domainInterfaceType
            // e.g. IEvaluator -> IAgenticEvaluator -> IPolitenessEvaluator should pick IPolitenessEvaluator
            var correctDomainInterfaceType = domainObjectType.GetInterfaces()
                .Where(domainInterfaceType.IsAssignableFrom)
                .OrderByDescending(i => i.GetInterfaces().Length) // pick the most derived interface
                .First();
            
            ConfigureEntity(builder, correctDomainInterfaceType, domainObjectType);
        }
    }

    private static void ConfigureEntity(ContainerBuilder builder, Type domainInterfaceType, Type domainObjectType)
    {
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
