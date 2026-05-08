export function JsonView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span style={{ color: '#a1a1aa' }}>null</span>;
  if (typeof value === 'boolean') return <span style={{ color: '#f472b6' }}>{String(value)}</span>;
  if (typeof value === 'number') return <span style={{ color: '#fbbf24' }}>{value}</span>;
  if (typeof value === 'string') return <span style={{ color: '#86efac' }}>"{value}"</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: '#71717a' }}>[]</span>;
    return (
      <span>
        <span style={{ color: '#71717a' }}>[</span>
        {value.map((v, i) => (
          <div key={i} style={{ paddingLeft: 14 }}>
            <JsonView value={v} depth={depth + 1} />
            {i < value.length - 1 && <span style={{ color: '#71717a' }}>,</span>}
          </div>
        ))}
        <span style={{ color: '#71717a' }}>]</span>
      </span>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span style={{ color: '#71717a' }}>{'{}'}</span>;
  return (
    <span>
      <span style={{ color: '#71717a' }}>{'{'}</span>
      {entries.map(([k, v], i) => (
        <div key={k} style={{ paddingLeft: 14 }}>
          <span style={{ color: '#93c5fd' }}>"{k}"</span>
          <span style={{ color: '#71717a' }}>: </span>
          <JsonView value={v} depth={depth + 1} />
          {i < entries.length - 1 && <span style={{ color: '#71717a' }}>,</span>}
        </div>
      ))}
      <span style={{ color: '#71717a' }}>{'}'}</span>
    </span>
  );
}
