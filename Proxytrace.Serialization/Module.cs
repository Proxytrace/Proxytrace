using Autofac;
using JetBrains.Annotations;
using Proxytrace.Serialization.Internal;

namespace Proxytrace.Serialization;

/// <summary>
/// Sets up serialization services
/// </summary>
[UsedImplicitly]
public sealed class Module : Autofac.Module
{
    /// <summary>
    /// Add serialization services
    /// </summary>
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterType<JsonSerializer>().As<ISerializer>();
        builder.RegisterType<JsonOutputFormat>().AsSelf();
        builder.RegisterType<StringOutputFormat>().AsSelf();

        builder.Register<IOutputFormat.Create>(c =>
        {
            var ctx = c.Resolve<IComponentContext>();
            return type =>
            {
                if (type == typeof(string))
                    return ctx.Resolve<StringOutputFormat>();
                return ctx.Resolve<JsonOutputFormat>(new TypedParameter(typeof(Type), type));
            };
        }).AsSelf();
    }
}
