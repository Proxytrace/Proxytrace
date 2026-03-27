using Autofac;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Trsr.Testing;

[TestClass]
public abstract class BaseTest<TModule> where TModule : Autofac.Module, new()
{
    public required TestContext TestContext { get; init; }
    
    protected CancellationToken CancellationToken 
        => TestContext.CancellationToken;
    
    
    protected virtual void ConfigureContainer(ContainerBuilder builder)
    {
    }
    
    protected IServiceProvider GetServices(Action<ContainerBuilder>? action = null)
    {
        ContainerBuilder builder = new ContainerBuilder();
        builder.RegisterModule<Module>();
        builder.RegisterModule<TModule>();
        ConfigureContainer(builder);
        action?.Invoke(builder);
        return builder.Build().Resolve<IServiceProvider>();
    }
}