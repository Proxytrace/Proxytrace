using System.Collections.Concurrent;
using Proxytrace.Domain.Search;

namespace Proxytrace.Application.Search.Internal;

internal sealed class ReindexStateTracker : IReindexStateTracker
{
    private readonly ConcurrentDictionary<Guid, byte> active = new();

    public bool IsReindexing(Guid projectId) => active.ContainsKey(projectId);

    public IDisposable BeginReindex(Guid projectId)
    {
        active[projectId] = 0;
        return new Releaser(this, projectId);
    }

    private sealed class Releaser : IDisposable
    {
        private readonly ReindexStateTracker owner;
        private readonly Guid projectId;
        private int disposed;

        public Releaser(ReindexStateTracker owner, Guid projectId)
        {
            this.owner = owner;
            this.projectId = projectId;
        }

        public void Dispose()
        {
            if (Interlocked.Exchange(ref disposed, 1) == 0)
            {
                owner.active.TryRemove(projectId, out _);
            }
        }
    }
}
