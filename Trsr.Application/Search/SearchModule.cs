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

        builder.RegisterType<AgentDocumentMapper>().As<IDocumentMapper>().SingleInstance();
        builder.RegisterType<TestSuiteDocumentMapper>().As<IDocumentMapper>().SingleInstance();
        builder.RegisterType<AgentCallDocumentMapper>().As<IDocumentMapper>().SingleInstance();
        builder.RegisterType<EvaluatorDocumentMapper>().As<IDocumentMapper>().SingleInstance();

        builder.RegisterType<LuceneSearchIndexer>()
            .As<ISearchIndexer>()
            .SingleInstance();

        builder.RegisterType<LuceneSearchService>()
            .As<ISearchService>()
            .SingleInstance();

        builder.RegisterInstance(new ProjectIdResolver<IAgent>(a => a.Project.Id)).SingleInstance();
        builder.RegisterInstance(new ProjectIdResolver<ITestSuite>(s => s.Agent.Project.Id)).SingleInstance();
        builder.RegisterInstance(new ProjectIdResolver<IAgentCall>(c => c.Agent.Project.Id)).SingleInstance();
        builder.RegisterInstance(new ProjectIdResolver<IEvaluator>(e => e.Project.Id)).SingleInstance();

        RegisterDecorator<IAgent>(builder, SearchKind.Agent);
        RegisterDecorator<ITestSuite>(builder, SearchKind.TestSuite);
        RegisterDecorator<IAgentCall>(builder, SearchKind.AgentCall);
        RegisterDecorator<IEvaluator>(builder, SearchKind.Evaluator);

        builder.RegisterType<TraceIndexPrunerService>()
            .AsSelf()
            .SingleInstance();
        builder.RegisterServiceCollection(services =>
            services.AddHostedService(sc => sc.GetRequiredService<TraceIndexPrunerService>()));
    }

    private static void RegisterDecorator<TDomain>(ContainerBuilder builder, SearchKind kind)
        where TDomain : class, IDomainEntity
    {
        builder.RegisterDecorator<IRepository<TDomain>>((ctx, _, inner) =>
            new IndexingRepositoryDecorator<TDomain>(
                inner,
                ctx.Resolve<Lazy<ISearchIndexer>>(),
                kind,
                ctx.Resolve<ProjectIdResolver<TDomain>>()));
    }
}
