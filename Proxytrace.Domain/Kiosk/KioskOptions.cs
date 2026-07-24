namespace Proxytrace.Domain.Kiosk;

public sealed record KioskOptions
{
    public bool Enabled { get; init; }
    public string DemoUserEmail { get; init; } = "demo@proxytrace.dev";
    public string DemoUserName { get; init; } = "Demo Visitor";

    /// <summary>
    /// Fixed plaintext of the ingestion API key seeded for the demo "Showcase Project" when kiosk
    /// mode runs with a live <c>Kiosk:Endpoint</c>. A sample chat client points its OpenAI SDK
    /// <c>baseURL</c> at the kiosk API and authenticates with this key, so every call becomes a live
    /// trace. Seeded only when a live endpoint is configured; the key is stored hashed (verify-only),
    /// exactly like an operator-minted key.
    /// </summary>
    public string DemoApiKey { get; init; } = "pk-kiosk-demo";
}
