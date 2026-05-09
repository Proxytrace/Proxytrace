using Lucene.Net.Store;
using Microsoft.Extensions.Hosting;

namespace Trsr.Application.Search.Internal;

internal interface ILuceneDirectoryFactory
{
    Lucene.Net.Store.Directory Open();
}

internal sealed class LuceneDirectoryFactory : ILuceneDirectoryFactory
{
    private readonly SearchConfiguration configuration;
    private readonly IHostEnvironment? environment;

    public LuceneDirectoryFactory(SearchConfiguration configuration, IHostEnvironment? environment = null)
    {
        this.configuration = configuration;
        this.environment = environment;
    }

    public Lucene.Net.Store.Directory Open()
    {
        // No host environment registered (e.g. unit-test container) → in-memory index.
        // Also explicit ":memory:" opt-in.
        if (environment is null
            || string.Equals(configuration.IndexPath, ":memory:", StringComparison.OrdinalIgnoreCase))
        {
            return new RAMDirectory();
        }

        string path = Path.IsPathRooted(configuration.IndexPath)
            ? configuration.IndexPath
            : Path.Combine(environment.ContentRootPath, configuration.IndexPath);

        System.IO.Directory.CreateDirectory(path);
        return FSDirectory.Open(path);
    }
}
