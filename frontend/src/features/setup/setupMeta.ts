import { ModelProviderKind } from '../../api/models';

export const PROVIDER_ENDPOINTS: Record<ModelProviderKind, string> = {
  [ModelProviderKind.Anthropic]: 'https://api.anthropic.com/v1',
  [ModelProviderKind.OpenAi]: 'https://api.openai.com/v1',
  [ModelProviderKind.OpenAiCompatible]: '',
  [ModelProviderKind.Unknown]: '',
};

export const STEP_HEADINGS = [
  { title: 'Connect a model provider', subtitle: 'Trsr proxies and records every call to this upstream API.' },
  { title: 'Add a model', subtitle: 'Pick which model to route through this provider. Costs are optional.' },
  { title: 'Create your project', subtitle: 'Projects group your agents, traces, and benchmarks.' },
  { title: 'Generate your Trsr API key', subtitle: 'Replace your upstream key with this one in your client.' },
] as const;

export const PROVIDER_KIND_OPTIONS: { kind: ModelProviderKind; label: string }[] = [
  { kind: ModelProviderKind.Anthropic, label: 'Anthropic' },
  { kind: ModelProviderKind.OpenAi, label: 'OpenAI' },
  { kind: ModelProviderKind.OpenAiCompatible, label: 'OpenAI compatible' },
];
