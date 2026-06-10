import { ModelProviderKind } from '../../api/models';

export const PROVIDER_ENDPOINTS: Record<ModelProviderKind, string> = {
  [ModelProviderKind.OpenAi]: 'https://api.openai.com/v1',
  [ModelProviderKind.OpenAiCompatible]: '',
  [ModelProviderKind.Unknown]: '',
};

export const STEP_HEADINGS = [
  { title: 'Connect a model provider', subtitle: 'Proxytrace proxies and records every call to this upstream API.' },
  { title: 'Add a model', subtitle: 'Pick which model to route through this provider. Costs are optional.' },
  { title: 'Create your project', subtitle: 'Projects group your agents, traces, and benchmarks.' },
  { title: 'Generate your Proxytrace API key', subtitle: 'Replace your upstream key with this one in your client.' },
] as const;

export const PROVIDER_KIND_OPTIONS: { kind: ModelProviderKind; label: string }[] = [
  { kind: ModelProviderKind.OpenAi, label: 'OpenAI' },
  { kind: ModelProviderKind.OpenAiCompatible, label: 'OpenAI compatible' },
];
