using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Search;
using Trsr.Domain.Search;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId:guid}/search")]
public class SearchController : ControllerBase
{
    private const int MinQueryLength = 2;
    private const int MaxQueryLength = 200;

    private readonly ISearchService searchService;
    private readonly ISearchIndexer indexer;

    public SearchController(ISearchService searchService, ISearchIndexer indexer)
    {
        this.searchService = searchService;
        this.indexer = indexer;
    }

    [HttpGet]
    public async Task<ActionResult<SearchResultsDto>> Search(
        Guid projectId,
        [FromQuery] string q,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < MinQueryLength)
        {
            return BadRequest(new { error = $"q must be at least {MinQueryLength} chars" });
        }
        if (q.Length > MaxQueryLength)
        {
            return BadRequest(new { error = $"q must be at most {MaxQueryLength} chars" });
        }

        var results = await searchService.SearchAsync(projectId, q.Trim(), cancellationToken);
        var dto = new SearchResultsDto(
            results.Hits.Select(h => new SearchHitDto(
                Kind: KindToWire(h.Kind),
                EntityId: h.EntityId,
                Title: h.Title,
                Snippet: h.Snippet,
                Score: h.Score,
                Metadata: h.Metadata)).ToList());
        return Ok(dto);
    }

    [HttpPost("reindex")]
    public async Task<ActionResult<object>> Reindex(Guid projectId, CancellationToken cancellationToken)
    {
        await indexer.ReindexProjectAsync(projectId, cancellationToken);
        return Ok(new { reindexed = projectId });
    }

    private static string KindToWire(SearchKind kind) => kind switch
    {
        SearchKind.Agent => "agent",
        SearchKind.TestSuite => "testSuite",
        SearchKind.AgentCall => "agentCall",
        SearchKind.Evaluator => "evaluator",
        _ => kind.ToString().ToLowerInvariant(),
    };
}
