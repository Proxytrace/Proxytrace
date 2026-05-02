using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Autofac;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Evaluator.Internal;
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

        // discover top-level domain entity/object interfaces — those that directly extend
        // IDomainEntity or IDomainObject, with no intermediate domain interface in between.
        var directBases = new HashSet<Type> { typeof(IDomainEntity), typeof(IDomainObject) };
        // IEvaluator has multiple concrete implementations, so skip it from auto-discovery
        // and register its variants explicitly below.
        var skipInterfaces = new HashSet<Type> { typeof(IEvaluator) };
        var domainInterfaceTypes = typeof(Module).Assembly
            .GetTypes()
            .Where(t => t is { IsInterface: true } && t != typeof(IDomainEntity) && t != typeof(IDomainObject))
            .Where(t =>
            {
                // compute the "direct" interfaces (not reachable through another interface)
                var all = t.GetInterfaces();
                var transitive = all.SelectMany(i => i.GetInterfaces()).ToHashSet();
                var direct = all.Where(i => !transitive.Contains(i));
                return direct.Any(i => directBases.Contains(i));
            })
            .Where(t => !skipInterfaces.Contains(t))
            .ToList();

        foreach (Type domainInterfaceType in domainInterfaceTypes)
        {
            ConfigureEntity(builder, domainInterfaceType);
        }

        // Register evaluators explicitly — IEvaluator has multiple concrete variants so
        // auto-discovery can't pick the right default. ExactMatchEvaluator is the default IEvaluator.
        RegisterEvaluators(builder);

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
    }

    private static void RegisterEvaluators(ContainerBuilder builder)
    {
        builder.RegisterType<ExactMatchEvaluator>()
            .As<IEvaluator>()
            .As<IExactMatchEvaluator>()
            .OnActivated(context =>
            {
                if (context.Instance is IValidatableObject validatable)
                    Validator.ValidateObject(validatable, new ValidationContext(context.Instance), true);
            });

        builder.RegisterType<CustomEvaluator>().As<ICustomEvaluator>();

        builder.RegisterType<EvaluatorGenerator>().As<IDomainEntityGenerator<IEvaluator>>();
        builder.RegisterType<AgenticEvaluatorGenerator>().As<IDomainEntityGenerator<ICustomEvaluator>>();
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
