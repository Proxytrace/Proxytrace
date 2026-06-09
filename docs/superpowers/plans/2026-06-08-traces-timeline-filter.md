# Traces Timeline Time-Range Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED SUB-SKILL for any backend test step:** invoke the `test` skill (`.claude/skills/test/SKILL.md`) before writing/modifying backend tests — it is the source of truth for the harness.

**Goal:** Add a brushable count+error timeline strip above the Traces table so users see ingestion hotspots and select a precise start/end time-range that filters the table live.

**Architecture:** A new `GET /api/agent-calls/histogram` endpoint reuses the existing trace filter, projects `{CreatedAt, HttpStatus}` for the window, and buckets them in the app layer (a pure `AgentCallHistogram.Build`) into a fixed number of equal-width slots with total + error counts — provider-agnostic so it works on both PostgreSQL and the EF in-memory test provider (no migration, no raw SQL). The frontend renders a custom SVG timeline (matching the repo's `chart-math.ts` + `components/charts/` convention, no chart library) with a drag brush that sets `from`/`to` on the table query.

**Tech Stack:** C# / ASP.NET Core / EF Core / Autofac · React + TypeScript + TanStack Query · Vitest · MSTest + NSubstitute + AwesomeAssertions.

---

## Background / key constraints

- Backend `AgentCallFilter` (`Proxytrace.Domain/AgentCall/AgentCallFilter.cs`) already has `From`/`To`; the table UI only uses `From` today.
- **Tests + kiosk use the EF Core in-memory provider** (`docs/database.md`). It cannot translate `date_bin`/raw SQL — so bucketing MUST happen in C# after projecting rows, not in the DB.
- Repo conventions: custom SVG charts only (`frontend/src/components/charts/*` + pure geometry in `chart-math.ts`); UI controls via `components/ui/` primitives; no inline `style={{}}` except runtime-computed values; tokens only (`var(--accent-primary)` total, `var(--danger)` errors).
- Decisions locked with the user: preset-driven span + auto-pick smallest preset containing data on load; encode count + error overlay; brush applies live (debounced); histogram respects all active filters except the brush range.

## File structure

**Backend**
- Create `Proxytrace.Domain/AgentCall/AgentCallHistogram.cs` — pure bucketing builder + `AgentCallHistogramBucket` record.
- Modify `Proxytrace.Domain/AgentCall/IAgentCallRepository.cs` — add `GetHistogramAsync`.
- Modify `Proxytrace.Storage/Internal/Entities/AgentCall/AgentCallRepository.cs` — extract shared filter builder, add `GetHistogramAsync`.
- Create `Proxytrace.Api/Dto/AgentCalls/TraceHistogramBucketDto.cs`.
- Modify `Proxytrace.Api/Controllers/AgentCallsController.cs` — add `GetHistogram` endpoint.
- Create `Proxytrace.Domain.Tests/AgentCall/AgentCallHistogramTests.cs`.
- Create `Proxytrace.Storage.Tests/AgentCallHistogramQueryTests.cs`.
- Create `Proxytrace.Api.Tests/AgentCallsControllerHistogramTests.cs`.

**Frontend**
- Modify `frontend/src/api/models.ts` — add `TraceHistogramBucket`.
- Modify `frontend/src/api/agent-calls.ts` — add `histogram` call.
- Modify `frontend/src/api/query-keys.ts` — add `agentCallsHistogram`.
- Create `frontend/src/features/traces/hooks/useTraceHistogram.ts`.
- Create `frontend/src/features/traces/hooks/useAutoDefaultRange.ts`.
- Modify `frontend/src/components/charts/chart-math.ts` — add `computeTimeline`, `timeToX`, `xToTime`.
- Create `frontend/src/components/charts/TraceTimeline.tsx`.
- Modify `frontend/src/features/traces/tracesMeta.ts` — add `autoPreset`.
- Modify `frontend/src/features/traces/hooks/useTraceQueries.ts` — thread `to`.
- Modify `frontend/src/features/traces/Traces.tsx` — wire timeline + brush + auto-preset.
- Create `frontend/src/components/charts/chart-math.timeline.spec.ts`.
- Modify `frontend/src/features/traces/tracesMeta.spec.ts` — add `autoPreset` tests.

**Docs**
- Modify `manual/guide/` traces page; modify `docs/` (note new endpoint).

---

## Task 1: Pure histogram builder (Domain)

**Files:**
- Create: `Proxytrace.Domain/AgentCall/AgentCallHistogram.cs`
- Test: `Proxytrace.Domain.Tests/AgentCall/AgentCallHistogramTests.cs`

- [ ] **Step 1: Invoke the `test` skill**, then write the failing test

```csharp
using AwesomeAssertions;
using Proxytrace.Domain.AgentCall;

namespace Proxytrace.Domain.Tests.AgentCall;

[TestClass]
public sealed class AgentCallHistogramTests
{
    private static readonly DateTimeOffset From = new(2026, 6, 8, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset To = new(2026, 6, 8, 13, 0, 0, TimeSpan.Zero); // 1h window

    [TestMethod]
    public void Build_ProducesRequestedBucketCount_WithEvenStarts()
    {
        var result = AgentCallHistogram.Build([], From, To, 4);

        result.Should().HaveCount(4);
        result[0].Start.Should().Be(From);
        result[1].Start.Should().Be(From.AddMinutes(15));
        result[3].Start.Should().Be(From.AddMinutes(45));
        result.Should().OnlyContain(b => b.Total == 0 && b.Errors == 0);
    }

    [TestMethod]
    public void Build_AssignsCallsToBucketsAndCountsErrors()
    {
        var calls = new (DateTimeOffset, int)[]
        {
            (From.AddMinutes(1), 200),   // bucket 0
            (From.AddMinutes(2), 500),   // bucket 0, error
            (From.AddMinutes(20), 200),  // bucket 1
            (From.AddMinutes(58), 404),  // bucket 3, error
        };

        var result = AgentCallHistogram.Build(calls, From, To, 4);

        result[0].Total.Should().Be(2);
        result[0].Errors.Should().Be(1);
        result[1].Total.Should().Be(1);
        result[1].Errors.Should().Be(0);
        result[3].Total.Should().Be(1);
        result[3].Errors.Should().Be(1);
    }

    [TestMethod]
    public void Build_ClampsBoundaryTimestampIntoLastBucket()
    {
        var result = AgentCallHistogram.Build([(To, 200)], From, To, 4);

        result[3].Total.Should().Be(1);
    }

    [TestMethod]
    public void Build_IgnoresCallsOutsideWindow()
    {
        var result = AgentCallHistogram.Build(
            [(From.AddMinutes(-5), 200), (To.AddMinutes(5), 200)], From, To, 4);

        result.Sum(b => b.Total).Should().Be(0);
    }

    [TestMethod]
    public void Build_InvalidArguments_Throw()
    {
        var act1 = () => AgentCallHistogram.Build([], From, To, 0);
        act1.Should().Throw<ArgumentOutOfRangeException>();

        var act2 = () => AgentCallHistogram.Build([], To, From, 4);
        act2.Should().Throw<ArgumentException>();
    }
}
```

- [ ] **Step 2: Run, verify it fails** — `dotnet test Proxytrace.Domain.Tests --filter AgentCallHistogramTests` → FAIL (type not found).

- [ ] **Step 3: Implement**

```csharp
namespace Proxytrace.Domain.AgentCall;

public record AgentCallHistogramBucket(DateTimeOffset Start, int Total, int Errors);

/// <summary>
/// Buckets agent-call timestamps into a fixed number of equal-width slots spanning [from, to].
/// Each bucket carries the total call count and the count whose HTTP status indicates an error
/// (>= <see cref="ErrorStatusThreshold"/>). Pure and provider-agnostic so it runs identically over
/// PostgreSQL-sourced and in-memory rows.
/// </summary>
public static class AgentCallHistogram
{
    public const int ErrorStatusThreshold = 400;

    public static IReadOnlyList<AgentCallHistogramBucket> Build(
        IReadOnlyList<(DateTimeOffset CreatedAt, int HttpStatus)> calls,
        DateTimeOffset from,
        DateTimeOffset to,
        int buckets)
    {
        if (buckets < 1) throw new ArgumentOutOfRangeException(nameof(buckets));
        if (to <= from) throw new ArgumentException("to must be after from", nameof(to));

        var totals = new int[buckets];
        var errors = new int[buckets];
        var width = (to - from).Ticks / (double)buckets;

        foreach (var (createdAt, httpStatus) in calls)
        {
            if (createdAt < from || createdAt > to) continue;
            var idx = (int)((createdAt - from).Ticks / width);
            if (idx < 0) idx = 0;
            if (idx >= buckets) idx = buckets - 1;
            totals[idx]++;
            if (httpStatus >= ErrorStatusThreshold) errors[idx]++;
        }

        var result = new AgentCallHistogramBucket[buckets];
        for (var i = 0; i < buckets; i++)
            result[i] = new AgentCallHistogramBucket(from.AddTicks((long)(i * width)), totals[i], errors[i]);
        return result;
    }
}
```

- [ ] **Step 4: Run, verify PASS** — same filter command → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add pure agent-call histogram bucketing"`

---

## Task 2: Repository GetHistogramAsync

**Files:**
- Modify: `Proxytrace.Domain/AgentCall/IAgentCallRepository.cs`
- Modify: `Proxytrace.Storage/Internal/Entities/AgentCall/AgentCallRepository.cs`
- Test: `Proxytrace.Storage.Tests/AgentCallHistogramQueryTests.cs`

- [ ] **Step 1: Add interface method** to `IAgentCallRepository` (after `GetFilteredAsync`):

```csharp
    /// <summary>
    /// Buckets matching calls into <paramref name="buckets"/> equal-width time slots spanning the
    /// filter window. When <see cref="AgentCallFilter.From"/> is null the window starts at the
    /// earliest matching call; when <see cref="AgentCallFilter.To"/> is null it ends at "now".
    /// Returns an empty list when nothing matches.
    /// </summary>
    Task<IReadOnlyList<AgentCallHistogramBucket>> GetHistogramAsync(
        AgentCallFilter filter,
        int buckets,
        CancellationToken cancellationToken = default);
```

- [ ] **Step 2: Invoke the `test` skill**, then write the failing test

```csharp
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class AgentCallHistogramQueryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetHistogram_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<IAgentCallRepository>();

        var result = await repo.GetHistogramAsync(
            new AgentCallFilter(From: DateTimeOffset.UtcNow.AddHours(-1), To: DateTimeOffset.UtcNow),
            buckets: 6,
            CancellationToken);

        result.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetHistogram_WithSeededCalls_CountsLandInWindow()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<IAgentCallRepository>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken);

        var result = await repo.GetHistogramAsync(
            new AgentCallFilter(
                From: DateTimeOffset.UtcNow.AddMinutes(-5),
                To: DateTimeOffset.UtcNow.AddMinutes(5)),
            buckets: 6,
            CancellationToken);

        result.Should().HaveCount(6);
        result.Sum(b => b.Total).Should().Be(2);
    }

    [TestMethod]
    public async Task GetHistogram_NoFrom_DerivesWindowFromEarliestCall()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<IAgentCallRepository>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);

        var result = await repo.GetHistogramAsync(new AgentCallFilter(), buckets: 4, CancellationToken);

        result.Should().HaveCount(4);
        result.Sum(b => b.Total).Should().Be(1);
    }
}
```

- [ ] **Step 3: Run, verify it fails** — `dotnet test Proxytrace.Storage.Tests --filter AgentCallHistogramQueryTests` → FAIL (method missing / not implemented).

- [ ] **Step 4: Refactor the shared filter into a private helper.** In `AgentCallRepository.cs`, replace the body of `GetFilteredAsync` (lines 39–116, everything from `var query = …` through the fulltext block, and the system-agent block) by extracting a private method. Add this method and rewrite `GetFilteredAsync` to call it:

```csharp
    /// <summary>
    /// Builds the filtered (but unpaged, unordered) query shared by list + histogram reads.
    /// Returns <see langword="null"/> when the filter provably matches nothing (e.g. a fulltext
    /// query with no hits, or a query without a project scope).
    /// </summary>
    private async Task<IQueryable<AgentCallEntity>?> BuildFilteredQueryAsync(
        StorageDbContext context,
        AgentCallFilter filter,
        CancellationToken cancellationToken)
    {
        var query = context.Set<AgentCallEntity>().AsNoTracking();

        if (filter.AgentId.HasValue)
        {
            var agentId = filter.AgentId.Value;
            var versionIdsForAgent = context.Set<AgentVersionEntity>()
                .Where(v => v.AgentId == agentId)
                .Select(v => v.Id);
            query = query.Where(e => versionIdsForAgent.Contains(e.AgentVersionId));
        }

        if (filter.ProjectId.HasValue)
        {
            var projectId = filter.ProjectId.Value;
            var versionIdsForProject = context.Set<AgentVersionEntity>()
                .Where(v => v.Project == projectId)
                .Select(v => v.Id);
            query = query.Where(e => versionIdsForProject.Contains(e.AgentVersionId));
        }

        if (filter.EndpointId is not null)
            query = query.Where(e => e.EndpointId == filter.EndpointId);

        if (filter.ConversationId.HasValue)
            query = query.Where(e => e.ConversationId == filter.ConversationId.Value);

        if (!string.IsNullOrWhiteSpace(filter.Model))
        {
            var search = filter.Model;
            var matchingEndpointIds = context.Set<ModelEndpointEntity>()
                .Where(me => context.Set<ModelEntity>()
                    .Any(m => m.Id == me.Model && EF.Functions.Like(m.Name, $"%{search}%")))
                .Select(me => me.Id);
            query = query.Where(e => matchingEndpointIds.Contains(e.EndpointId));
        }

        if (filter.From.HasValue)
            query = query.Where(e => e.CreatedAt >= filter.From.Value);

        if (filter.To.HasValue)
            query = query.Where(e => e.CreatedAt <= filter.To.Value);

        if (filter.HttpStatus.HasValue)
            query = query.Where(e => e.HttpStatus == filter.HttpStatus.Value);

        if (!string.IsNullOrWhiteSpace(filter.Query))
        {
            if (filter.ProjectId is null)
                return null;

            var matchingIds = await searchService.SearchEntityIdsAsync(
                filter.ProjectId.Value, filter.Query, SearchKind.AgentCall, MaxFulltextHits, cancellationToken);

            if (matchingIds.Count == 0)
                return null;

            var idSet = matchingIds.ToHashSet();
            query = query.Where(e => idSet.Contains(e.Id));
        }

        if (!filter.IncludeSystemAgents)
        {
            var nonSystemVersionIds =
                from v in context.Set<AgentVersionEntity>()
                join a in context.Set<AgentEntity>() on v.AgentId equals a.Id
                where !a.IsSystemAgent
                select v.Id;
            query = query.Where(e => nonSystemVersionIds.Contains(e.AgentVersionId));
        }

        return query;
    }
```

Rewrite `GetFilteredAsync` to use it:

```csharp
    public async Task<(IReadOnlyList<IAgentCall> Items, int Total)> GetFilteredAsync(
        AgentCallFilter filter,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var query = await BuildFilteredQueryAsync(context, filter, cancellationToken);
        if (query is null)
            return ([], 0);

        var total = await query.CountAsync(cancellationToken);

        var stored = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = await Map(stored, cancellationToken);
        return (items, total);
    }
```

- [ ] **Step 5: Add `GetHistogramAsync`** to `AgentCallRepository.cs`:

```csharp
    public async Task<IReadOnlyList<AgentCallHistogramBucket>> GetHistogramAsync(
        AgentCallFilter filter,
        int buckets,
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var query = await BuildFilteredQueryAsync(context, filter, cancellationToken);
        if (query is null)
            return [];

        var to = filter.To ?? DateTimeOffset.UtcNow;
        DateTimeOffset from;
        if (filter.From.HasValue)
        {
            from = filter.From.Value;
        }
        else
        {
            if (!await query.AnyAsync(cancellationToken))
                return [];
            from = await query.MinAsync(e => e.CreatedAt, cancellationToken);
        }
        if (to <= from)
            to = from.AddSeconds(1);

        var rows = await query
            .Where(e => e.CreatedAt >= from && e.CreatedAt <= to)
            .Select(e => new { e.CreatedAt, e.HttpStatus })
            .ToListAsync(cancellationToken);

        var calls = rows.Select(r => (r.CreatedAt, r.HttpStatus)).ToList();
        return AgentCallHistogram.Build(calls, from, to, buckets);
    }
```

- [ ] **Step 6: Run, verify PASS** — `dotnet test Proxytrace.Storage.Tests --filter AgentCallHistogramQueryTests` → PASS. Then run the full `Proxytrace.Storage.Tests` to confirm the `GetFilteredAsync` refactor didn't regress existing list/filter tests.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: add agent-call histogram repository query"`

---

## Task 3: Histogram API endpoint

**Files:**
- Create: `Proxytrace.Api/Dto/AgentCalls/TraceHistogramBucketDto.cs`
- Modify: `Proxytrace.Api/Controllers/AgentCallsController.cs`
- Test: `Proxytrace.Api.Tests/AgentCallsControllerHistogramTests.cs`

- [ ] **Step 1: Create the DTO**

```csharp
namespace Proxytrace.Api.Dto.AgentCalls;

public record TraceHistogramBucketDto(DateTimeOffset Start, int Total, int Errors);
```

- [ ] **Step 2: Invoke the `test` skill**, then write the failing controller test. (The controller constructor takes 8 deps; only `IAgentCallRepository` matters here — substitute the rest. Delegates `IAgentCall.CreateNew` / `ICompletion.Create` are substitutable via NSubstitute.)

```csharp
using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Api.Dto.Tools;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Completion;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class AgentCallsControllerHistogramTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetHistogram_MapsBucketsToDto()
    {
        var repo = Substitute.For<IAgentCallRepository>();
        var start = DateTimeOffset.UtcNow;
        repo.GetHistogramAsync(Arg.Any<AgentCallFilter>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([new AgentCallHistogramBucket(start, 5, 2)]);
        var controller = ResolveController(repo);

        var result = await controller.GetHistogram(cancellationToken: CancellationToken);

        result.Should().ContainSingle();
        result[0].Start.Should().Be(start);
        result[0].Total.Should().Be(5);
        result[0].Errors.Should().Be(2);
    }

    [TestMethod]
    public async Task GetHistogram_ClampsBucketCount_AndForwardsFilter()
    {
        var repo = Substitute.For<IAgentCallRepository>();
        repo.GetHistogramAsync(Arg.Any<AgentCallFilter>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        var controller = ResolveController(repo);
        var agentId = Guid.NewGuid();

        await controller.GetHistogram(agentId: agentId, buckets: 99999, cancellationToken: CancellationToken);

        await repo.Received(1).GetHistogramAsync(
            Arg.Is<AgentCallFilter>(f => f.AgentId == agentId),
            240,
            Arg.Any<CancellationToken>());
    }

    private static AgentCallsController ResolveController(IAgentCallRepository repo)
    {
        var toolDtoMapper = new ToolDtoMapper();
        return new AgentCallsController(
            repo,
            Substitute.For<IAgentRepository>(),
            Substitute.For<IDashboardStatistics>(),
            Substitute.For<ITraceBroadcaster>(),
            new AgentCallDtoMapper(toolDtoMapper),
            new AgentDtoMapper(toolDtoMapper),
            Substitute.For<IAgentCall.CreateNew>(),
            Substitute.For<ICompletion.Create>());
    }
}
```

> If any `using` above is wrong, fix it against the real namespaces (`ResolveController` mirrors `StatisticsControllerTests`). Verify `ToolDtoMapper`/`AgentCallDtoMapper`/`AgentDtoMapper` constructor signatures match that existing test.

- [ ] **Step 3: Run, verify it fails** — `dotnet test Proxytrace.Api.Tests --filter AgentCallsControllerHistogramTests` → FAIL (no `GetHistogram`).

- [ ] **Step 4: Add the endpoint** to `AgentCallsController.cs` (after `GetOverview`):

```csharp
    [HttpGet("histogram")]
    public async Task<IReadOnlyList<TraceHistogramBucketDto>> GetHistogram(
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endpointId = null,
        [FromQuery] string? model = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int? httpStatus = null,
        [FromQuery] bool includeSystemAgents = true,
        [FromQuery] string? q = null,
        [FromQuery] Guid? conversationId = null,
        [FromQuery] int buckets = 60,
        CancellationToken cancellationToken = default)
    {
        buckets = Math.Clamp(buckets, 1, 240);
        var filter = new AgentCallFilter(agentId, projectId, endpointId, model, from, to, httpStatus, includeSystemAgents, q, conversationId);
        var result = await repository.GetHistogramAsync(filter, buckets, cancellationToken);
        return result.Select(b => new TraceHistogramBucketDto(b.Start, b.Total, b.Errors)).ToList();
    }
```

- [ ] **Step 5: Run, verify PASS** — same filter command → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: add GET /api/agent-calls/histogram endpoint"`

---

## Task 4: Frontend data layer (types, api, query key)

**Files:**
- Modify: `frontend/src/api/models.ts`
- Modify: `frontend/src/api/agent-calls.ts`
- Modify: `frontend/src/api/query-keys.ts`

- [ ] **Step 1: Add the model** to `models.ts` (near `AgentCallFilter`, in the Filters section):

```typescript
export interface TraceHistogramBucket {
  start: string;
  total: number;
  errors: number;
}
```

- [ ] **Step 2: Add the API call** to `agent-calls.ts` (`AgentCallFilter` already carries `from`/`to`/filters; add `buckets`):

```typescript
import { api, qs } from './client';
import type { AgentCallDto, AgentCallFilter, PagedResult, TracesOverviewDto, TraceHistogramBucket } from './models';

export const agentCallsApi = {
  list: (filter?: AgentCallFilter) =>
    api.get<PagedResult<AgentCallDto>>(`/api/agent-calls${qs((filter ?? {}) as Record<string, unknown>)}`),
  overview: (params?: { projectId?: string; agentId?: string; from?: string }) =>
    api.get<TracesOverviewDto>(`/api/agent-calls/overview${qs(params ?? {})}`),
  histogram: (filter: AgentCallFilter & { buckets?: number }) =>
    api.get<TraceHistogramBucket[]>(`/api/agent-calls/histogram${qs(filter as Record<string, unknown>)}`),
  get: (id: string) => api.get<AgentCallDto>(`/api/agent-calls/${id}`),
  delete: (id: string) => api.del(`/api/agent-calls/${id}`),
};
```

- [ ] **Step 3: Add the query key** to `query-keys.ts` (next to `agentCallsOverview`):

```typescript
  agentCallsHistogram: (filter: object) => ['agent-calls', 'histogram', filter] as const,
```

- [ ] **Step 4: Verify compile** — `cd frontend && npx tsc --noEmit` → no new errors.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add histogram api client + types"`

---

## Task 5: useTraceHistogram hook

**Files:**
- Create: `frontend/src/features/traces/hooks/useTraceHistogram.ts`

- [ ] **Step 1: Implement** (mirrors the `overviewQuery` pattern in `useTraceQueries.ts`; histogram window = preset `from`..now, respecting the other active filters, **not** the brush):

```typescript
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import type { AgentCallFilter, TraceHistogramBucket } from '../../../api/models';

const BUCKETS = 64;

interface Params {
  from: string | undefined;
  agentFilter: string;
  debouncedSearch: string;
  showSystem: boolean;
}

/** Count+error timeline for the current preset window, ignoring the brush sub-range. */
export function useTraceHistogram({ from, agentFilter, debouncedSearch, showSystem }: Params): {
  buckets: TraceHistogramBucket[];
  isFetching: boolean;
} {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  const trimmedSearch = debouncedSearch.trim();
  const filter: AgentCallFilter & { buckets: number } = {
    buckets: BUCKETS,
    includeSystemAgents: showSystem,
    ...(projectId ? { projectId } : {}),
    ...(agentFilter ? { agentId: agentFilter } : {}),
    ...(from ? { from } : {}),
    ...(trimmedSearch.length >= 2 ? { q: trimmedSearch } : {}),
  };

  const query = useQuery({
    queryKey: QUERY_KEYS.agentCallsHistogram(filter),
    queryFn: () => agentCallsApi.histogram(filter),
    placeholderData: keepPreviousData,
    enabled,
  });

  return { buckets: query.data ?? [], isFetching: query.isFetching };
}
```

- [ ] **Step 2: Verify compile** — `cd frontend && npx tsc --noEmit`.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add useTraceHistogram hook"`

---

## Task 6: Timeline geometry in chart-math (TDD)

**Files:**
- Modify: `frontend/src/components/charts/chart-math.ts`
- Test: `frontend/src/components/charts/chart-math.timeline.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { computeTimeline, timeToX, xToTime } from './chart-math';

describe('computeTimeline', () => {
  const buckets = [
    { total: 0, errors: 0 },
    { total: 10, errors: 0 },
    { total: 10, errors: 5 },
    { total: 4, errors: 4 },
  ];

  it('produces one bar per bucket spanning the plot width', () => {
    const t = computeTimeline(buckets, 400, 60);
    expect(t.bars).toHaveLength(4);
    expect(t.bars[0].x).toBeGreaterThanOrEqual(t.plotL);
    const last = t.bars[3];
    expect(last.x + last.w).toBeLessThanOrEqual(t.plotR + 0.5);
  });

  it('scales total height to the tallest bucket and keeps errors within total', () => {
    const t = computeTimeline(buckets, 400, 60);
    expect(t.bars[1].totalH).toBeGreaterThan(0);
    t.bars.forEach(b => {
      expect(b.errorH).toBeLessThanOrEqual(b.totalH + 0.001);
      expect(b.errorY + b.errorH).toBeCloseTo(t.baselineY, 1); // errors stacked at the bottom
    });
  });

  it('gives an empty bucket zero height', () => {
    const t = computeTimeline(buckets, 400, 60);
    expect(t.bars[0].totalH).toBe(0);
  });
});

describe('timeToX / xToTime', () => {
  it('round-trips a time within the window', () => {
    const from = 1000, to = 5000, plotL = 10, plotR = 410;
    const x = timeToX(3000, from, to, plotL, plotR);
    expect(x).toBeCloseTo(210, 1);
    expect(xToTime(x, from, to, plotL, plotR)).toBeCloseTo(3000, 1);
  });

  it('clamps outside the plot range', () => {
    expect(xToTime(-50, 1000, 5000, 10, 410)).toBe(1000);
    expect(xToTime(9999, 1000, 5000, 10, 410)).toBe(5000);
  });
});
```

- [ ] **Step 2: Run, verify it fails** — `cd frontend && npx vitest run src/components/charts/chart-math.timeline.spec.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement** — append to `chart-math.ts`:

```typescript
export interface TimelineBarRect {
  x: number; w: number;
  totalY: number; totalH: number;
  errorY: number; errorH: number;
}
export interface TimelineData {
  bars: TimelineBarRect[];
  baselineY: number;
  plotL: number; plotR: number; plotT: number; plotB: number;
}

/** Stacked count+error bars filling the full width (no axis gutter — full-bleed timeline strip). */
export function computeTimeline(
  buckets: { total: number; errors: number }[],
  width: number,
  height: number,
): TimelineData {
  const padL = 2, padR = 2, padT = 6, padB = 16;
  const w = Math.max(width - padL - padR, 0);
  const h = Math.max(height - padT - padB, 0);
  const baselineY = padT + h;
  const max = Math.max(...buckets.map(b => b.total), 0) * 1.1 || 1;
  const slot = buckets.length > 0 ? w / buckets.length : w;
  const bw = slot * 0.82, gap = slot * 0.18;
  const bars: TimelineBarRect[] = buckets.map((b, i) => {
    const x = padL + i * slot + gap / 2;
    const totalH = (b.total / max) * h;
    const errorH = (b.errors / max) * h;
    return {
      x, w: bw,
      totalY: baselineY - totalH, totalH,
      errorY: baselineY - errorH, errorH,
    };
  });
  return { bars, baselineY, plotL: padL, plotR: padL + w, plotT: padT, plotB: baselineY };
}

export function timeToX(t: number, from: number, to: number, plotL: number, plotR: number): number {
  if (to <= from) return plotL;
  const frac = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return plotL + frac * (plotR - plotL);
}

export function xToTime(x: number, from: number, to: number, plotL: number, plotR: number): number {
  if (plotR <= plotL) return from;
  const frac = Math.min(1, Math.max(0, (x - plotL) / (plotR - plotL)));
  return from + frac * (to - from);
}
```

- [ ] **Step 4: Run, verify PASS** — same vitest command → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add timeline geometry helpers"`

---

## Task 7: TraceTimeline component

**Files:**
- Create: `frontend/src/components/charts/TraceTimeline.tsx`

> This is a render+interaction component; geometry is already covered by Task 6 tests. Verify via build/lint + manual (Task 10). Keep JSX focused.

- [ ] **Step 1: Implement**

```tsx
import { useMemo, useRef, useState } from 'react';
import { computeTimeline, timeToX, xToTime } from './chart-math';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { TraceHistogramBucket } from '../../api/models';

interface Props {
  buckets: TraceHistogramBucket[];
  /** Window bounds in epoch ms (preset span). */
  from: number;
  to: number;
  /** Active brush selection in epoch ms, or null. */
  selection: { from: number; to: number } | null;
  onSelect: (range: { from: number; to: number } | null) => void;
  height?: number;
}

export function TraceTimeline({ buckets, from, to, selection, onSelect, height = 72 }: Props) {
  const [ref, measuredWidth] = useElementWidth<HTMLDivElement>(600);
  const w = measuredWidth || 600;
  const geo = useMemo(() => computeTimeline(buckets, w, height), [buckets, w, height]);
  const drag = useRef<{ startX: number } | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const pxToTime = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return from;
    const xVb = ((clientX - rect.left) / rect.width) * w;
    return xToTime(xVb, from, to, geo.plotL, geo.plotR);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const a = pxToTime(drag.current.startX);
    const b = pxToTime(e.clientX);
    onSelect({ from: Math.min(a, b), to: Math.max(a, b) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current && Math.abs(e.clientX - drag.current.startX) < 4) onSelect(null); // click clears
    drag.current = null;
  };

  const selX1 = selection ? timeToX(selection.from, from, to, geo.plotL, geo.plotR) : 0;
  const selX2 = selection ? timeToX(selection.to, from, to, geo.plotL, geo.plotR) : 0;
  const hoverBucket = hoverIdx !== null ? buckets[hoverIdx] : null;

  return (
    <div
      ref={ref}
      className="relative w-full select-none cursor-crosshair rounded-md bg-card shadow-[var(--shadow-pill)]"
      onPointerDown={onPointerDown}
      onPointerMove={e => { onPointerMove(e); if (geo.bars.length) {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) { const xVb = ((e.clientX - rect.left) / rect.width) * w;
          setHoverIdx(Math.min(geo.bars.length - 1, Math.max(0, Math.floor((xVb - geo.plotL) / ((geo.plotR - geo.plotL) / geo.bars.length))))); } } }}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHoverIdx(null)}
    >
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} className="block">
        <line x1={geo.plotL} x2={geo.plotR} y1={geo.baselineY} y2={geo.baselineY} stroke="var(--border-color)" />
        {geo.bars.map((b, i) => (
          <g key={i}>
            {b.totalH > 0 && <rect x={b.x} y={b.totalY} width={b.w} height={b.totalH} fill="var(--accent-primary)" opacity={0.55} rx={1} />}
            {b.errorH > 0 && <rect x={b.x} y={b.errorY} width={b.w} height={b.errorH} fill="var(--danger)" rx={1} />}
          </g>
        ))}
        {selection && (
          <rect x={selX1} y={geo.plotT} width={Math.max(selX2 - selX1, 1)} height={geo.baselineY - geo.plotT}
            fill="var(--accent-primary)" opacity={0.12} stroke="var(--accent-primary)" strokeOpacity={0.5} />
        )}
        {selection && [selX1, selX2].map((x, i) => (
          <rect key={i} x={x - 2} y={geo.plotT} width={4} height={geo.baselineY - geo.plotT}
            fill="var(--accent-primary)" className="cursor-ew-resize" rx={1} />
        ))}
      </svg>
      {hoverBucket && (
        <div className="pointer-events-none absolute top-1 left-1 rounded-sm bg-card px-2 py-1 text-caption text-secondary shadow-[var(--shadow-float)]">
          {new Date(hoverBucket.start).toLocaleTimeString()} · {hoverBucket.total} traces
          {hoverBucket.errors > 0 && <span className="text-[var(--danger)]"> · {hoverBucket.errors} err</span>}
        </div>
      )}
    </div>
  );
}
```

> Notes: handle drag for resizing existing handles can be added later — drag-to-create + click-to-clear covers the locked scope. If the inline `onPointerMove` arrow grows unwieldy under lint, extract a `handlePointerMove` function. Confirm `var(--border-color)` token exists (used in `Histogram.tsx`).

- [ ] **Step 2: Verify compile + lint** — `cd frontend && npx tsc --noEmit && npm run lint`. Fix any `no-restricted-syntax` / inline-style violations (this component uses no `style={{}}`; all colors are SVG `fill` attrs which are allowed).

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add TraceTimeline brushable chart"`

---

## Task 8: Auto-preset helper (TDD)

**Files:**
- Modify: `frontend/src/features/traces/tracesMeta.ts`
- Modify: `frontend/src/features/traces/tracesMeta.spec.ts`

- [ ] **Step 1: Write the failing test** — add to `tracesMeta.spec.ts`:

```typescript
import { autoPreset } from './tracesMeta';

describe('autoPreset', () => {
  const now = new Date('2026-06-08T12:00:00Z').getTime();
  it('returns all when there is no trace', () => {
    expect(autoPreset(null, now)).toBe('all');
  });
  it('picks the smallest preset containing the newest trace', () => {
    expect(autoPreset(new Date(now - 30 * 60_000).toISOString(), now)).toBe('1h');
    expect(autoPreset(new Date(now - 5 * 3_600_000).toISOString(), now)).toBe('24h');
    expect(autoPreset(new Date(now - 3 * 86_400_000).toISOString(), now)).toBe('7d');
    expect(autoPreset(new Date(now - 20 * 86_400_000).toISOString(), now)).toBe('30d');
    expect(autoPreset(new Date(now - 90 * 86_400_000).toISOString(), now)).toBe('all');
  });
});
```

- [ ] **Step 2: Run, verify it fails** — `cd frontend && npx vitest run src/features/traces/tracesMeta.spec.ts` → FAIL.

- [ ] **Step 3: Implement** — add to `tracesMeta.ts` (after `rangeFrom`):

```typescript
/** Smallest range preset whose window still contains the newest trace; "all" when none. */
export function autoPreset(newestTraceIso: string | null, now: number = Date.now()): RangeKey {
  if (!newestTraceIso) return 'all';
  const age = now - new Date(newestTraceIso).getTime();
  if (age <= 3_600_000) return '1h';
  if (age <= 86_400_000) return '24h';
  if (age <= 7 * 86_400_000) return '7d';
  if (age <= 30 * 86_400_000) return '30d';
  return 'all';
}
```

- [ ] **Step 4: Run, verify PASS** — same vitest command → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add autoPreset range helper"`

---

## Task 9: Wire timeline + brush + auto-preset into Traces

**Files:**
- Create: `frontend/src/features/traces/hooks/useAutoDefaultRange.ts`
- Modify: `frontend/src/features/traces/hooks/useTraceQueries.ts`
- Modify: `frontend/src/features/traces/Traces.tsx`

- [ ] **Step 1: Thread `to` through `useTraceQueries.ts`.** Add `to` to the `TraceFilter` interface and to the destructure + filter object:

```typescript
interface TraceFilter {
  page: number;
  pageSize: number;
  range: string;
  agentFilter: string;
  debouncedSearch: string;
  showSystem: boolean;
  from: string | undefined;
  to: string | undefined;
}

export function useTraceQueries({ page, pageSize, agentFilter, debouncedSearch, showSystem, from, to }: TraceFilter) {
  // ...unchanged up to filter...
  const filter: AgentCallFilter = {
    page,
    pageSize,
    includeSystemAgents: showSystem,
    ...(projectId ? { projectId } : {}),
    ...(agentFilter ? { agentId: agentFilter } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(trimmedSearch.length >= 2 ? { q: trimmedSearch } : {}),
  };
  // ...overviewQuery stays keyed on `from` only (unchanged)...
}
```

- [ ] **Step 2: Create `useAutoDefaultRange.ts`** (fetch newest trace via `useQuery`; apply preset once — the effect only reacts to query data, it does not fetch):

```typescript
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { autoPreset } from '../tracesMeta';

/** On first load, set the range preset to the smallest window containing the newest trace. */
export function useAutoDefaultRange(
  enabled: boolean,
  projectId: string | undefined,
  setRange: (key: string) => void,
) {
  const applied = useRef(false);
  const { data } = useQuery({
    queryKey: ['traces-newest', projectId ?? null],
    queryFn: () => agentCallsApi.list({ pageSize: 1, includeSystemAgents: true, ...(projectId ? { projectId } : {}) }),
    enabled,
  });
  useEffect(() => {
    if (applied.current || !data) return;
    applied.current = true;
    setRange(autoPreset(data.items[0]?.createdAt ?? null));
  }, [data, setRange]);
}
```

- [ ] **Step 3: Wire `Traces.tsx`.** Add brush state + the histogram hook + timeline render + the table window. Concretely:

  1. Add imports:
     ```tsx
     import { TraceTimeline } from '../../components/charts/TraceTimeline';
     import { useTraceHistogram } from './hooks/useTraceHistogram';
     import { useAutoDefaultRange } from './hooks/useAutoDefaultRange';
     import useCurrentProject from '../../hooks/useCurrentProject';
     ```
  2. Add state near the other `useState`s:
     ```tsx
     const [brush, setBrush] = useState<{ from: number; to: number } | null>(null);
     ```
  3. After `const from = useMemo(...)`, compute the window + table bounds:
     ```tsx
     const { currentProjectId } = useCurrentProject();
     const windowFrom = useMemo(() => from ? new Date(from).getTime() : null, [from]);
     const windowTo = useMemo(() => Date.now(), [from]); // re-anchors when the preset changes
     // Brush narrows the table; otherwise the table uses the full preset window.
     const tableFrom = brush ? new Date(brush.from).toISOString() : from;
     const tableTo = brush ? new Date(brush.to).toISOString() : undefined;
     ```
  4. Auto-preset on mount:
     ```tsx
     useAutoDefaultRange(currentProjectId !== null, currentProjectId ?? undefined, setRange);
     ```
  5. Pass `to: tableTo` and `from: tableFrom` into `useTraceQueries({ ... from: tableFrom, to: tableTo })`.
  6. Histogram (uses preset window + filters, never the brush):
     ```tsx
     const { buckets } = useTraceHistogram({ from, agentFilter, debouncedSearch, showSystem });
     ```
  7. Clear the brush whenever the preset changes — extend `handleRangeChange`:
     ```tsx
     function handleRangeChange(key: string) {
       setRange(key);
       setBrush(null);
       setPage(1);
     }
     ```
  8. Render the timeline between `<TraceToolbar/>` and `<TraceTable/>` (only when the window is bounded; for the `all` preset `windowFrom` is null — fall back to the earliest bucket's start if buckets exist):
     ```tsx
     {buckets.length > 0 && (
       <TraceTimeline
         buckets={buckets}
         from={windowFrom ?? new Date(buckets[0].start).getTime()}
         to={windowTo}
         selection={brush}
         onSelect={range => { setBrush(range); setPage(1); }}
       />
     )}
     ```

> Note the brush is set immediately on drag; the table query debounces naturally because `tableFrom`/`tableTo` feed `useTraceQueries` whose `keepPreviousData` smooths refetches. If drag feels too chatty, wrap `brush` in `useDebounce` before computing `tableFrom`/`tableTo` (the `useDebounce` hook is already imported).

- [ ] **Step 4: Verify** — `cd frontend && npx tsc --noEmit && npm run lint && npm run build` → all green. Run `npx vitest run` → all green.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: wire trace timeline brush + auto-preset into Traces"`

---

## Task 10: Manual verification + docs

**Files:**
- Modify: `manual/guide/` traces page (find the existing traces guide page)
- Modify: `docs/` (add a note on the histogram endpoint — likely `docs/sse-events.md` is unrelated; add to the traces/architecture area or wherever agent-calls endpoints are described)

- [ ] **Step 1: Manual smoke test.** Boot the stack per `docs/commands.md` (`docker compose up -d postgres`, run API, `cd frontend && npm run dev`). Open Traces and confirm:
  - timeline strip renders above the table with count bars; error-heavy buckets show red;
  - on load the range preset auto-selects the smallest window that contains data (verify with both recent-only and old-only data);
  - dragging across the timeline filters the table to that sub-range; clicking once clears the brush back to the full preset;
  - changing the preset dropdown clears the brush and re-spans the timeline;
  - agent/search/system filters change the timeline shape too (histogram matches the table).

- [ ] **Step 2: Update the user manual.** In the traces guide page under `manual/guide/`, document the timeline: what the bars mean (count + error overlay), drag to select a range, click to clear. Preview with `cd manual && npm run docs:dev`; verify `npm run docs:build`.

- [ ] **Step 3: Update `docs/`.** Add a short note where agent-call endpoints/traces are described that `GET /api/agent-calls/histogram` returns per-bucket `{start,total,errors}` for the timeline, app-layer bucketed (provider-agnostic, no migration).

- [ ] **Step 4: Final full verification** — backend `dotnet test` (Domain + Storage + Api projects), frontend `npm run lint && npm run build && npx vitest run`. All green.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "docs: document traces timeline filter + histogram endpoint"`

---

## Self-review notes (addressed)

- **Provider constraint:** bucketing is app-layer (`AgentCallHistogram.Build`) over a projected `{CreatedAt, HttpStatus}` list — works on EF in-memory (tests) and PostgreSQL (prod). No `date_bin`, no migration.
- **Filter parity:** histogram and table both go through `BuildFilteredQueryAsync`, so they never disagree.
- **`all` preset:** `from` is undefined → repository derives the window start from the earliest matching call; the timeline component falls back to the first bucket's start for its `from`.
- **Type consistency:** `TraceHistogramBucket {start,total,errors}` (TS) ↔ `TraceHistogramBucketDto(Start,Total,Errors)` (DTO) ↔ `AgentCallHistogramBucket(Start,Total,Errors)` (domain). `GetHistogramAsync(filter, buckets, ct)` signature identical across interface, impl, and controller call.
- **Brush semantics:** drag-to-create + click-to-clear (locked scope); handle-resize noted as optional follow-up, not required.
