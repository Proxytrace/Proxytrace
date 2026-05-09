# Full-Text Search — Design

## Context

The Shell currently renders a placeholder search bar (`Shell.tsx:125–134`) with no behavior. Users need to find content across four entity kinds within the active project:

- **Agents** — name, system prompt (name + template), tool name, tool description.
- **Test Suites / Test Cases** — suite name, test case input messages, expected output.
- **Agent Calls (traces)** — request conversation text, response text, error message.
- **Evaluators** — `Custom` evaluator system prompt name + template.

Most searchable text lives inside JSON-serialized columns (`Conversation`, `IPromptTemplate`, `ToolSpecification[]`), which makes DB-native LIKE/FTS awkward. The chosen approach is an **embedded Lucene.NET index**, populated synchronously by repository decorators, scoped per project, with a rolling 30-day retention window for trace documents.

## Goals

1. Single search bar returns ranked hits across all four entity kinds.
2. Tokenized BM25 ranking, prefix matching (`auth*`), and phrase queries (`"system prompt"`).
3. Results capped to **3–5 hits per entity kind** to keep payloads small.
4. Each hit returns a highlighted snippet for context.
5. Cross-DB-provider (works on SQLite, Postgres, SQL Server) — index lives outside the DB.
6. Crash-tolerant: full reindex available via admin endpoint.
7. Project-scoped: only the active project's content is searched.

## Non-Goals

- Fuzzy / typo tolerance (deferred — Lucene supports it later).
- Cross-project search.
- Indexing trace bodies older than the retention window.
- Semantic / vector search.
- Real-time push of new traces to an open search modal (search is request/response).

## Architecture

### New namespace: `Trsr.Application.Search`

Lives inside the existing `Trsr.Application` project under `Trsr.Application/Search/`. No new csproj. Registered through the existing `Trsr.Application.Module` (sub-module pattern, same as the optimization sub-module already used by Application).

Domain stays pure: only the contracts (`ISearchService`, `ISearchIndexer`, `SearchHit`, `SearchKind`, `SearchResults`) live in `Trsr.Domain/Search/`. The Lucene-backed implementation is `internal` inside `Trsr.Application/Search/Internal/`.

### Layers

```
Trsr.Api  (SearchController)
   ↓
Trsr.Application.Search  (LuceneSearchService, LuceneIndexWriter, mappers, repo decorators)
   ↓
Trsr.Domain  (ISearchService, ISearchIndexer, SearchHit, SearchKind)
```

### Domain contracts (`Trsr.Domain/Search/`)

```csharp
public enum SearchKind { Agent, TestSuite, AgentCall, Evaluator }

public sealed record SearchHit(
    SearchKind Kind,
    Guid EntityId,
    string Title,
    string Snippet,        // already highlighted with <mark> tags
    double Score,
    IReadOnlyDictionary<string, string> Metadata);  // e.g. AgentId on a trace

public sealed record SearchResults(IReadOnlyList<SearchHit> Hits);

public interface ISearchService
{
    Task<SearchResults> SearchAsync(Guid projectId, string query, CancellationToken ct);
}

public interface ISearchIndexer  // used by repo decorators
{
    Task IndexAsync(SearchKind kind, Guid projectId, Guid entityId, CancellationToken ct);
    Task RemoveAsync(SearchKind kind, Guid entityId, CancellationToken ct);
    Task ReindexProjectAsync(Guid projectId, CancellationToken ct);
}
```

### Lucene index structure

One physical Lucene directory at `{ContentRoot}/searchindex/` (path configurable via `Search:IndexPath` in `appsettings.json`).

Single index, single document schema (typed via `kind` field):

| Field          | Type                | Indexed | Stored | Notes                                            |
|----------------|---------------------|---------|--------|--------------------------------------------------|
| `id`           | `StringField`       | yes     | yes    | `{kind}:{entityId}` — unique key for upserts.    |
| `kind`         | `StringField`       | yes     | yes    | `Agent` / `TestSuite` / `AgentCall` / `Evaluator`|
| `entityId`     | `StringField`       | yes     | yes    | Guid string.                                     |
| `projectId`    | `StringField`       | yes     | yes    | Filter clause (TermQuery).                       |
| `createdAt`    | `Int64Field`        | yes     | yes    | DateTimeOffset ticks — for retention pruning.    |
| `title`        | `TextField`         | yes     | yes    | Display text (`Agent.Name`, suite name, etc.).   |
| `body`         | `TextField`         | yes     | no     | Concatenated searchable text (boost 1.0).        |
| `boostedBody`  | `TextField`         | yes     | no     | Title + tool names (boost 2.0) for relevance.    |
| `metadata`     | `StoredField` (JSON)| no      | yes    | Extra display data (e.g. `agentId` on a trace).  |

