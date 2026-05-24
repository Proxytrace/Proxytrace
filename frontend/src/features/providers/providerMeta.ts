import { ModelProviderKind } from '../../api/models';

export const PROVIDER_KIND_OPTIONS: { value: ModelProviderKind; label: string }[] = [
  { value: ModelProviderKind.Anthropic, label: 'Anthropic' },
  { value: ModelProviderKind.OpenAi, label: 'OpenAI' },
  { value: ModelProviderKind.OpenAiCompatible, label: 'OpenAI-compatible' },
];

export function kindLabel(k: ModelProviderKind): string {
  return PROVIDER_KIND_OPTIONS.find(o => o.value === k)?.label ?? 'Unknown';
}

export function kindColor(k: ModelProviderKind): string {
  if (k === ModelProviderKind.Anthropic) return 'var(--warn)';
  if (k === ModelProviderKind.OpenAi) return 'var(--success)';
  if (k === ModelProviderKind.OpenAiCompatible) return 'var(--teal)';
  return 'var(--text-muted)';
}

export function maskKey(k: string): string {
  return k.length <= 8 ? '••••••••' : k.slice(0, 7) + '••••••••••••' + k.slice(-4);
}
