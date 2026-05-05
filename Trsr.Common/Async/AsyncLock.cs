namespace Trsr.Common.Async;

/// <summary>
/// Keyed async lock. Unlike <c>lock</c>/<see cref="Monitor"/>, safe to hold across <c>await</c> boundaries.
/// </summary>
internal sealed class AsyncLock : IAsyncLock
{
    private readonly Dictionary<object, (SemaphoreSlim Semaphore, int Count)> locks = new();
    private readonly Lock sync = new();

    /// <summary>Synchronously acquires the lock for <paramref name="key"/>. Dispose the returned handle to release it.</summary>
    public IDisposable Lock(object key)
    {
        var semaphore = Acquire(key);
        semaphore.Wait();
        return new Releaser(this, key, semaphore);
    }

    /// <summary>Asynchronously acquires the lock for <paramref name="key"/>. Dispose the returned handle to release it.</summary>
    public async Task<IDisposable> LockAsync(object key, CancellationToken cancellationToken = default)
    {
        var semaphore = Acquire(key);
        await semaphore.WaitAsync(cancellationToken);
        return new Releaser(this, key, semaphore);
    }

    private SemaphoreSlim Acquire(object key)
    {
        lock (sync)
        {
            if (locks.TryGetValue(key, out var entry))
                locks[key] = (entry.Semaphore, entry.Count + 1);
            else
                locks[key] = (new SemaphoreSlim(1, 1), 1);

            return locks[key].Semaphore;
        }
    }

    private void Release(object key, SemaphoreSlim semaphore)
    {
        lock (sync)
        {
            var (_, count) = locks[key];
            if (count == 1)
                locks.Remove(key);
            else
                locks[key] = (semaphore, count - 1);
        }
        semaphore.Release();
    }

    private sealed class Releaser : IDisposable
    {
        private readonly AsyncLock parent;
        private readonly object key;
        private readonly SemaphoreSlim semaphore;
        private bool disposed;

        public Releaser(AsyncLock parent, object key, SemaphoreSlim semaphore)
        {
            this.parent = parent;
            this.key = key;
            this.semaphore = semaphore;
        }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            parent.Release(key, semaphore);
        }
    }
}