Analyzer: `StandardAnalyzer` (Lucene 4.8). Lowercase, tokenize, basic stopword removal. Sufficient for English technical text. Customisable later.

### Document mappers (`Trsr.Application/Search/Internal/Mappers/`)

One mapper per entity kind, all extracting the relevant text. Mappers depend on the domain repositories, **not** on storage entities:

- `AgentDocumentMapper` — `Name`, `SystemPrompt.Name`, `SystemPrompt.Template`, each `Tools[].Name`, `Tools[].Description`. Tool names go into `boostedBody`.
- `TestSuiteDocumentMapper` — suite `Name`, plus every `TestCase.Input.Messages[].Contents[].Text` and `ExpectedOutput.Contents[].Text`. **One Lucene doc per TestSuite** (test cases are not separately addressable in the UI). Suite name → `boostedBody`. Snippet on hit shows the matching message text.
- `AgentCallDocumentMapper` — `Request.Messages[].Contents[].Text`, `Response.Response.Contents[].Text`, `ErrorMessage`. Title = `"Trace {shortId} · {agentName} · {timestamp}"`. Stores `agentId` in metadata.
- `EvaluatorDocumentMapper` — only kicks in for `Custom` evaluators (preset agentic ones use repository-loaded prompts and have no per-instance text). Indexes `SystemPrompt.Name` + `SystemPrompt.Template`. `Name` → `boostedBody`.

### Repository decorators

For each indexed entity kind, decorate `IRepository<T>` with `IndexingRepositoryDecorator<T>` registered in the search sub-module via Autofac decoration. After a successful `AddAsync` / `UpdateAsync`, call `_indexer.IndexAsync(...)`. After `RemoveAsync`, call `_indexer.RemoveAsync(...)`. The indexer call awaits the Lucene write so the index is consistent on a successful HTTP response. Failures in the indexer **log + swallow** (do not bubble); a follow-up reindex closes the drift gap.

`AgentCall` writes are very hot (every proxy call). Decorator must be fast. The Lucene `IndexWriter` is a singleton; commits batch via Lucene's NRT (near-real-time) reader. We commit on every write but use a `SearcherManager` for read-side reuse.

### Retention pruner

Hosted service `TraceIndexPrunerService` runs every 6 hours, deletes Lucene docs where `kind = AgentCall AND createdAt < now - 30 days`. Window configurable via `Search:TraceRetentionDays`. The DB row is **not** deleted — only the search-index entry. (Trace deletion remains a separate concern.)

### Query pipeline

`LuceneSearchService.SearchAsync(projectId, query, ct)`:

1. Parse `query` with `MultiFieldQueryParser` over `["title", "body", "boostedBody"]`. Default operator AND. Allow `*` wildcard suffix. Allow `"phrases"`.
2. Wrap in `BooleanQuery`: `+parsedQuery +TermQuery(projectId)`.
3. Run a single `IndexSearcher.Search` for `top = 4 * 5 = 20` results, then **partition by `kind`** and take **5 per kind** (sorted by score), preserving global order within each group.
4. For each hit, generate a highlighted snippet using Lucene's `UnifiedHighlighter` over the `body` field (snippet length ~160 chars, `<mark>` tags).
5. Build `SearchHit` records and return `SearchResults`.

Limit constants live in `SearchConstants` (`HitsPerKind = 5`, `SnippetMaxChars = 160`).

### Reindex endpoint

`POST /api/projects/{projectId}/search/reindex` — calls `ISearchIndexer.ReindexProjectAsync`:

1. Delete all docs where `projectId = X`.
2. Stream all `Agent`, `TestSuite`, `AgentCall` (filtered by retention window), and `Custom` `Evaluator` for the project from their repositories.
3. Re-emit docs in batches of 500 via the writer.
4. Commit + return `{ indexed: <count> }`.

Idempotent. Authenticated. No automatic invocation — operator-triggered.

## API

### Endpoint

