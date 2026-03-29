using Autofac;
using Trsr.Client.Sample;
using Trsr.Client.Sample.Internal;
using Module = Trsr.Client.Sample.Module;

var builder = new ContainerBuilder();
builder.RegisterModule<Module>();
var services = builder.Build();

Configuration configuration = services.Resolve<Configuration>();

Console.WriteLine("Trsr.Client.Sample");
Console.WriteLine($"  Endpoint : {configuration.Endpoint}");
Console.WriteLine();

// Integration is a single line change in any OpenAI client:
//   Python:     client = OpenAI(base_url="http://trsr-api/openai/v1", api_key="sk-...")
//   C#:         new OpenAIClientOptions { Endpoint = new Uri("http://trsr-api/openai/v1") }
//   TypeScript: new OpenAI({ baseURL: "http://trsr-api/openai/v1" })
//
// Every API call is then captured automatically — zero additional instrumentation required.

Console.WriteLine("Scenario: OpenAI proxy (zero instrumentation required)");
Console.WriteLine("  Configure your OpenAI client with:");
Console.WriteLine($"    base_url = \"{configuration.Endpoint}/openai/v1\"");
Console.WriteLine("  Then every API call is captured automatically.");
Console.WriteLine();

var simulator = services.Resolve<AgentCallSimulator>();
await simulator.Run();
Console.WriteLine();

Console.WriteLine("Done.");
