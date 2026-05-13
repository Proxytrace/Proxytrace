namespace Trsr.Application.Demo;

public sealed record KioskOptions
{
    public bool Enabled { get; init; }
    public string DemoUserEmail { get; init; } = "demo@trsr.dev";
    public string DemoUserName { get; init; } = "Demo Visitor";
}
