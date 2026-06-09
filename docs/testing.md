# Testing Conventions

**Before writing or modifying any backend test, you MUST invoke the `test` skill
(`.claude/skills/test/SKILL.md`) and follow it.** It is the source of truth for the test
harness: per-test `BaseTest<TModule>` containers, the `ConfigureContainer` / `GetServices`
DI hooks, NSubstitute substitution patterns, and the hard rules against shared
state/fields and `[TestFixture]`-style helper classes. The summary below is orientation
only; the skill overrides it where they differ.

All tests extend `BaseTest<TModule>` (MSTest + AwesomeAssertions):

```csharp
[TestClass]
public class MyTests : BaseTest<Module>
{
    public required TestContext TestContext { get; init; }

    [TestMethod]
    public async Task SomeTest()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<IRepository<IUser>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();

        IUser entity = await generator.CreateAsync(CancellationToken); // persists
        IUser result = await repo.GetAsync(entity.Id, CancellationToken);

        result.Id.Should().Be(entity.Id);
    }
}
```

- Each test gets an isolated in-memory database (unique name via `Guid.NewGuid()`)
- `CancellationToken` comes from `TestContext.CancellationToken`
- Override `ConfigureContainer(ContainerBuilder)` to customize the DI container for a test class
- Use `generator.GenerateAsync()` for in-memory-only test objects; `CreateAsync()` to persist

**Exception assertions** — use `FluentActions.Invoking(...).Should().ThrowAsync<T>()`:
```csharp
await FluentActions
    .Invoking(() => repo.UpdateAsync(entity, CancellationToken))
    .Should().ThrowAsync<EntityNotFoundException>();
```

## End-to-end tests (Playwright)

The e2e suite (repo-root `e2e/`) boots the full stack via Docker Compose (`docker-compose.e2e.yml`).
**Do not run the e2e tests if Docker is not installed** — they require a working Docker daemon and
will fail without one. Check first (e.g. `docker --version` and `docker info`); if Docker is
unavailable, skip the e2e suite and say so rather than attempting to run it. See the
`run-e2e-tests` skill for how to execute and triage them, and `create-e2e-test` to write them.
