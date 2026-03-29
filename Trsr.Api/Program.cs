using Autofac;
using Autofac.Extensions.DependencyInjection;
using Module = Trsr.Api.Module;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());
builder.Host.ConfigureContainer<ContainerBuilder>(containerBuilder => containerBuilder.RegisterModule<Module>());
builder.Services.AddControllers();

var app = builder.Build();
app.MapControllers();
app.Run();