`GET /api/projects/{projectId}/search?q=<query>` → `SearchResults`

Returns:

```json
{
  "hits": [
    {
      "kind": "Agent",
      "entityId": "…",
      "title": "Customer support v2",
      "snippet": "You are a <mark>helpful</mark> assistant…",
      "score": 4.21,
      "metadata": {}
    },
    {
      "kind": "AgentCall",
      "entityId": "…",
      "title": "Trace a1b2 · Customer support v2 · 2026-05-09 14:02",
      "snippet": "user: how do I reset my <mark>password</mark>",
      "score": 3.10,
      "metadata": { "agentId": "…" }
    }
  ]
}
```

`q` is required, min length 2, max length 200. Empty / whitespace returns 400. Invalid Lucene syntax (unbalanced quotes etc.) is silently sanitized — escape special chars and retry once before erroring.

### DTO + controller

`SearchController.cs` in `Trsr.Api/Controllers/`. Calls `ISearchService`, maps `SearchHit` → `SearchHitDto` (frontend-friendly: lowercase enum string, ISO timestamps in metadata).

## Frontend

### Files

- `frontend/src/api/search.ts` — `searchApi.search(projectId, q)` returning `SearchResponse`.
- `frontend/src/components/search/SearchPalette.tsx` — Cmd+K modal palette, the main UI.
- `frontend/src/components/search/SearchResultGroup.tsx` — one section per kind.
- `frontend/src/hooks/useGlobalShortcut.ts` — generic Cmd+K / Ctrl+K hook (will be reused later).
- `frontend/src/lib/search-routes.ts` — pure mapper `(kind, entityId, metadata) → href`.

### UX

- Cmd+K (Ctrl+K on non-Mac) opens the palette modal centered. Esc closes (Modal already supports this).
- Input autofocused. Debounce 200ms. Min 2 chars to fire request.
- TanStack Query: `useQuery({ queryKey: ['search', projectId, q], staleTime: 30s })`.
- Results grouped by kind in fixed order: **Agents → Test Suites → Traces → Evaluators**. Each group capped at 5.
- Each hit row: kind icon + title + snippet (renders `<mark>` from server). Up/Down arrows navigate; Enter follows link.
- Empty state: "No matches for `<q>`". Loading: spinner under input.

### Routing

`SearchHit` → href:

| Kind        | Route                                              |
|-------------|----------------------------------------------------|
| `Agent`     | `/agents/{entityId}`                               |
| `TestSuite` | `/suites/{entityId}`                               |
| `AgentCall` | `/traces/{entityId}` (drawer-opens on traces page) |
| `Evaluator` | `/evaluators/{entityId}`                           |

Detail routes for Agent / TestSuite / Evaluator do not yet exist. **Out of scope here** — the `:id` routes are stubbed to redirect to the list page with a query param the list reads to open its detail drawer. Not pretty but matches existing list-with-drawer pattern. Filed as TODO comment in `App.tsx`.

### Existing search bar

`Shell.tsx:125` — replace placeholder div with a button that opens `SearchPalette`. Also wire `useGlobalShortcut` at `Shell` level so Cmd+K opens it from anywhere in the app.

## Data flow summary

```
Write path:
  Repository.AddAsync(entity)
    → DB commit
    → IndexingRepositoryDecorator.IndexAsync(kind, projectId, entity.Id)
    → DocumentMapper builds Lucene doc from domain entity
    → LuceneIndexWriter.UpdateDocument("id", doc)
    → writer commits

Read path:
  GET /api/projects/{p}/search?q=foo
    → SearchController → ISearchService.SearchAsync(p, "foo")
    → LuceneSearchService parses query + projectId filter
    → IndexSearcher.Search top 20
    → partition by kind, take 5/kind
    → highlight bodies
    → return SearchResults

Pruner path:
  Every 6h: TraceIndexPrunerService
    → DeleteDocuments(kind=AgentCall AND createdAt<now-30d)
    → commit
```

## Configuration (`appsettings.json`)

```json
"Search": {
  "IndexPath": "searchindex",
  "TraceRetentionDays": 30,
  "PrunerIntervalHours": 6,
  "HitsPerKind": 5,
  "SnippetMaxChars": 160
}
```

## Testing

