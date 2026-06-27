using Autofac;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.Playground.Internal;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.ModelEndpoint;

namespace Proxytrace.Application.Playground;

internal sealed class PlaygroundModule : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        // Resolve IHostEnvironment optionally (it is absent in some test containers) so the service
        // can mirror ExceptionHandlingMiddleware's Development-only detail behaviour.
        builder.Register(ctx =>
            {
                var agents = ctx.Resolve<IRepository<IAgent>>();
                var endpoints = ctx.Resolve<IRepository<IModelEndpoint>>();
                var logger = ctx.Resolve<ILogger<PlaygroundService>>();
                ctx.TryResolve<IHostEnvironment>(out var env);
                return new PlaygroundService(agents, endpoints, logger, env);
            })
            .As<IPlaygroundService>()
            .SingleInstance();
    }
}
