using Autofac;
using Microsoft.Extensions.Configuration;
using Trsr.Client.Sample.Internal;

namespace Trsr.Client.Sample;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

         builder.RegisterType<AgentCallSimulator>()
             .AsSelf()
             .InstancePerDependency();

         builder.Register(_ =>
         {
             ConfigurationBuilder configurationBuilder = new ConfigurationBuilder();
             return configurationBuilder
                 .AddJsonFile("appsettings.development.json", optional: false, reloadOnChange: true)
                 .Build();
         }).As<IConfiguration>();
         
         builder
             .Register(cp => cp.Resolve<IConfiguration>().Get<Configuration>() 
                             ?? throw new InvalidOperationException("Failed to bind configuration."))
             .As<Configuration>()
             .SingleInstance();
    }
}