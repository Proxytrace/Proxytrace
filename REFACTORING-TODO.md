# Refactoring TODO

Scope: `Proxytrace.Api`. Items are ranked P1 (correctness/reliability) → P4 (nice-to-have). Work top-to-bottom within a priority band.

## 2. Collapse `ContainsAsync` + `GetAsync` round-trips

**Scope:** All controllers in `Proxytrace.Api/Controllers/`
**Priority:** P1

~49 sites follow `if (!await repo.ContainsAsync(id, ct)) return NotFound(); var e = await repo.GetAsync(id, ct);`. Two DB round-trips per request, and a race window between the two calls.

**Approach:**
- Add `FindAsync(Guid id, CancellationToken)` returning `T?` on `IRepository<T>` in `Proxytrace.Domain`.
- Replace all controller call sites with a single `FindAsync` + `if (entity is null) return NotFound();`.
- Sweep with grep over `ContainsAsync` to ensure no callers were missed.

## 3. Validate input bounds at controller boundaries consistently

**Scope:** `SearchController.cs`, `StatisticsController.cs`, `TestSuitesController.cs`, `ProjectsController.cs`
**Priority:** P1

Page/pageSize, `recentTraceCount`, `agentLimit`, etc. are clamped in some endpoints (`EvaluatorsController:158, 325`) and silently trusted in others. `TestSuitesController.cs:105-112` validates `testCases` empty *after* iterating. `ProjectsController.ResolveMembersAsync` (line 158) doesn't dedupe user IDs.

**Approach:**
- Introduce shared `PagingRequest` (or extension) that clamps `page >= 1`, `pageSize ∈ [1, 100]`.
- Move per-endpoint guards (`recentTraceCount`, `agentLimit`) to clamp at the top of each action.
- Pre-validate request DTOs before any work: emptiness, max-length, duplicates.
- Add `[Required]` / `[StringLength]` data annotations on request DTOs.

## 4. Extract a shared message-text / test-case-summary utility

**Scope:** new `Proxytrace.Domain` (or `Proxytrace.Application`) helper; callers in `EvaluatorsController.cs:345-351`, `TestRunsController.cs:207-215`, `TestSuitesController.cs:305-311`, `EvaluatorTestBenchController.cs:142-148`, `Dto/AgentCalls/AgentCallDtoMapper.cs:88-95`
**Priority:** P2

The "concatenate `Contents`, switch on message subtype, truncate at 77 chars" logic is duplicated five times with slight variations. Bug-fix in one place will not propagate.

**Approach:**
- Add `MessageText.From(Message)` and `TestCaseSummary.Of(ITestCase, int maxLength = 77)` helpers in the domain layer (these are pure functions over domain types, no I/O).
- Replace all five sites with a single call.
- Cover with unit tests including each `Message` subtype.

## 5. Centralize tool-argument / tool-spec DTO mapping

**Scope:** `Dto/Agents/AgentDtoMapper.cs:33-52`, `Dto/AgentCalls/AgentCallDtoMapper.cs:42-61`, `Controllers/ProposalsController.cs:151-173`
**Priority:** P2

`ToArgumentDto` / `ToToolArgumentDto` / `ToToolSpecDto` are implemented three times with the same JsonSchema parsing of `type` and `enum`. Diverging implementations are already visible.

**Approach:**
- Create `Dto/Tools/ToolDtoMapper.cs` with the canonical `ToToolSpecDto`, `ToToolArgumentDto`.
- Delete the duplicates in the three sites and route through the new mapper.
- Consider whether JSON-schema parsing belongs in `Proxytrace.Serialization` instead — JsonSchema interpretation is a serialization concern, not a DTO mapping concern.

## 6. Split bloated controllers; move inline mapping into `Dto/*Mapper.cs`

**Scope:** `EvaluatorsController.cs` (394), `TestSuitesController.cs` (317), `TestRunsController.cs` (300), `ModelProvidersController.cs` (259), `TestRunGroupsController.cs` (203), `ProposalsController.cs` (174)
**Priority:** P2

Each of these embeds 50-150 lines of DTO mapping + helper methods at the bottom (e.g. `TestRunsController.cs:133-289` is ToDto + 5 private mappers + `CalculateRunTotals`). Other controllers already follow the split pattern (`AgentDtoMapper`, `AgentCallDtoMapper`, `ProjectDtoMapper`, `EvaluatorStatsDtoMapper`).

**Approach:**
- Per controller: create `Dto/<Feature>/<Feature>DtoMapper.cs` (static, internal) and move all private mapping/summarize helpers there.
- For evaluator create/update, extract the per-subtype switch into a small factory class (`EvaluatorFactory`) to remove the 60-line switches from the controller.
- Extract `CalculateRunTotals` to a domain or application service — token-cost aggregation is business logic, not a DTO concern. Reuse the same logic that `AgentCallDtoMapper.ComputeCost` (lines 76-86) reinvents.
- Target: every controller ≤ 200 lines.

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
