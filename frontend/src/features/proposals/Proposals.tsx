import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SparklesIcon, BeakerIcon, ZapIcon, CpuIcon, TargetIcon,
  ChevronRightIcon, CheckboxIcon, ArrowUpRightIcon, CopyIcon,
} from '../../components/icons';
import { proposalsApi } from '../../api/proposals';
import { QUERY_KEYS } from '../../api/query-keys';
import { useCurrentProject } from '../../contexts/ProjectContext';
import type { OptimizationProposalDto, ModelSwitchDetailsDto, SystemPromptDetailsDto, ToolDetailsDto } from '../../api/models';
import { ProposalStatus as ApiProposalStatus } from '../../api/models';

// ── Types ────────────────────────────────────────────────────────────────────

type ProposalType = 'prompt' | 'tool' | 'model' | 'param';
type ProposalStatus = 'new' | 'ab_running' | 'ready' | 'promoted' | 'dismissed';

interface ImpactMetrics {
  passDelta: number;
  costDelta: number;
  latencyDelta: number;
}

interface EvidenceItem {
  id: string;
  name: string;
  failure: string;
  severity: 'high' | 'medium' | 'low';
}

interface ToolAddedItem {
  name: string;
  desc: string;
}

interface ToolDiff {
  added: ToolAddedItem[];
  removed: ToolAddedItem[];
  modified: ToolAddedItem[];
}

interface ModelChange {
  from: string;
  to: string;
}

interface ParamChange {
  from: number;
  to: number;
}

interface Proposal {
  id: string;
  type: ProposalType;
  status: ProposalStatus;
  agent: string;
  targetVersion: string;
  proposedVersion: string;
  title: string;
  summary: string;
  source: string;
  createdAt: string;
  promotedAt?: string;
  dismissedAt?: string;
  dismissReason?: string;
  progress?: number;
  impact: ImpactMetrics;
  confidence: number;
  abResult?: { current: number; proposed: number; sampleCases: number; runtime: string };
  diff?: { before: string; after: string } | null;
  toolDiff?: ToolDiff;
  modelChange?: ModelChange;
  paramDiff?: Record<string, ParamChange>;
  evidence: EvidenceItem[];
}

// ── Static metadata ──────────────────────────────────────────────────────────

const PROPOSAL_TYPE_META: Record<ProposalType, { label: string; color: string; icon: React.ReactNode }> = {
  prompt: { label: 'Prompt rewrite',  color: '#c9944a', icon: <BeakerIcon size={10}/> },
  tool:   { label: 'Tool change',     color: '#3daa6f', icon: <ZapIcon size={10}/> },
  model:  { label: 'Model swap',      color: '#6b9eaa', icon: <CpuIcon size={10}/> },
  param:  { label: 'Parameter tune',  color: '#c2836b', icon: <TargetIcon size={10}/> },
};

const PROPOSAL_STATUS_META: Record<ProposalStatus, { label: string; color: string; dot: string }> = {
  new:        { label: 'Pending review',    color: '#deb073', dot: '#c9944a' },
  ab_running: { label: 'A/B running',       color: '#8ec0cc', dot: '#6b9eaa' },
  ready:      { label: 'Ready to promote',  color: '#5cc98a', dot: '#3daa6f' },
  promoted:   { label: 'Promoted',          color: '#94a3b8', dot: '#64748b' },
  dismissed:  { label: 'Dismissed',         color: '#6e6e74', dot: '#5a5a60' },
};

const AGENT_COLORS: Record<string, string> = {
  'Customer Support': '#c9944a',
  'Code Helper':      '#6b9eaa',
  'Ticket Triage':    '#3daa6f',
  'Classifier':       '#c2836b',
};

const MODEL_COLORS: Record<string, string> = {
  'gpt-4o':           '#c9944a',
  'gpt-4o-mini':      '#6b9eaa',
  'gpt-3.5-turbo':    '#c2836b',
  'claude-3.5-sonnet':'#3daa6f',
};

// ── DTO → local Proposal mapping ─────────────────────────────────────────────

function mapKind(dto: OptimizationProposalDto): ProposalType {
  switch (dto.kind) {
    case 'SystemPrompt': return 'prompt';
    case 'Tool':         return 'tool';
    case 'ModelSwitch':  return 'model';
    default:             return 'prompt';
  }
}

function mapStatus(dto: OptimizationProposalDto): ProposalStatus {
  switch (dto.status) {
    case ApiProposalStatus.Accepted: return 'promoted';
    case ApiProposalStatus.Rejected: return 'dismissed';
    default:                         return 'new';
  }
}

