using System.Runtime.CompilerServices;
using System.Text.Json;

namespace Proxytrace.Api.Json;

/// <summary>
/// Serializes SSE event payloads once per event instance. A broadcaster fans out the same event
/// reference to every subscriber, so without memoization an event is re-serialized once per open
/// stream (N dashboard tabs ⇒ N identical serializations). Keyed on the event reference via a
/// <see cref="ConditionalWeakTable{TKey,TValue}"/>, so the cached payload is collected with the
/// event and no entry outlives the fan-out.
/// </summary>
internal static class SseEventSerializer
{
    private static readonly ConditionalWeakTable<object, string> Cache = new();

    /// <summary>Serializes using the compile-time type <typeparamref name="TEvent"/>.</summary>
    public static string Serialize<TEvent>(TEvent evt) where TEvent : class
        => Cache.GetValue(evt, _ => JsonSerializer.Serialize(evt, ApiJsonOptions.Sse));

    /// <summary>Serializes using the runtime <paramref name="type"/> for polymorphic event hierarchies.</summary>
    public static string Serialize(object evt, Type type)
        => Cache.GetValue(evt, _ => JsonSerializer.Serialize(evt, type, ApiJsonOptions.Sse));
}
