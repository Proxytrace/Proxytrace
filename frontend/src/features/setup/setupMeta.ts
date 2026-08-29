import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { ModelProviderKind } from '../../api/models';

/* ── Provider presets ─────────────────────────────────────────────────── */

export type ProviderPresetId = 'openai' | 'azure-foundry' | 'anthropic' | 'xai' | 'custom';

export interface ProviderPreset {
  id: ProviderPresetId;
  label: MessageDescriptor;
  kind: ModelProviderKind;
  /** Prefilled endpoint; empty when the user must complete it. */
  endpoint: string;
  endpointPlaceholder: string;
  defaultName: string;
  keyPlaceholder: string;
  hint: MessageDescriptor;
}

/**
 * Proxytrace speaks the OpenAI protocol. Every preset points at an
 * OpenAI-compatible endpoint — the non-OpenAI ones just save people the
 * lookup for where their vendor hosts it.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: msg`OpenAI`,
    kind: ModelProviderKind.OpenAi,
    endpoint: 'https://api.openai.com/v1',
    endpointPlaceholder: 'https://api.openai.com/v1',
    defaultName: 'OpenAI',
    keyPlaceholder: 'sk-…',
    hint: msg`The native OpenAI API — works out of the box.`,
  },
  {
    id: 'azure-foundry',
    label: msg`Azure AI Foundry`,
    kind: ModelProviderKind.OpenAiCompatible,
    endpoint: '',
    endpointPlaceholder: 'https://<resource>.openai.azure.com/openai/v1',
    defaultName: 'Azure AI Foundry',
    keyPlaceholder: 'API key from the Foundry portal',
    hint: msg`Use your resource’s OpenAI-compatible v1 endpoint. Model discovery lists the models you have deployed.`,
  },
  {
    id: 'anthropic',
    label: msg`Anthropic`,
    kind: ModelProviderKind.OpenAiCompatible,
    endpoint: 'https://api.anthropic.com/v1',
    endpointPlaceholder: 'https://api.anthropic.com/v1',
    defaultName: 'Anthropic',
    keyPlaceholder: 'sk-ant-…',
    hint: msg`Anthropic’s OpenAI-compatible endpoint — use your regular Anthropic API key.`,
  },
  {
    id: 'xai',
    label: msg`xAI`,
    kind: ModelProviderKind.OpenAiCompatible,
    endpoint: 'https://api.x.ai/v1',
    endpointPlaceholder: 'https://api.x.ai/v1',
    defaultName: 'xAI',
    keyPlaceholder: 'xai-…',
    hint: msg`Grok models via xAI’s OpenAI-compatible API.`,
  },
  {
    id: 'custom',
    label: msg`Custom`,
    kind: ModelProviderKind.OpenAiCompatible,
    endpoint: '',
    endpointPlaceholder: 'https://llm.example.com/v1',
    defaultName: 'My provider',
    keyPlaceholder: 'Upstream API key',
    hint: msg`Any OpenAI-compatible server: vLLM, Ollama, LiteLLM, OpenRouter, a gateway, …`,
  },
];

export function presetById(id: ProviderPresetId): ProviderPreset {
  const preset = PROVIDER_PRESETS.find(p => p.id === id);
  if (!preset) throw new Error(`Unknown provider preset: ${id}`);
  return preset;
}

/* ── Step headings (index 0 = Welcome renders its own hero) ───────────── */

export const STEP_HEADINGS: ({ title: MessageDescriptor; subtitle: MessageDescriptor } | null)[] = [
  null,
  {
    title: msg`Connect your model provider`,
    subtitle: msg`Proxytrace speaks the OpenAI protocol — point it at OpenAI or any OpenAI-compatible endpoint.`,
  },
  {
    title: msg`Pick your default model`,
    subtitle: msg`Models are discovered from your provider automatically; prices load from the catalogue.`,
  },
  {
    title: msg`Create your project`,
    subtitle: msg`Projects group your agents, traces, and benchmarks.`,
  },
  {
    title: msg`Point your client at Proxytrace`,
    subtitle: msg`Swap the base URL for your project’s proxy endpoint — your existing provider API key keeps working.`,
  },
];
