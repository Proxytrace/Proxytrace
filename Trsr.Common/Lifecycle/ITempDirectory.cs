namespace Trsr.Common.Lifecycle;

public interface ITempDirectory : IDisposable
{
    delegate ITempDirectory Create(string? parentDirectory = null);
    
    string Path { get; }
}