namespace Proxytrace.Domain.Paging;

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Total,
    int Page,
    int PageSize)
{
    public PagedResult<TOut> Map<TOut>(Func<T, TOut> selector)
        => new(Items.Select(selector).ToArray(), Total, Page, PageSize);
}
