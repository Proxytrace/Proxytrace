using Autofac;
using Proxytrace.Client.Sample;
using Proxytrace.Client.Sample.Internal;
using Module = Proxytrace.Client.Sample.Module;

var builder = new ContainerBuilder();
builder.RegisterModule<Module>();
var services = builder.Build();

Configuration configuration = services.Resolve<Configuration>();

Console.WriteLine("Proxytrace.Client.Sample");
Console.WriteLine($"  Endpoint : {configuration.Endpoint}");
Console.WriteLine();

// Integration is a single line change in any OpenAI client:
//   Python:     client = OpenAI(base_url="http://proxytrace-api/openai/v1", api_key="sk-...")
//   C#:         new OpenAIClientOptions { Endpoint = new Uri("http://proxytrace-api/openai/v1") }
//   TypeScript: new OpenAI({ baseURL: "http://proxytrace-api/openai/v1" })
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

Console.WriteLine("Scenario: multi-turn tool calls (demonstrates Proxytrace tool-call decoding)");
Console.WriteLine("  Proxytrace captures tool definitions, tool_calls responses, tool results,");
Console.WriteLine("  and the final assistant answer — all decoded and visible in the trace UI.");
Console.WriteLine();

var toolCallSimulator = services.Resolve<ToolCallSimulator>();
await toolCallSimulator.Run();
Console.WriteLine();

Console.WriteLine("Done.");
