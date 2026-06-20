import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { ModelProviderKind } from '../../api/models';
import type { LicenseDto, LicenseFeature } from '../../api/license';
import { FEATURE_LABELS } from '../../components/license/licenseUtils';
import { fmtTokens } from '../../lib/format';

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

/* ── Welcome-step tier summary ─────────────────────────────────────────── */

const ALL_FEATURES = Object.keys(FEATURE_LABELS) as LicenseFeature[];

export interface TierSummary {
  isFree: boolean;
  tierLabel: MessageDescriptor;
  /** What this installation includes, shown with a check. */
  included: MessageDescriptor[];
  /** Enterprise features this installation does not have (Free only). */
  locked: MessageDescriptor[];
}

/** One Free-tier limit line per resource, pluralized by the granted count (0/undefined = unlimited). */
function projectsLimitLine(n: number | undefined): MessageDescriptor {
  if (n === undefined || n <= 0) return msg`Unlimited projects`;
  if (n === 1) return msg`1 project`;
  return msg`${n} projects`;
}

function agentsLimitLine(n: number | undefined): MessageDescriptor {
  if (n === undefined || n <= 0) return msg`Unlimited agents`;
  if (n === 1) return msg`1 agent`;
  return msg`${n} agents`;
}

function testSuitesLimitLine(n: number | undefined): MessageDescriptor {
  if (n === undefined || n <= 0) return msg`Unlimited test suites`;
  if (n === 1) return msg`1 test suite`;
  return msg`${n} test suites`;
}

/** Builds the Welcome-step feature summary from the license snapshot. */
export function buildTierSummary(license: LicenseDto | undefined): TierSummary {
  const isFree = license?.tier !== 'enterprise';
  const limits = license?.limits ?? {};

  const included: MessageDescriptor[] = [
    msg`Full trace capture through the OpenAI-compatible proxy`,
    msg`Dashboard, agents, test suites & evaluators`,
  ];

  if (isFree) {
    included.push(
      projectsLimitLine(limits.MaxProjects ?? 1),
      agentsLimitLine(limits.MaxAgents ?? 1),
      testSuitesLimitLine(limits.MaxTestSuites ?? 1),
      msg`${fmtTokens(limits.MaxTracesPerMonth ?? 10_000)} traces per month, kept ${limits.TraceRetentionDays ?? 14} days`,
    );
  } else {
    included.push(
      msg`Unlimited projects, agents & test suites`,
      ...(license?.features ?? []).map(f => FEATURE_LABELS[f]),
      msg`${limits.TraceRetentionDays ?? 365}-day trace retention`,
    );
  }

  const granted = new Set(license?.features ?? []);
  const locked = isFree ? ALL_FEATURES.filter(f => !granted.has(f)).map(f => FEATURE_LABELS[f]) : [];

  return {
    isFree,
    tierLabel: isFree ? msg`Free` : msg`Enterprise`,
    included,
    locked,
  };
}

export const UPGRADE_URL = 'https://proxytrace.dev';
