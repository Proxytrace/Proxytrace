using Autofac;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Trsr.Application.Search.Internal;
using Trsr.Application.Search.Internal.Mappers;
using Trsr.Common.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Search;
using Trsr.Domain.TestSuite;

namespace Trsr.Application.Search;

internal sealed class SearchModule : Autofac.Module
{
    private readonly Func<IComponentContext, SearchConfiguration> searchConfigurationFactory;

    public SearchModule(Func<IComponentContext, SearchConfiguration> searchConfigurationFactory)
    {
        this.searchConfigurationFactory = searchConfigurationFactory;
    }

    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.Register(searchConfigurationFactory)
            .As<SearchConfiguration>()
            .SingleInstance();

        builder.Register(ctx =>
            {
                var cfg = ctx.Resolve<SearchConfiguration>();
                ctx.TryResolve<IHostEnvironment>(out var env);
                return new LuceneDirectoryFactory(cfg, env);
            })
            .As<ILuceneDirectoryFactory>()
            .SingleInstance();

        builder.RegisterType<LuceneIndexWriter>()
            .AsSelf()
            .SingleInstance();

        foreach (var mapperType in typeof(IDocumentMapper).GetImplementations())
        {
            builder.RegisterType(mapperType).As<IDocumentMapper>().SingleInstance();
        }

        builder.RegisterType<LuceneSearchIndexer>()
            .As<ISearchIndexer>()
            .SingleInstance();

        builder.RegisterType<LuceneSearchService>()
            .As<ISearchService>()
            .SingleInstance();

        // discover implementations of ISearchable
        foreach (var searchableType in typeof(ISearchable).GetImplementations())
        {
            RegisterDecorator(searchableType, builder);
        }
        
        builder.RegisterType<TraceIndexPrunerService>()
            .AsSelf()
            .SingleInstance();
        builder.RegisterServiceCollection(services =>
            services.AddHostedService(sc => sc.GetRequiredService<TraceIndexPrunerService>()));
    }

    private static void RegisterDecorator(Type searchableType, ContainerBuilder builder)
    {
        var domainInterfaceType = searchableType.GetInterfaces()
            .Last(i => !i.IsGenericType && i != typeof(IDomainEntity) && i.IsAssignableTo(typeof(IDomainEntity)));
        var repositoryType = typeof(IRepository<>).MakeGenericType(domainInterfaceType);
        var decoratorType = typeof(IndexingRepositoryDecorator<>).MakeGenericType(domainInterfaceType);
        builder.RegisterDecorator(decoratorType, repositoryType);
    }
}
