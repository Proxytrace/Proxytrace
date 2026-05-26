namespace Proxytrace.Api.Dto;

internal static class Paging
{
    public const int MaxPageSize = 100;
    public const int DefaultPageSize = 50;

    public static (int Page, int PageSize) Clamp(int page, int pageSize)
        => (Math.Max(1, page), Math.Clamp(pageSize, 1, MaxPageSize));
}
