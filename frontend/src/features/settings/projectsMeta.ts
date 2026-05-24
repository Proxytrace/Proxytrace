/** Two-letter initials from a name or email: first+last word, or first two chars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PROJECT_PALETTE = [
  'var(--accent-primary)', 'var(--success)', 'var(--teal)',
  'var(--teal)', 'var(--warn)', 'var(--accent-hover)',
];

/** Stable token color for a project/member avatar, hashed from its id. */
export function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PROJECT_PALETTE[Math.abs(hash) % PROJECT_PALETTE.length];
}

/** "Provider · Model" for an endpoint id, or the raw id when not found. */
export function endpointLabel(
  endpoints: { id: string; providerName: string; modelName: string }[],
  endpointId: string,
): string {
  const ep = endpoints.find(e => e.id === endpointId);
  return ep ? `${ep.providerName} · ${ep.modelName}` : endpointId;
}
