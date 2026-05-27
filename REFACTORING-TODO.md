# Refactoring TODO

Scope: `Proxytrace.Api`. Items are ranked P1 (correctness/reliability) → P4 (nice-to-have). Work top-to-bottom within a priority band.

## 7. Extract paging helper

**Scope:** all controllers (~95 `.Skip/.Take` sites)
**Priority:** P2

Every list endpoint open-codes `items.Skip((page - 1) * pageSize).Take(pageSize).Select(ToDto).ToArray()` and constructs a `PagedResult<T>` by hand.

**Approach:**
- Add a `RepositoryExtensions` class in `Proxytrace.Domain` with a `PageAsync<T>(this IRepository<T>, int page, int pageSize, ...)` (and/or `Paginate<T>(this IEnumerable<T>, int page, int pageSize)`) returning a `PagedResult<T>` directly.
- Replace all 95 controller sites; map DTOs at the call site via `PagedResult.Map(Func<TSrc, TDst>)` or `Select` over `Items`.
- Verify with tests.

## 8. Consolidate duplicated `JsonSerializerOptions` constants

**Scope:** `AgentCallsController.cs:22-26`, `AgentsController.cs:20-24`, `PlaygroundController.cs:16-20`, `TestRunGroupsController.cs:23-27`, and one more
**Priority:** P3

The same `JsonSerializerOptions { PropertyNamingPolicy = …, WriteIndented = … }` is declared in five controllers.

**Approach:**
- Move to `Proxytrace.Serialization` (or `Proxytrace.Api/Json/ApiJsonOptions.cs`) as a single static instance.
- Reference everywhere; delete duplicates.

## 9. Move `UpdateTestSuiteRequest` into the `Dto/` folder

**Scope:** `Controllers/TestSuitesController.cs:314-317`
**Priority:** P3

Request record defined at the end of the controller file. Breaks the project's `Dto/<Feature>/*Dto.cs` convention.

**Approach:**
- Create `Dto/TestSuites/UpdateTestSuiteRequest.cs` and move the record.
- Sweep other controllers for similar inline request records.

## 10. Replace string-matching DB provider detection with explicit configuration

**Scope:** `Module.cs:203-225` (`DetermineStorageConfiguration`)
**Priority:** P3

Provider auto-detect uses `Contains("host=")`, `Contains("data source=")`, `:memory:` against a lower-cased connection string. Brittle, surprising, and conflates Postgres / SQLite identifiers (a Postgres conn string with a `data source` token would be misclassified).

**Approach:**
- Add an explicit `Storage:Provider` setting in `appsettings.json` (`"Sqlite" | "Postgres" | "SqlServer"`).
- Keep the string sniff as a fallback only when `Provider` is unset, and log a warning when fallback triggers.
- Add unit tests for each branch.

## 11. Externalize hardcoded constants in `Module.cs` and middleware

**Scope:** `Module.cs:55, 197-198`, `Middleware/SecurityHeadersMiddleware.cs:10-21`, `Middleware/KioskReadOnlyMiddleware.cs:8-13`, `SearchController.cs:14-15`, `StatisticsController.cs:29`
**Priority:** P3

`selfBaseUrl = "http://localhost:5000"`, stream name `"proxytrace:ingest"`, consumer group `"proxytrace-app"`, the two CSP policy strings, search min/max query lengths, statistics defaults — all hardcoded in code.

**Approach:**
- Bind a `MessagingOptions`, `SecurityHeadersOptions`, `SearchOptions`, `StatisticsOptions` from `IConfiguration`.
- Move defaults into `appsettings.json`; expose for ops to override per environment.
- Use `IValidateOptions<T>` to fail fast on bad config.

## 12. Refactor `SigningKeyProvider`: stop reading `appsettings.local.json` directly

**Scope:** `Auth/SigningKeyProvider.cs:24-43`
**Priority:** P3

Parses `appsettings.local.json` by hand and writes a generated key back with `File.WriteAllText` as a constructor side effect. Bypasses `IConfiguration`, hard to test, has filesystem side effects on construction.

**Approach:**
- Inject `IConfiguration` and a file-abstraction (or `IHostEnvironment` + `IFileProvider`).
- Move key generation/persistence into an `EnsureSigningKey()` method called from startup, not the ctor.
- Validate generated key length / entropy.

## 13. Map exceptions to status codes via a registry

**Scope:** `Middleware/ExceptionHandlingMiddleware.cs:39-45`
**Priority:** P4

Hardcoded switch on exception type. Adding a new domain exception means editing middleware.

**Approach:**
- Introduce `IExceptionMapper` with default implementations registered for `EntityNotFoundException`, `ValidationException`, `NotImplementedException`.
- Middleware resolves the registry; new exception types plug in via Autofac registration.

## 14. Cache the current user per request in `CurrentUserAccessor`

**Scope:** `Auth/CurrentUserAccessor.cs:20-34`
**Priority:** P4

Every call to `GetCurrentUserAsync` re-queries the DB. Within a single request multiple controllers / filters often need the user.

**Approach:**
- Store the resolved `IUser` in `HttpContext.Items` after first lookup; return cached value on subsequent calls.
- Reset on logout (none currently; harmless within request lifetime).

## 15. Add tests for middleware and auth helpers

**Scope:** new tests under `Proxytrace.Api.Tests/`
**Priority:** P4

No tests cover `ExceptionHandlingMiddleware`, `SecurityHeadersMiddleware`, `KioskReadOnlyMiddleware`, `KioskAuthenticationHandler`, `AuthUserResolver`, `JwtBearerEventsFactory`, `SigningKeyProvider`. These are reliability-sensitive cross-cutting concerns.

**Approach:**
- For each component add a small `BaseTest<Module>` derived test class.
- Cover happy path + at least one failure mode per component.