function priorityToConfidence(p: string): number {
  switch (p) {
    case 'Critical': return 0.95;
    case 'High':     return 0.80;
    case 'Medium':   return 0.65;
    default:         return 0.50;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function mapImpact(details: OptimizationProposalDto['details']): ImpactMetrics {
  if (details.kind !== 'ModelSwitch') return { passDelta: 0, costDelta: 0, latencyDelta: 0 };
  const ms = details as ModelSwitchDetailsDto;
  return {
    passDelta:    Math.round((ms.expectedPassRateDelta ?? 0) * 100),
    costDelta:    ms.expectedCostDelta != null ? Math.round(ms.expectedCostDelta * 100) : 0,
    latencyDelta: ms.expectedLatencyMs ?? 0,
  };
}

function mapDiff(details: OptimizationProposalDto['details']): Proposal['diff'] {
  if (details.kind !== 'SystemPrompt') return undefined;
  const sp = details as SystemPromptDetailsDto;
  return { before: sp.currentSystemMessage, after: sp.proposedSystemMessage };
}

function mapToolDiff(details: OptimizationProposalDto['details']): ToolDiff | undefined {
  if (details.kind !== 'Tool') return undefined;
  const td = details as ToolDetailsDto;
  const currentNames = new Set(td.currentTools.map(t => t.name));
  const proposedNames = new Set(td.proposedTools.map(t => t.name));
  return {
    added:    td.proposedTools.filter(t => !currentNames.has(t.name)).map(t => ({ name: t.name, desc: t.description })),
    removed:  td.currentTools.filter(t => !proposedNames.has(t.name)).map(t => ({ name: t.name, desc: t.description })),
    modified: td.proposedTools.filter(t => currentNames.has(t.name)).map(t => ({ name: t.name, desc: t.description })),
  };
}

function mapModelChange(details: OptimizationProposalDto['details']): ModelChange | undefined {
  if (details.kind !== 'ModelSwitch') return undefined;
  const ms = details as ModelSwitchDetailsDto;
  return { from: ms.currentModelName, to: ms.proposedModelName };
}

function dtoToProposal(dto: OptimizationProposalDto): Proposal {
  const status = mapStatus(dto);
  return {
    id:              dto.id,
    type:            mapKind(dto),
    status,
    agent:           dto.agentName,
    targetVersion:   'current',
    proposedVersion: 'proposed',
    title:           dto.rationale.split(/[.!?]/)[0]?.trim() ?? dto.rationale,
    summary:         dto.rationale,
    source:          dto.evidenceTestRunIds.length > 0
                       ? `${dto.evidenceTestRunIds.length} evidence test run${dto.evidenceTestRunIds.length !== 1 ? 's' : ''}`
                       : 'Generated by optimizer',
    createdAt:       relativeTime(dto.createdAt),
    promotedAt:      status === 'promoted' ? relativeTime(dto.updatedAt) : undefined,
    dismissedAt:     status === 'dismissed' ? relativeTime(dto.updatedAt) : undefined,
    impact:          mapImpact(dto.details),
    confidence:      priorityToConfidence(dto.priority),
    diff:            mapDiff(dto.details),
    toolDiff:        mapToolDiff(dto.details),
    modelChange:     mapModelChange(dto.details),
    evidence:        dto.evidenceTestRunIds.map((runId, i) => ({
                       id:       runId,
                       name:     `Test run ${i + 1}`,
                       failure:  '',
                       severity: 'medium' as const,
                     })),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentPill({ agent }: { agent: string }) {
  const color = AGENT_COLORS[agent] ?? '#c9944a';
  return (
    <span
      className="inline-flex items-center px-[7px] py-[2px] rounded-full text-[11px] font-medium agent-pill"
      style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}
    >
      {agent}
    </span>
  );
}

type ImpactFormat = 'pt' | '$' | 'ms';

function ImpactPill({ label, delta, format = 'pt' }: { label: string; delta: number; format?: ImpactFormat }) {
  const positive = label === 'cost' || label === 'lat' ? delta < 0 : delta > 0;
  const neutral = delta === 0;
  const color = neutral ? 'var(--text-muted)' : positive ? 'var(--success)' : 'var(--danger)';
  const bg    = neutral ? 'rgba(255,255,255,0.04)' : positive ? 'var(--success-subtle)' : 'var(--danger-subtle)';

  let display: string;
  if (format === 'pt')      display = `${delta > 0 ? '+' : ''}${delta}pt`;
  else if (format === '$')  display = delta === 0 ? '$0' : `${delta > 0 ? '+' : '−'}$${Math.abs(delta) / 100}`;
  else                      display = delta === 0 ? '0ms' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)}ms`;

  const labelText = label === 'pass' ? 'pass' : label === 'cost' ? 'cost' : 'p50';

  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full mono text-[11px] font-semibold"
      style={{ padding: '2px 8px', background: bg, color }}
    >
      <span style={{ opacity: 0.65, fontWeight: 500 }}>{labelText}</span>
      {display}
    </span>
  );
}

function StatusChip({ status }: { status: ProposalStatus }) {
  const m = PROPOSAL_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-[6px] text-[10.5px] font-semibold"
      style={{ padding: '3px 9px', borderRadius: 100, background: `${m.dot}1a`, color: m.color }}
    >
      <span
        className={status === 'ab_running' ? 'pulse-dot' : ''}
        style={{
          width: 6, height: 6, borderRadius: '50%', background: m.dot,
          boxShadow: status === 'ab_running' ? `0 0 0 3px ${m.dot}33` : 'none',
          display: 'inline-block',
        }}
      />
      {m.label}
    </span>
  );
}

function TypeChip({ type, size = 'sm' }: { type: ProposalType; size?: 'sm' | 'lg' }) {
  const m = PROPOSAL_TYPE_META[type];
  const padding  = size === 'lg' ? '4px 10px' : '2px 8px';
  const fontSize = size === 'lg' ? 12 : 10.5;
  const iconSize = size === 'lg' ? 12 : 10;
  return (
    <span
      className="inline-flex items-center gap-[5px] font-semibold"
      style={{ padding, borderRadius: 6, background: `${m.color}18`, color: m.color, fontSize, border: `1px solid ${m.color}33` }}
    >
      {type === 'prompt' && <BeakerIcon size={iconSize}/>}
      {type === 'tool'   && <ZapIcon size={iconSize}/>}
      {type === 'model'  && <CpuIcon size={iconSize}/>}
      {type === 'param'  && <TargetIcon size={iconSize}/>}
      {m.label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? 'var(--success)' : value >= 0.6 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 100 }}/>
      </div>
      <span className="mono text-[11px] font-bold w-8 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

function PromptDiff({ before, after }: { before: string; after: string }) {
  const beforeLines = before.split('\n');
  const afterLines  = after.split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet  = new Set(afterLines);
  const rendered: { kind: 'same' | 'add' | 'del'; text: string }[] = [];

  let bi = 0, ai = 0;
  while (bi < beforeLines.length || ai < afterLines.length) {
    const b = beforeLines[bi];
    const a = afterLines[ai];
    if (bi < beforeLines.length && ai < afterLines.length && b === a) {
      rendered.push({ kind: 'same', text: a });
      bi++; ai++;
    } else if (ai < afterLines.length && !beforeSet.has(a)) {
      rendered.push({ kind: 'add', text: a });
      ai++;
    } else if (bi < beforeLines.length && !afterSet.has(b)) {
      rendered.push({ kind: 'del', text: b });
      bi++;
    } else {
      if (bi < beforeLines.length) { rendered.push({ kind: 'same', text: b }); bi++; }
      if (ai < afterLines.length && rendered[rendered.length - 1]?.text !== a) { ai++; }
    }
  }

  const adds = rendered.filter(r => r.kind === 'add').length;
  const dels = rendered.filter(r => r.kind === 'del').length;

  return (
    <div style={{ background: '#0a0a0e', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 0 rgba(255,255,255,0.025) inset', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-[10px]" style={{ padding: '8px 14px', borderBottom: '1px solid var(--hairline)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">System prompt</span>
        <span className="mono text-[11px]" style={{ color: '#5cc98a' }}>+{adds}</span>
        <span className="mono text-[11px]" style={{ color: '#e88a8a' }}>−{dels}</span>
      </div>
      <div className="mono text-[11.5px] leading-[1.65]">
        {rendered.map((r, i) => {
          const bg    = r.kind === 'add' ? 'rgba(61,170,111,0.08)' : r.kind === 'del' ? 'rgba(217,85,85,0.08)' : 'transparent';
          const color = r.kind === 'add' ? '#86efac' : r.kind === 'del' ? '#e88a8a' : 'var(--text-secondary)';
          const sigil = r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' ';
          const sigilColor = r.kind === 'add' ? '#3daa6f' : r.kind === 'del' ? '#d95555' : 'var(--text-muted)';
          return (
            <div key={i} className="flex" style={{ background: bg, padding: '1px 0' }}>
              <span className="text-[10px] text-right select-none shrink-0" style={{ width: 36, paddingLeft: 14, paddingRight: 8, color: 'var(--text-muted)', opacity: 0.5 }}>{i + 1}</span>
              <span className="font-bold shrink-0 text-center" style={{ width: 18, color: sigilColor }}>{sigil}</span>
              <span className="flex-1 whitespace-pre-wrap break-words" style={{ color, paddingRight: 14 }}>{r.text || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ABResultPanel({ ab, agentColor }: { ab: NonNullable<Proposal['abResult']>; agentColor: string }) {
  const winner = ab.proposed > ab.current ? 'proposed' : 'current';
  const delta = ab.proposed - ab.current;

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12.5px] font-semibold">A/B test result</span>
        <span className="text-[11px] text-muted">· {ab.sampleCases} cases · {ab.runtime}</span>
        <span className="ml-auto inline-flex items-center gap-[5px] text-[10.5px] font-bold" style={{ padding: '2px 8px', borderRadius: 100, background: 'var(--success-subtle)', color: 'var(--success)' }}>
          <TargetIcon size={10}/> Proposed wins +{delta}pt
        </span>
      </div>
      <div className="grid grid-cols-2 gap-[10px]">
        {([
          { label: 'Current', val: ab.current, color: 'var(--text-muted)', isWinner: winner === 'current' },
          { label: 'Proposed',                                      val: ab.proposed, color: agentColor,        isWinner: winner === 'proposed' },
        ] as const).map(s => (
          <div key={s.label} style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 8, boxShadow: s.isWinner ? `inset 0 0 0 1.5px ${agentColor}55` : 'none' }}>
            <div className="flex justify-between items-center mb-[6px]">
              <span className="text-[11px] text-muted font-semibold">{s.label}</span>
              {s.isWinner && <TargetIcon size={11}/>}
            </div>
            <div className="flex items-baseline gap-[6px]">
              <span className="mono text-[22px] font-bold" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.val}%</span>
            </div>
            <div className="h-[5px] rounded-full overflow-hidden mt-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', width: `${s.val}%`, background: s.color, borderRadius: 100 }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (!items.length) return null;
  const sevColor: Record<string, string> = { high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--text-muted)' };

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <div className="flex items-center gap-2" style={{ padding: '10px 14px', borderBottom: '1px solid var(--hairline)' }}>
        <span className="text-[12.5px] font-semibold">Evidence</span>
        <span className="text-[11px] text-muted">· {items.length} failing case{items.length !== 1 ? 's' : ''} motivated this</span>
      </div>
      {items.map((e, i) => (
        <button
          key={e.id}
          className="w-full text-left grid items-center transition-colors hover:bg-white/[.02]"
          style={{ gridTemplateColumns: '8px 1fr auto auto', gap: 10, padding: '9px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--hairline)', background: 'transparent' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sevColor[e.severity] }}/>
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium mb-[2px]">{e.name}</div>
            <div className="text-[11px] text-muted">{e.failure}</div>
          </div>
          <span className="mono text-[10.5px] text-muted">{e.id}</span>
          <ChevronRightIcon size={12}/>
        </button>
      ))}
    </div>
  );
}

function ToolDiffPanel({ toolDiff }: { toolDiff: ToolDiff }) {
  return (
    <div style={{ background: '#0a0a0e', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--hairline)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Tool definition diff</span>
      </div>
      {toolDiff.added.map(t => (
        <div key={t.name} style={{ padding: '12px 14px', background: 'rgba(61,170,111,0.06)', borderLeft: '3px solid #3daa6f' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="mono text-[11px] font-bold" style={{ color: '#3daa6f' }}>+ added</span>
            <span className="mono text-[13px] font-bold" style={{ color: '#5cc98a' }}>{t.name}</span>
          </div>
          <div className="text-[12px] leading-[1.55] pl-2 text-secondary">{t.desc}</div>
        </div>
      ))}
      {toolDiff.removed.map(t => (
        <div key={t.name} style={{ padding: '12px 14px', background: 'rgba(217,85,85,0.06)', borderLeft: '3px solid #d95555' }}>
          <span className="mono text-[11px] font-bold" style={{ color: '#d95555' }}>− removed </span>
          <span className="mono text-[13px] font-bold" style={{ color: '#e88a8a' }}>{t.name}</span>
        </div>
      ))}
    </div>
  );
}

function ModelDiffPanel({ change }: { change: ModelChange }) {
  return (
    <div style={{ background: '#0a0a0e', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--hairline)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Model change</span>
      </div>
      <div className="flex items-center gap-[14px] justify-center" style={{ padding: '16px 14px' }}>
        <div style={{ padding: '10px 16px', background: 'rgba(217,85,85,0.06)', borderRadius: 8, textAlign: 'center', minWidth: 160 }}>
          <div className="mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted mb-1">From</div>
          <div className="mono text-[14px] font-bold" style={{ color: MODEL_COLORS[change.from] ?? '#888' }}>{change.from}</div>
        </div>
        <div className="text-[18px] text-muted">→</div>
        <div style={{ padding: '10px 16px', background: 'rgba(61,170,111,0.06)', borderRadius: 8, textAlign: 'center', minWidth: 160 }}>
          <div className="mono text-[10px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: '#5cc98a' }}>To</div>
          <div className="mono text-[14px] font-bold" style={{ color: MODEL_COLORS[change.to] ?? '#888' }}>{change.to}</div>
        </div>
      </div>
    </div>
  );
}

function ParamDiffPanel({ paramDiff }: { paramDiff: Record<string, ParamChange> }) {
  return (
    <div style={{ background: '#0a0a0e', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--hairline)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Parameter changes</span>
      </div>
      {Object.entries(paramDiff).map(([k, v]) => (
        <div key={k} className="grid items-center gap-[10px]" style={{ gridTemplateColumns: '120px 1fr auto 1fr', padding: '12px 14px' }}>
          <span className="mono text-[12.5px] font-semibold" style={{ color: '#93c5fd' }}>{k}</span>
          <span className="mono text-[13px] font-bold text-center" style={{ color: '#e88a8a', padding: '4px 10px', background: 'rgba(217,85,85,0.08)', borderRadius: 6 }}>{v.from}</span>
          <ChevronRightIcon size={14}/>
          <span className="mono text-[13px] font-bold text-center" style={{ color: '#86efac', padding: '4px 10px', background: 'rgba(61,170,111,0.08)', borderRadius: 6 }}>{v.to}</span>
        </div>
      ))}
    </div>
  );
}

function ProposalDetail({ p }: { p: Proposal }) {
  const c  = AGENT_COLORS[p.agent] ?? '#c9944a';
  const tm = PROPOSAL_TYPE_META[p.type];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-[14px]">
        <div
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${tm.color}33, ${tm.color}11)`,
            border: `1px solid ${tm.color}44`,
            color: tm.color,
            boxShadow: `0 0 24px ${tm.color}22`,
          }}
        >
          {p.type === 'prompt' && <BeakerIcon size={20}/>}
          {p.type === 'tool'   && <ZapIcon size={20}/>}
          {p.type === 'model'  && <CpuIcon size={20}/>}
          {p.type === 'param'  && <TargetIcon size={20}/>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-[6px]">
            <span className="mono text-[11.5px] text-muted">{p.id}</span>
            <TypeChip type={p.type}/>
            <StatusChip status={p.status}/>
            <span className="text-[11px] text-muted">· {p.createdAt}</span>
          </div>
          <h2 className="text-[18px] font-bold mb-[6px] leading-[1.3]" style={{ letterSpacing: '-0.01em' }}>{p.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <AgentPill agent={p.agent}/>
            <span className="mono text-[11.5px] text-muted">{p.targetVersion} → {p.proposedVersion}</span>
            <span className="text-[11px] text-muted">· {p.source}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <p
        className="text-[13px] text-secondary leading-[1.6] m-0"
        style={{ padding: '12px 14px', background: `rgba(201,148,74,0.04)`, borderRadius: 10, borderLeft: `2px solid ${tm.color}66` }}
      >
        {p.summary}
      </p>

      {/* Predicted impact */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-[10px]">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-[0.07em]">Predicted impact</span>
          <span className="ml-auto flex items-center gap-2" style={{ width: 160 }}>
            <span className="text-[10.5px] text-muted font-semibold uppercase tracking-[0.07em]">Conf</span>
            <span className="flex-1"><ConfidenceBar value={p.confidence}/></span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-[10px]">
          {([
            { label: 'Pass rate',   delta: p.impact.passDelta,    format: 'pt' as ImpactFormat, key: 'pass' },
            { label: 'Cost / 1k',  delta: p.impact.costDelta,    format: '$'  as ImpactFormat, key: 'cost' },
            { label: 'Latency p50',delta: p.impact.latencyDelta, format: 'ms' as ImpactFormat, key: 'lat' },
          ]).map(s => {
            const positive = s.key === 'cost' || s.key === 'lat' ? s.delta < 0 : s.delta > 0;
            const neutral  = s.delta === 0;
            const color = neutral ? 'var(--text-muted)' : positive ? 'var(--success)' : 'var(--danger)';
            const sign  = s.delta > 0 ? '+' : s.delta < 0 ? '−' : '';
            const abs   = Math.abs(s.delta);
            const display = s.format === 'pt' ? `${sign}${abs}pt` : s.format === '$' ? (abs === 0 ? '$0' : `${sign}$${abs / 100}`) : (abs === 0 ? '0ms' : `${sign}${abs}ms`);
            return (
              <div key={s.label} style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 8 }}>
                <div className="mono text-[10px] text-muted font-semibold uppercase tracking-[0.07em] mb-1">{s.label}</div>
                <div className="mono text-[22px] font-bold" style={{ color, letterSpacing: '-0.02em' }}>{display}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* A/B running progress */}
      {p.status === 'ab_running' && p.progress !== undefined && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="pulse-dot"
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b9eaa', boxShadow: '0 0 0 4px rgba(107,158,170,0.2)', display: 'inline-block' }}
            />
            <span className="text-[12.5px] font-semibold">A/B test in progress</span>
            <span className="ml-auto mono text-[12px] font-bold" style={{ color: '#8ec0cc' }}>{Math.round(p.progress * 100)}%</span>
          </div>
          <div className="h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ height: '100%', width: `${p.progress * 100}%`, background: 'linear-gradient(90deg, #6b9eaa, #c9944a)', borderRadius: 100, transition: 'width 0.5s ease' }}/>
          </div>
        </div>
      )}

      {/* A/B result */}
      {p.abResult && <ABResultPanel ab={p.abResult} agentColor={c}/>}

      {/* Diffs */}
      {p.diff       && <PromptDiff before={p.diff.before} after={p.diff.after}/>}
      {p.toolDiff   && <ToolDiffPanel toolDiff={p.toolDiff}/>}
      {p.modelChange && <ModelDiffPanel change={p.modelChange}/>}
      {p.paramDiff  && <ParamDiffPanel paramDiff={p.paramDiff}/>}

      {/* Evidence */}
      <EvidenceList items={p.evidence}/>

      {/* Terminal notes */}
      {p.status === 'promoted' && (
        <div className="flex items-center gap-[10px]" style={{ padding: '12px 14px', background: 'var(--success-subtle)', borderRadius: 10, border: '1px solid rgba(61,170,111,0.2)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(61,170,111,0.2)', color: 'var(--success)' }}>
            <CheckboxIcon size={14}/>
          </div>
          <div>
            <div className="text-[12.5px] font-semibold" style={{ color: 'var(--success)' }}>Promoted to {p.proposedVersion} · {p.promotedAt}</div>
            <div className="text-[11.5px] text-secondary mt-[1px]">This change is now live for the {p.agent} agent.</div>
          </div>
        </div>
      )}
      {p.status === 'dismissed' && (
        <div className="flex items-center gap-[10px]" style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[14px] font-bold text-muted" style={{ background: 'rgba(255,255,255,0.05)' }}>×</div>
          <div>
            <div className="text-[12.5px] font-semibold text-muted">Dismissed · {p.dismissedAt}</div>
            <div className="text-[11.5px] text-secondary mt-[1px]">{p.dismissReason}</div>
          </div>
        </div>
      )}

    </div>
  );
}

function ProposalCard({ p, isActive, onClick }: { p: Proposal; isActive: boolean; onClick: () => void }) {
  const tm = PROPOSAL_TYPE_META[p.type];
  const isTerminal = p.status === 'promoted' || p.status === 'dismissed';

  return (
    <button
      onClick={onClick}
      className="text-left w-full relative overflow-hidden transition-[box-shadow,opacity]"
      style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        padding: '12px 14px 12px 16px',
        boxShadow: isActive
          ? `0 1px 0 rgba(255,255,255,0.07) inset, 0 0 0 1.5px ${tm.color}66, 0 8px 24px -8px ${tm.color}55`
          : 'var(--shadow-card)',
        opacity: isTerminal ? 0.7 : 1,
      }}
      onMouseEnter={e => { if (!isActive && !isTerminal) (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-float)'; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)'; }}
    >
      {/* Left color bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: tm.color, borderRadius: '12px 0 0 12px', opacity: isTerminal ? 0.4 : 1 }}/>

      <div className="flex items-center gap-[6px] mb-2">
        <TypeChip type={p.type}/>
        <span className="ml-auto"><StatusChip status={p.status}/></span>
      </div>

      <div className="text-[13px] font-semibold leading-[1.35] mb-[6px]" style={{ color: isTerminal ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
        {p.title}
      </div>

      <div className="flex items-center gap-[6px] mb-[10px] flex-wrap">
        <AgentPill agent={p.agent}/>
        <span className="mono text-[10.5px] text-muted">{p.targetVersion}→{p.proposedVersion}</span>
      </div>

      <div className="flex gap-[5px] flex-wrap mb-2">
        <ImpactPill label="pass" delta={p.impact.passDelta} format="pt"/>
        {p.impact.costDelta !== 0 && <ImpactPill label="cost" delta={p.impact.costDelta} format="$"/>}
        {p.impact.latencyDelta !== 0 && <ImpactPill label="lat" delta={p.impact.latencyDelta} format="ms"/>}
      </div>

      <div className="flex items-center justify-between gap-2 text-[10.5px] text-muted">
        <span className="truncate">{p.source}</span>
        <span className="shrink-0">{p.createdAt}</span>
      </div>

      {p.status === 'ab_running' && p.progress !== undefined && (
        <div className="mt-2 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', width: `${p.progress * 100}%`, background: 'linear-gradient(90deg, #6b9eaa, #c9944a)', borderRadius: 100 }}/>
        </div>
      )}
    </button>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

type StatusFilter = 'open' | 'all' | ProposalStatus;
type TypeFilter = 'all' | ProposalType;

export default function Proposals() {
  const queryClient = useQueryClient();
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;
  const [filter, setFilter]         = useState<StatusFilter>('open');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selected, setSelected]     = useState<Proposal | null>(null);

  const { data: dtos = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.proposals(undefined, projectId),
    queryFn: () => proposalsApi.getAll({ projectId }),
    enabled,
  });

  const proposals: Proposal[] = dtos.map(dtoToProposal);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiProposalStatus }) =>
      proposalsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === 'proposals' });
      setSelected(null);
    },
  });

  const filtered = proposals.filter(p => {
    if (filter === 'open' && (p.status === 'promoted' || p.status === 'dismissed')) return false;
    if (filter !== 'open' && filter !== 'all' && p.status !== filter) return false;
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    return true;
  });

  const counts = {
    open:       proposals.filter(p => p.status !== 'promoted' && p.status !== 'dismissed').length,
    new:        proposals.filter(p => p.status === 'new').length,
    ab_running: proposals.filter(p => p.status === 'ab_running').length,
    ready:      proposals.filter(p => p.status === 'ready').length,
    promoted:   proposals.filter(p => p.status === 'promoted').length,
    dismissed:  proposals.filter(p => p.status === 'dismissed').length,
    all:        proposals.length,
  };

  const openProposals = proposals.filter(p => p.status === 'new' || p.status === 'ready' || p.status === 'ab_running');
  const totalPotentialPt = openProposals.reduce((n, p) => n + Math.max(0, p.impact.passDelta), 0);

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'open',       label: 'Open',        count: counts.open },
    { key: 'new',        label: 'New',         count: counts.new },
    { key: 'ab_running', label: 'A/B running', count: counts.ab_running },
    { key: 'ready',      label: 'Ready',       count: counts.ready },
    { key: 'promoted',   label: 'Promoted',    count: counts.promoted },
    { key: 'dismissed',  label: 'Dismissed',   count: counts.dismissed },
    { key: 'all',        label: 'All',         count: counts.all },
  ];

  const typeTabs: { key: TypeFilter; label: string }[] = [
    { key: 'all',    label: 'All types' },
    { key: 'prompt', label: 'Prompt' },
    { key: 'tool',   label: 'Tool' },
    { key: 'model',  label: 'Model' },
    { key: 'param',  label: 'Param' },
  ];

  return (
    <div className="flex flex-col gap-[14px] flex-1 min-h-0 w-full px-4" style={{ maxWidth: 1440, margin: '0 auto' }}>

      {/* Header */}
      <div className="fade-up flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-[10px] mb-[6px]">
            <h1 className="text-[24px] font-bold" style={{ letterSpacing: '-0.02em' }}>Optimization Proposals</h1>
            <span
              className="inline-flex items-center gap-[5px] text-[11px] font-semibold"
              style={{ padding: '3px 9px', background: 'linear-gradient(135deg, rgba(201,148,74,0.2), rgba(107,158,170,0.12))', color: '#e8c99a', borderRadius: 100 }}
            >
              <SparklesIcon size={11}/> Auto-generated
            </span>
          </div>
          <p className="text-[13.5px] text-muted">Data-driven prompt, tool, and model improvements derived from failing test cases and production traces.</p>
        </div>
        <div className="flex gap-[10px] shrink-0">
          {[
            { label: 'Open',                   value: counts.open,            color: '#deb073' },
            { label: 'Ready to promote',        value: counts.ready,           color: 'var(--success)' },
            { label: 'Potential pass-rate gain', value: `+${totalPotentialPt}pt`, color: '#8ec0cc' },
          ].map(k => (
            <div key={k.label} className="text-center" style={{ padding: '10px 16px', minWidth: 90, background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow-card)' }}>
              <div className="mono text-[18px] font-bold" style={{ color: k.color, letterSpacing: '-0.02em' }}>{k.value}</div>
              <div className="text-[10.5px] text-muted mt-[2px]">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="fade-up flex gap-[10px] flex-wrap items-center shrink-0" style={{ animationDelay: '30ms' }}>
        {/* Status tabs */}
        <div className="flex flex-row gap-[3px]" style={{ padding: 3, background: 'var(--bg-card)', borderRadius: 10, boxShadow: 'var(--shadow-pill)' }}>
          {statusTabs.map(t => {
            const isActive = filter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className="inline-flex items-center gap-[6px] whitespace-nowrap"
                style={{
                  padding: '6px 11px',
                  borderRadius: 7,
                  fontSize: 11.5,
                  fontWeight: 500,
                  background: isActive ? 'var(--bg-card-2)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: isActive ? '0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none',
                }}
              >
                {t.label}
                <span
                  className="mono inline-flex items-center justify-center"
                  style={{
                    padding: '0 6px',
                    minWidth: 16,
                    height: 14,
                    fontSize: 9.5,
                    fontWeight: 600,
                    background: isActive ? 'rgba(201,148,74,0.18)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#e8c99a' : 'var(--text-muted)',
                    borderRadius: 100,
                  }}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 22, background: 'var(--hairline)' }}/>

        {/* Type filter */}
        <div className="flex gap-1">
          {typeTabs.map(t => {
            const isActive = typeFilter === t.key;
            const m = t.key !== 'all' ? PROPOSAL_TYPE_META[t.key] : null;
            return (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                className="inline-flex items-center gap-[5px]"
                style={{
                  padding: '5px 10px',
                  borderRadius: 7,
                  fontSize: 11.5,
                  fontWeight: 500,
                  background: isActive ? (m ? `${m.color}18` : 'var(--bg-card-2)') : 'transparent',
                  color: isActive ? (m ? m.color : 'var(--text-primary)') : 'var(--text-muted)',
                  boxShadow: isActive ? `inset 0 0 0 1px ${m ? `${m.color}44` : 'transparent'}` : 'none',
                }}
              >
                {m && <span style={{ width: 6, height: 6, borderRadius: 2, background: m.color, display: 'inline-block' }}/>}
                {t.label}
              </button>
            );
          })}
        </div>

        <span className="ml-auto text-[11.5px] text-muted">{filtered.length} proposal{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Master-detail */}
      <div className="fade-up flex-1 min-h-0 overflow-hidden" style={{ animationDelay: '60ms', display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: 14 }}>
        {/* Left: list — outer fills grid track, inner scroll extends right into gap for shadow room */}
        <div className="relative">
          <div className="absolute overflow-y-auto" style={{ inset: '0 -20px 0 0', paddingRight: 20, paddingTop: 4, paddingBottom: 24 }}>
            <div className="flex flex-col gap-2">
              {isLoading ? (
                <div className="text-center text-muted text-[12.5px]" style={{ padding: '40px 20px', background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow-card)' }}>Loading proposals…</div>
              ) : filtered.length > 0 ? filtered.map(p => (
                <ProposalCard key={p.id} p={p} isActive={selected?.id === p.id} onClick={() => setSelected(p)}/>
              )) : (
                <div className="text-center text-muted text-[12.5px]" style={{ padding: '40px 20px', background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow-card)' }}>No proposals match this filter.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex flex-col min-h-0 min-w-0 overflow-hidden">
          <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 pb-6" style={{ scrollbarGutter: 'stable' }}>
            {selected
              ? <ProposalDetail p={selected}/>
              : <div className="text-center text-muted text-[13px]" style={{ padding: 60 }}>Select a proposal</div>
            }
          </div>
          {selected && selected.status !== 'promoted' && selected.status !== 'dismissed' && (
            <div
              className="flex gap-2 justify-end flex-wrap shrink-0 pt-3 pb-2"
              style={{ borderTop: '1px solid var(--hairline)' }}
            >
              <button
                className="btn-ghost text-[12.5px] font-medium"
                style={{ padding: '9px 14px', borderRadius: 9 }}
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: selected.id, status: ApiProposalStatus.Rejected })}
              >Dismiss</button>
              <button className="btn-ghost text-[12.5px] font-medium inline-flex items-center gap-[6px]" style={{ padding: '9px 16px', borderRadius: 9 }}>
                <CopyIcon size={12}/> Edit &amp; re-run
              </button>
              <button
                className="inline-flex items-center gap-[6px] text-[12.5px] font-semibold text-white"
                disabled={updateStatus.isPending}
                style={{
                  padding: '9px 18px',
                  background: 'linear-gradient(135deg, #3daa6f, #059669)',
                  borderRadius: 9,
                  boxShadow: '0 4px 14px -4px rgba(61,170,111,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
                  opacity: updateStatus.isPending ? 0.6 : 1,
                }}
                onClick={() => updateStatus.mutate({ id: selected.id, status: ApiProposalStatus.Accepted })}
              >
                <ArrowUpRightIcon size={12}/> Apply now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
