import { ModelProviderKind } from '../../api/models';
import type { LicenseDto, LicenseFeature } from '../../api/license';
import { FEATURE_LABELS } from '../../components/license/licenseUtils';
import { fmtTokens } from '../../lib/format';

/* ── Provider presets ─────────────────────────────────────────────────── */

export type ProviderPresetId = 'openai' | 'azure-foundry' | 'anthropic' | 'xai' | 'custom';

export interface ProviderPreset {
  id: ProviderPresetId;
  label: string;
  kind: ModelProviderKind;
  /** Prefilled endpoint; empty when the user must complete it. */
  endpoint: string;
  endpointPlaceholder: string;
  defaultName: string;
  keyPlaceholder: string;
  hint: string;
}

/**
 * Proxytrace speaks the OpenAI protocol. Every preset points at an
 * OpenAI-compatible endpoint — the non-OpenAI ones just save people the
 * lookup for where their vendor hosts it.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: ModelProviderKind.OpenAi,
    endpoint: 'https://api.openai.com/v1',
    endpointPlaceholder: 'https://api.openai.com/v1',
    defaultName: 'OpenAI',
    keyPlaceholder: 'sk-…',
    hint: 'The native OpenAI API — works out of the box.',
  },
  {
    id: 'azure-foundry',
    label: 'Azure AI Foundry',
    kind: ModelProviderKind.OpenAiCompatible,
    endpoint: '',
    endpointPlaceholder: 'https://<resource>.openai.azure.com/openai/v1',
    defaultName: 'Azure AI Foundry',
    keyPlaceholder: 'API key from the Foundry portal',
    hint: 'Use your resource’s OpenAI-compatible v1 endpoint. Model discovery lists the models you have deployed.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: ModelProviderKind.OpenAiCompatible,
    endpoint: 'https://api.anthropic.com/v1',
    endpointPlaceholder: 'https://api.anthropic.com/v1',
    defaultName: 'Anthropic',
    keyPlaceholder: 'sk-ant-…',
    hint: 'Anthropic’s OpenAI-compatible endpoint — use your regular Anthropic API key.',
  },
  {
    id: 'xai',
    label: 'xAI',
    kind: ModelProviderKind.OpenAiCompatible,
    endpoint: 'https://api.x.ai/v1',
    endpointPlaceholder: 'https://api.x.ai/v1',
    defaultName: 'xAI',
    keyPlaceholder: 'xai-…',
    hint: 'Grok models via xAI’s OpenAI-compatible API.',
  },
  {
    id: 'custom',
    label: 'Custom',
    kind: ModelProviderKind.OpenAiCompatible,
    endpoint: '',
    endpointPlaceholder: 'https://llm.example.com/v1',
    defaultName: 'My provider',
    keyPlaceholder: 'Upstream API key',
    hint: 'Any OpenAI-compatible server: vLLM, Ollama, LiteLLM, OpenRouter, a gateway, …',
  },
];

export function presetById(id: ProviderPresetId): ProviderPreset {
  const preset = PROVIDER_PRESETS.find(p => p.id === id);
  if (!preset) throw new Error(`Unknown provider preset: ${id}`);
  return preset;
}

/* ── Step headings (index 0 = Welcome renders its own hero) ───────────── */

export const STEP_HEADINGS: ({ title: string; subtitle: string } | null)[] = [
  null,
  {
    title: 'Connect your model provider',
    subtitle: 'Proxytrace speaks the OpenAI protocol — point it at OpenAI or any OpenAI-compatible endpoint.',
  },
  {
    title: 'Pick your default model',
    subtitle: 'Models are discovered from your provider automatically; prices load from the catalogue.',
  },
  {
    title: 'Create your project',
    subtitle: 'Projects group your agents, traces, and benchmarks.',
  },
  {
    title: 'Point your client at Proxytrace',
    subtitle: 'Swap the base URL for your project’s proxy endpoint — your existing provider API key keeps working.',
  },
];

/* ── Welcome-step tier summary ─────────────────────────────────────────── */

const ALL_FEATURES = Object.keys(FEATURE_LABELS) as LicenseFeature[];

export interface TierSummary {
  isFree: boolean;
  tierLabel: string;
  /** What this installation includes, shown with a check. */
  included: string[];
  /** Enterprise features this installation does not have (Free only). */
  locked: string[];
}

/** Builds the Welcome-step feature summary from the license snapshot. */
export function buildTierSummary(license: LicenseDto | undefined): TierSummary {
  const isFree = license?.tier !== 'enterprise';
  const limits = license?.limits ?? {};

  const limitLine = (n: number | undefined, singular: string, plural: string) =>
    n === undefined || n <= 0 ? `Unlimited ${plural}` : n === 1 ? `1 ${singular}` : `${n} ${plural}`;

  const included: string[] = [
    'Full trace capture through the OpenAI-compatible proxy',
    'Dashboard, agents, test suites & evaluators',
  ];

  if (isFree) {
    included.push(
      `${limitLine(limits.MaxProjects ?? 1, 'project', 'projects')} · ${limitLine(limits.MaxAgents ?? 1, 'agent', 'agents')} · ${limitLine(limits.MaxTestSuites ?? 1, 'test suite', 'test suites')}`,
      `${fmtTokens(limits.MaxTracesPerMonth ?? 10_000)} traces per month, kept ${limits.TraceRetentionDays ?? 14} days`,
    );
  } else {
    included.push(
      'Unlimited projects, agents & test suites',
      ...(license?.features ?? []).map(f => FEATURE_LABELS[f]),
      `${limits.TraceRetentionDays ?? 365}-day trace retention`,
    );
  }

  const granted = new Set(license?.features ?? []);
  const locked = isFree ? ALL_FEATURES.filter(f => !granted.has(f)).map(f => FEATURE_LABELS[f]) : [];

  return {
    isFree,
    tierLabel: isFree ? 'Free' : 'Enterprise',
    included,
    locked,
  };
}

export const UPGRADE_URL = 'https://proxytrace.dev';
