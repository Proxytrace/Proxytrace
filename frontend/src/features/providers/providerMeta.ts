import { ModelProviderKind } from '../../api/models';

export const PROVIDER_KIND_OPTIONS: { value: ModelProviderKind; label: string }[] = [
  { value: ModelProviderKind.OpenAi, label: 'OpenAI' },
  { value: ModelProviderKind.OpenAiCompatible, label: 'OpenAI-compatible' },
];

export function kindLabel(k: ModelProviderKind): string {
  return PROVIDER_KIND_OPTIONS.find(o => o.value === k)?.label ?? 'Unknown';
}

export function kindColor(k: ModelProviderKind): string {
  if (k === ModelProviderKind.OpenAi) return 'var(--success)';
  if (k === ModelProviderKind.OpenAiCompatible) return 'var(--teal)';
  return 'var(--text-muted)';
}

export function maskKey(k: string): string {
  return k.length <= 8 ? '••••••••' : k.slice(0, 7) + '••••••••••••' + k.slice(-4);
}

const DEFAULT_ENDPOINT: Partial<Record<ModelProviderKind, string>> = {
  [ModelProviderKind.OpenAi]: 'https://api.openai.com/v1',
};

function normalizeUrl(u: string): string {
  return u.trim().replace(/\/+$/, '').toLowerCase();
}

/** True when the endpoint equals the canonical default for its kind (so it can be hidden). */
export function isDefaultEndpoint(kind: ModelProviderKind, endpoint: string): boolean {
  const def = DEFAULT_ENDPOINT[kind];
  return def != null && normalizeUrl(def) === normalizeUrl(endpoint);
}

/** True when the endpoint host indicates an Azure OpenAI resource. */
export function isAzureEndpoint(endpoint: string): boolean {
  try {
    return new URL(endpoint).host.toLowerCase().includes('azure.com');
  } catch {
    return endpoint.toLowerCase().includes('azure.com');
  }
}
