namespace Proxytrace.Domain.Paging;

public static class Paging
{
    private const int MaxPageSize = 100;

    public static (int Page, int PageSize) Clamp(int page, int pageSize)
        => (Math.Max(1, page), Math.Clamp(pageSize, 1, MaxPageSize));
}