- **`Trsr.Search.Tests`** — new project. Inherits `BaseTest<Module>`. Uses an in-memory `RAMDirectory` Lucene index per test (no disk).
- Unit: each `DocumentMapper` correctly extracts and concatenates text from a generated entity (use existing `IDomainEntityGenerator`s).
- Integration: round-trip — generate Agent + AgentCall, index, query, assert hit / score / snippet.
- Edge cases: empty query (400), special chars (`a/b/c`, `"unbalanced`), wildcard suffix (`auth*`), retention pruner deletes traces past window.
- Cross-kind: ensure 5/kind cap enforced even when one kind dominates the top-20.
- Frontend (Vitest): `SearchPalette` keyboard nav, debouncing, group rendering. Use MSW or fetch stub.

## Risks & mitigations

| Risk                                                         | Mitigation                                                            |
|--------------------------------------------------------------|------------------------------------------------------------------------|
| Index drifts from DB on crash mid-write.                     | Reindex endpoint; document the operator runbook.                       |
| `AgentCall` write throughput slowed by inline indexing.      | Lucene NRT writer is fast (sub-ms per doc on local). Benchmark in tests; if too slow, add bounded `Channel<>` buffer in `LuceneIndexWriter` (still in-process, but decouples HTTP path). |
| Large `Conversation` JSON blobs blow up memory at index time.| Mappers stream `Contents[].Text`, never serialize full conversation back. |
| Lucene index file lock issues on Windows dev box.            | Use `NIOFSDirectory`; ensure single `IndexWriter` singleton.           |
| Reindex on a giant project blocks the API.                   | Endpoint runs synchronously for v1; if slow, switch to background job + status endpoint later. |

## Out of scope (deferred)

- Fuzzy / typo tolerance (would add `~` syntax and edit-distance queries).
- Synonym dictionary.
- Per-user search history / recent searches.
- Cross-project search.
- Real-time index push to open search modals.
- Detail routes (`/agents/:id`, `/suites/:id`, `/evaluators/:id`) — search links use list+drawer fallback.
- Vector / semantic search.

## File-level change list

**New:**

- `Trsr.Application/Search/SearchModule.cs` (Autofac sub-module loaded by `Trsr.Application.Module`)
- `Trsr.Application/Search/Internal/LuceneSearchService.cs`
- `Trsr.Application/Search/Internal/LuceneIndexWriter.cs` (singleton wrapper around Lucene `IndexWriter` + `SearcherManager`)
- `Trsr.Application/Search/Internal/IndexingRepositoryDecorator.cs`
- `Trsr.Application/Search/Internal/Mappers/AgentDocumentMapper.cs`
- `Trsr.Application/Search/Internal/Mappers/TestSuiteDocumentMapper.cs`
- `Trsr.Application/Search/Internal/Mappers/AgentCallDocumentMapper.cs`
- `Trsr.Application/Search/Internal/Mappers/EvaluatorDocumentMapper.cs`
- `Trsr.Application/Search/Internal/TraceIndexPrunerService.cs`
- `Trsr.Application/Search/Internal/SearchConstants.cs`
- `Trsr.Application/Search/Internal/SearchConfiguration.cs`
- `Trsr.Domain/Search/ISearchService.cs`
- `Trsr.Domain/Search/ISearchIndexer.cs`
- `Trsr.Domain/Search/SearchHit.cs`
- `Trsr.Domain/Search/SearchKind.cs`
- `Trsr.Domain/Search/SearchResults.cs`
- `Trsr.Api/Controllers/SearchController.cs`
- `Trsr.Api/Dtos/SearchHitDto.cs`
- `Trsr.Application.Tests/Search/` (mapper + service tests inside existing test project)
- `frontend/src/api/search.ts`
- `frontend/src/components/search/SearchPalette.tsx`
- `frontend/src/components/search/SearchResultGroup.tsx`
- `frontend/src/components/search/SearchResultRow.tsx`
- `frontend/src/hooks/useGlobalShortcut.ts`
- `frontend/src/lib/search-routes.ts`

**Modified:**

- `Trsr.Application/Trsr.Application.csproj` — add Lucene.NET package reference.
- `Trsr.Application/Module.cs` — load `SearchModule` sub-module.
- `Trsr.Api/appsettings.json` — `Search` section.
- `frontend/src/components/layout/Shell.tsx` — replace dummy bar, mount palette, wire shortcut.
- `frontend/src/api/query-keys.ts` — add `search` factory entry.
