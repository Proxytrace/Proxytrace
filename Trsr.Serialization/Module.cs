using Autofac;
using JetBrains.Annotations;
using Trsr.Serialization.Internal;

namespace Trsr.Serialization;

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
        builder.RegisterGeneric(typeof(JsonOutputParser<>)).As(typeof(IOutputParser<>));
        builder.RegisterType<StringOutputParser>().As<IOutputParser<string>>();

        builder.Register<IOutputFormat.FromJsonSchema>(c => schema => new JsonOutputFormat(schema))
            .AsSelf();
    }
}