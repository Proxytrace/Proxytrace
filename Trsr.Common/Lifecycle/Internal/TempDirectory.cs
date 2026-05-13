namespace Trsr.Common.Lifecycle.Internal;

internal class TempDirectory : ITempDirectory
{
    public string Path { get; }

    public TempDirectory(string? parentDirectory = null)
    {
        parentDirectory ??= System.IO.Path.GetTempPath();
        Path = System.IO.Path.Combine(parentDirectory, System.IO.Path.GetRandomFileName());
        Directory.CreateDirectory(Path);
    }
    
    public void Dispose()
    {
        try
        {
            Directory.Delete(Path, recursive: true);
        }
        catch
        {
            // ignored
        }
    }
}