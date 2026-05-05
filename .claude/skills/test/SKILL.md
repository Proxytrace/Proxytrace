# Writing Tests for Trsr

Use this guide whenever writing new tests or reviewing existing ones. It covers every layer of the stack.

---

## Test project layout

| Project | What it tests | Base class |
|---|---|---|
| `Trsr.Domain.Tests` | Domain entity construction, validation, state-machine transitions | `DomainTest<Module>` (extends `BaseTest<Module>`) |
| `Trsr.Storage.Tests` | Repository persistence and round-trip mapping via EF Core (in-memory SQLite) | `BaseTest<Module>` |
| `Trsr.Application.Tests` | Application services end-to-end (e.g. `TestRunnerService`) with faked infrastructure | `BaseTest<Module>` |
| `Trsr.Api.Tests` | HTTP controllers / routing | `BaseTest<Module>` |

---

## The base test harness

All tests extend `BaseTest<TModule>` from `Trsr.Testing`:

```csharp
[TestClass]
public sealed class MyTests : BaseTest<Module>   // or DomainTest<Module>
{
    protected override void ConfigureContainer(ContainerBuilder builder)
    {
        // optional, class-wide dependency configuration
    }
    
    [TestMethod]
    public async Task Something_DoesX()
    {
        IServiceProvider services = GetServices(config => 
        {
            // optional, test-specific dependency configuration
        });
        // ...
    }
}
```

Key points:
- `GetServices()` builds a fresh Autofac container for every call — each test gets its own isolated in-memory database.
- To override DI for a single test class, override `ConfigureContainer(ContainerBuilder)`.
- To override DI for a single test method, pass a lambda to `GetServices(config => { ... })`.

---

## Domain tests (`Trsr.Domain.Tests`)

Extend `DomainTest<Module>` for the convenient `GetOrCreate<T>` helper.

### Getting entities

```csharp
// Persisted entity (via generator) — use when you need a valid FK target
var suite = await GetOrCreate<ITestSuite>(services);

// Explicitly persisted via generator
var generator = services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>();
var suite = await generator.CreateAsync(CancellationToken);   // always new
var suite = await generator.GetOrCreateAsync(CancellationToken); // reuse if already created
```

### Factory delegates

Resolve factory delegates directly from DI — never `new` a domain entity:

```csharp
var factory = services.GetRequiredService<ITestRunGroup.CreateNew>();
var group = factory(suite);

var createExisting = services.GetRequiredService<ITestRunGroup.CreateExisting>();
var group = createExisting(suite, status, completedAt, existingData);
```

### What to test on a new domain entity

Cover these cases in order:

1. **`CreateNew` happy path** — verify all properties are set, `Id != Guid.Empty`, timestamps are set.
2. **`CreateNew` null/invalid inputs** — one test per required property; assert `action.Should().Throw<Exception>()`.
3. **`CreateExisting` round-trip** — create via generator, reconstitute via `CreateExisting`, assert all properties match including `Id`, `CreatedAt`, `UpdatedAt`.
4. **Unique IDs** — call `CreateNew` twice with identical inputs; IDs must differ.
5. **State-machine transitions** (if applicable) — one test per valid transition; one test per invalid/terminal-state transition using `FluentActions.Invoking(...).Should().ThrowAsync<Exception>()`.
6. **Persistence** — after a state mutation, reload from the repository and assert the new state was saved.

### Asserting exceptions

```csharp
// Sync
var action = () => factory(null!);
action.Should().Throw<Exception>();

// Async
await FluentActions
    .Invoking(() => entity.SetRunning(CancellationToken))
    .Should().ThrowAsync<Exception>();
```

### Example — state transition test

```csharp
[TestMethod]
public async Task SetCompleted_FromRunning_TransitionsToCompletedWithTimestamp()
{
    IServiceProvider services = GetServices();
    var group = await CreateGroupInState(services, TestRunStatus.Running);

    var updated = await group.SetCompleted(CancellationToken);

    updated.Status.Should().Be(TestRunStatus.Completed);
    updated.CompletedAt.Should().NotBeNull();
    updated.CompletedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
}
```

---

## Application tests (`Trsr.Application.Tests`)

Use `BaseTest<Module>` and substitute infrastructure (model clients, external APIs) with NSubstitute.

### Injecting fakes

Override DI per-test-method via the `GetServices` lambda:

```csharp
var services = GetServices(config =>
{
    IModelClient fake = Substitute.For<IModelClient>();
    fake.CompleteAsync(Arg.Any<Conversation>(), Arg.Any<ModelOptions>(), Arg.Any<CancellationToken>())
        .Returns(Task.FromResult(expectedResponse));
    config.RegisterInstance(fake);
});
```

Or per-test-class via `ConfigureContainer`:

```csharp
protected override void ConfigureContainer(ContainerBuilder builder)
{
    builder.RegisterInstance(Substitute.For<IModelClient>());
}
```

### Foreground vs background execution

Prefer `RunInForegroundAsync` in tests — it runs synchronously and returns the completed entity, so there is no race condition to manage:

```csharp
var runner = services.GetRequiredService<ITestRunnerService>();
var testRun = await runner.RunInForegroundAsync(suite, endpoint, CancellationToken);
```

### Asserting persistence

Always reload from the repository to confirm the service actually persisted the change — do not trust the returned in-memory object:

```csharp
var repo = services.GetRequiredService<IRepository<ITestRun>>();
var stored = await repo.GetAsync(testRun.Id, CancellationToken);
stored.TestResults.Should().HaveCount(1);
```

---

## Naming convention

```
[Subject]_[Condition]_[ExpectedOutcome]
```

Examples:
- `CreateNew_WithValidSuite_CreatesGroup`
- `SetCompleted_WhenAlreadyCompleted_Throws`
- `RunAsync_WhenResponseMatchesExpected_ProducesPassResult`

---

## Checklist before submitting

- [ ] Each test has exactly one logical assertion focus
- [ ] `CancellationToken` passed to every async call
- [ ] Null/invalid-input tests suppress the nullable warning with `// ReSharper disable once NullableWarningSuppressionIsUsed`
- [ ] State-machine tests cover both valid transitions and invalid/terminal-state attempts
- [ ] Persistence tests reload from the repository rather than trusting the returned object
- [ ] No `new` on domain entities — always use factory delegates from DI
