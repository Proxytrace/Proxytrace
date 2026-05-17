import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRightIcon,
  BeakerIcon,
  CheckboxIcon,
  ChevronRightIcon,
  CopyIcon,
  CpuIcon,
  ExternalLinkIcon,
  ZapIcon,
} from '../../components/icons';
import { Card } from '../../components/ui/Card';
import { proposalsApi } from '../../api/proposals';
import type {
  ModelSwitchDetailsDto,
  OptimizationProposalDto,
  SystemPromptDetailsDto,
  ToolDetailsDto,
  ToolSpecDto,
} from '../../api/models';
import { ProposalKind, ProposalStatus, TestRunStatus } from '../../api/models';
import { agentColor, modelColor } from '../../lib/colors';
import { fmtRelative } from '../../lib/format';
import { AbTestHero } from './AbTestHero';
import {
  KIND_META,
  PRIORITY_META,
  TONE_COLOR,
  TONE_SUBTLE,
  deltaTone,
  displayStatus,
  formatCostDelta,
  formatLatencyDelta,
  isTerminal,
  titleFromRationale,
} from './shared';

interface Props {
  dto: OptimizationProposalDto;
}

const KIND_ICON: Record<ProposalKind, React.ReactNode> = {
  [ProposalKind.SystemPrompt]: <BeakerIcon size={12}/>,
  [ProposalKind.Tool]:         <ZapIcon size={12}/>,
  [ProposalKind.ModelSwitch]:  <CpuIcon size={12}/>,
};

const KIND_HERO_ICON: Record<ProposalKind, React.ReactNode> = {
  [ProposalKind.SystemPrompt]: <BeakerIcon size={20}/>,
  [ProposalKind.Tool]:         <ZapIcon size={20}/>,
  [ProposalKind.ModelSwitch]:  <CpuIcon size={20}/>,
};

export function ProposalDetail({ dto }: Props) {
  const queryClient = useQueryClient();
  const kind = KIND_META[dto.kind];
  const status = displayStatus(dto);
  const aColor = agentColor(dto.agentId);
  const prio = PRIORITY_META[dto.priority];
  const terminal = isTerminal(dto);
  const ab = dto.abTestRun;
  const isAbRunning = ab?.status === TestRunStatus.Running || ab?.status === TestRunStatus.Pending;
  const abReady = ab?.status === TestRunStatus.Completed;

  const updateStatus = useMutation({
    mutationFn: (next: ProposalStatus) => proposalsApi.updateStatus(dto.id, next),
    onSuccess: () => queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === 'proposals' }),
  });

  const titleLine = titleFromRationale(dto.rationale);
  const restOfRationale = dto.rationale.length > titleLine.length
    ? dto.rationale.slice(titleLine.length).replace(/^[.!?\s]+/, '')
    : '';

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
    <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4 [&>*]:shrink-0" style={{ scrollbarGutter: 'stable' }}>
      {/* Header */}
      <div className="flex items-start gap-3.5">
        <div
          className="size-11 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${kind.color} 20%, transparent), color-mix(in srgb, ${kind.color} 7%, transparent))`,
            border: `1px solid color-mix(in srgb, ${kind.color} 27%, transparent)`,
            color: kind.color,
            boxShadow: `0 0 24px color-mix(in srgb, ${kind.color} 13%, transparent)`,
          }}
        >
          {KIND_HERO_ICON[dto.kind]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="mono text-body-sm text-muted">{dto.id.slice(0, 8)}</span>
            <span
              className="inline-flex items-center gap-1 rounded-sm px-2 py-[2px] text-caption font-semibold border"
              style={{
                background: `color-mix(in srgb, ${kind.color} 9%, transparent)`,
                color: kind.color,
                borderColor: `color-mix(in srgb, ${kind.color} 20%, transparent)`,
              }}
            >
              {KIND_ICON[dto.kind]} {kind.label}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-caption font-semibold"
              style={{ background: TONE_SUBTLE[status.tone], color: TONE_COLOR[status.tone] }}
            >
              <span
                className={`inline-block size-1.5 rounded-full ${status.pulse ? 'pulse-dot' : ''}`}
                style={{ background: TONE_COLOR[status.tone] }}
              />
              {status.label}
            </span>
            <span className="text-body-sm text-muted">· {fmtRelative(dto.createdAt)}</span>
          </div>
          <h2 className="text-h1 font-bold text-primary leading-tight m-0 mb-1.5 tracking-[-0.01em]">
            {titleLine}
          </h2>
          <div className="flex items-center gap-2 flex-wrap text-body-sm">
            <span
              className="inline-flex items-center rounded-full px-2 py-[2px] font-medium mono"
              style={{
                background: `color-mix(in srgb, ${aColor} 14%, transparent)`,
                color: aColor,
              }}
            >
              {dto.agentName}
            </span>
            <span
              className="inline-flex items-center gap-1 font-medium"
              style={{ color: prio.color }}
            >
              <span className="inline-block size-1.5 rounded-full" style={{ background: prio.color }}/>
              {prio.label} priority
            </span>
            {dto.evidenceTestRunIds.length > 0 && (
              <span className="text-muted">· {dto.evidenceTestRunIds.length} evidence run{dto.evidenceTestRunIds.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>

      {/* Summary blockquote */}
      {restOfRationale && (
        <p
          className="text-body text-secondary leading-relaxed m-0 px-3.5 py-3 rounded-md whitespace-pre-wrap"
          style={{
            background: `color-mix(in srgb, ${kind.color} 4%, transparent)`,
            borderLeft: `2px solid color-mix(in srgb, ${kind.color} 40%, transparent)`,
          }}
        >
          {restOfRationale}
        </p>
      )}

      {/* Predicted impact band */}
      <PredictedImpactBand dto={dto}/>

      {/* A/B in-progress / result */}
      {ab && (isAbRunning || abReady) && (
        <AbTestHero ab={ab} expectedPassRateDelta={dto.expectedPassRateDelta}/>
      )}

      {/* Diff panels */}
      {dto.details.kind === 'SystemPrompt' && <SystemPromptSection details={dto.details}/>}
      {dto.details.kind === 'ModelSwitch'  && <ModelSwitchSection  details={dto.details}/>}
      {dto.details.kind === 'Tool'         && <ToolUpdateSection   details={dto.details}/>}

      {/* Evidence list */}
      {dto.evidenceTestRunIds.length > 0 && (
        <EvidenceList ids={dto.evidenceTestRunIds}/>
      )}

      {/* Terminal note */}
      {dto.status === ProposalStatus.Accepted && (
        <div
          className="px-3.5 py-3 rounded-md flex items-center gap-2.5 border"
          style={{
            background: 'var(--success-subtle)',
            borderColor: 'color-mix(in srgb, var(--success) 20%, transparent)',
          }}
        >
          <div
            className="size-7 rounded-md flex items-center justify-center shrink-0 text-success"
            style={{ background: 'color-mix(in srgb, var(--success) 20%, transparent)' }}
          >
            <CheckboxIcon size={14}/>
          </div>
          <div>
            <div className="text-title font-semibold text-success">Promoted · {fmtRelative(dto.updatedAt)}</div>
            <div className="text-body-sm text-secondary mt-0.5">This change is now live for the {dto.agentName} agent.</div>
          </div>
        </div>
      )}
      {dto.status === ProposalStatus.Rejected && (
        <div className="px-3.5 py-3 rounded-md flex items-center gap-2.5 bg-card-2/40">
          <div className="size-7 rounded-md flex items-center justify-center shrink-0 text-muted font-bold text-h2 bg-card-2">
            ×
          </div>
          <div>
            <div className="text-title font-semibold text-muted">Dismissed · {fmtRelative(dto.updatedAt)}</div>
            <div className="text-body-sm text-secondary mt-0.5">This proposal will not be applied.</div>
          </div>
        </div>
      )}

      </div>
      {/* Action bar */}
      {!terminal && (
        <div
          className="flex gap-2 justify-end flex-wrap pt-3 mt-2 border-t border-hairline bg-surface"
        >
          <button
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate(ProposalStatus.Rejected)}
            className="px-3.5 py-2 rounded-md text-body-sm font-medium text-muted bg-card-2 shadow-[var(--shadow-pill)] hover:text-secondary transition-colors disabled:opacity-50"
            data-write
          >
            Dismiss
          </button>
          <button
            className="px-4 py-2 rounded-md text-body-sm font-medium text-secondary bg-card shadow-[var(--shadow-pill)] inline-flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <CopyIcon size={12}/> Edit & re-run
          </button>
          {!ab && (
            <button
              className="px-4 py-2 rounded-md text-body-sm font-semibold bg-card inline-flex items-center gap-1.5 border transition-colors"
              style={{
                color: 'var(--teal)',
                borderColor: 'color-mix(in srgb, var(--teal) 25%, transparent)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset, 0 4px 14px -8px color-mix(in srgb, var(--teal) 40%, transparent)',
              }}
            >
              <BeakerIcon size={12}/> Run A/B test
            </button>
          )}
          <button
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate(ProposalStatus.Accepted)}
            className="px-4 py-2 rounded-md text-body-sm font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{
              background: abReady ? 'var(--grad-success)' : 'var(--grad-accent)',
              boxShadow: abReady ? 'var(--shadow-btn-success)' : 'var(--shadow-btn)',
            }}
            data-write
          >
            <ArrowUpRightIcon size={12}/> {abReady ? 'Promote' : 'Apply now'}
          </button>
        </div>
      )}
    </div>
  );
}

function PredictedImpactBand({ dto }: { dto: OptimizationProposalDto }) {
  const passDeltaTone = deltaTone(dto.expectedPassRateDelta, false);
  const fmtPct = (v: number | null) => v == null ? '—' : `${Math.round(v * 100)}%`;
  const deltaPts = dto.expectedPassRateDelta == null ? null : Math.round(dto.expectedPassRateDelta * 100);

  const ms = dto.details.kind === 'ModelSwitch' ? dto.details : null;

  return (
    <Card elevation="raised" padding="md">
      <div className="text-caption text-muted font-semibold uppercase tracking-[0.07em] mb-2.5">
        Predicted impact
      </div>
      <div className={`grid gap-2.5 ${ms ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {/* Pass rate cell — current → proposed */}
        <div className="bg-card-2 rounded-md px-3 py-2.5">
          <div className="text-caption text-muted font-semibold uppercase tracking-[0.07em] mb-1">
            Pass rate
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="mono font-bold tracking-[-0.02em] leading-none text-muted" style={{ fontSize: 16 }}>
              {fmtPct(dto.currentPassRate)}
            </span>
            <span className="text-body-sm text-muted">→</span>
            <span
              className="mono font-bold tracking-[-0.02em] leading-none"
              style={{ color: TONE_COLOR[passDeltaTone], fontSize: 22 }}
            >
              {fmtPct(dto.proposedPassRate)}
            </span>
            {deltaPts != null && deltaPts !== 0 && (
              <span
                className="mono text-body-sm font-semibold"
                style={{ color: TONE_COLOR[passDeltaTone] }}
              >
                {deltaPts > 0 ? '+' : '−'}{Math.abs(deltaPts)}pt
              </span>
            )}
          </div>
        </div>

        {ms && (
          <>
            <DeltaBigCell label="Cost / 1k"   value={formatCostDelta(ms.expectedCostDelta)}     tone={deltaTone(ms.expectedCostDelta, true)}/>
            <DeltaBigCell label="Latency p50" value={formatLatencyDelta(ms.expectedLatencyMs)} tone={deltaTone(ms.expectedLatencyMs, true)}/>
          </>
        )}
      </div>
    </Card>
  );
}

function DeltaBigCell({ label, value, tone }: { label: string; value: string; tone: ReturnType<typeof deltaTone> }) {
  return (
    <div className="bg-card-2 rounded-md px-3 py-2.5">
      <div className="text-caption text-muted font-semibold uppercase tracking-[0.07em] mb-1">{label}</div>
      <div
        className="mono font-bold tracking-[-0.02em] leading-none"
        style={{ color: TONE_COLOR[tone], fontSize: 22 }}
      >
        {value}
      </div>
    </div>
  );
}

function SystemPromptSection({ details }: { details: SystemPromptDetailsDto }) {
  return <PromptDiff before={details.currentSystemMessage} after={details.proposedSystemMessage}/>;
}

function PromptDiff({ before, after }: { before: string; after: string }) {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);

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
      if (ai < afterLines.length) ai++;
    }
  }

  const adds = rendered.filter(r => r.kind === 'add').length;
  const dels = rendered.filter(r => r.kind === 'del').length;

  return (
    <div className="bg-[rgba(0,0,0,0.4)] rounded-md overflow-hidden border border-border-subtle">
      <div className="flex items-center gap-2.5 px-3.5 py-2 border-b border-hairline bg-card-2/30">
        <span className="text-caption text-muted font-semibold uppercase tracking-[0.07em]">System prompt</span>
        <span className="mono text-body-sm text-success">+{adds}</span>
        <span className="mono text-body-sm text-danger">−{dels}</span>
      </div>
      <div className="mono text-body leading-[1.65]">
        {rendered.map((r, i) => {
          const color = r.kind === 'add'
            ? 'var(--success)'
            : r.kind === 'del'
            ? 'var(--danger)'
            : 'var(--text-secondary)';
          const bg = r.kind === 'add'
            ? 'color-mix(in srgb, var(--success) 8%, transparent)'
            : r.kind === 'del'
            ? 'color-mix(in srgb, var(--danger) 8%, transparent)'
            : 'transparent';
          const sigil = r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' ';
          const sigilColor = r.kind === 'add' ? 'var(--success)' : r.kind === 'del' ? 'var(--danger)' : 'var(--text-muted)';
          return (
            <div key={i} className="flex" style={{ background: bg, padding: '1px 0' }}>
              <span className="text-caption text-right select-none shrink-0 text-muted opacity-50 w-9 pl-3.5 pr-2">{i + 1}</span>
              <span className="font-bold shrink-0 text-center w-[18px]" style={{ color: sigilColor }}>{sigil}</span>
              <span className="flex-1 whitespace-pre-wrap break-words pr-3.5" style={{ color }}>{r.text || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModelSwitchSection({ details }: { details: ModelSwitchDetailsDto }) {
  const fromColor = modelColor(details.currentModelName);
  const toColor = modelColor(details.proposedModelName);

  return (
    <div className="bg-[rgba(0,0,0,0.4)] rounded-md overflow-hidden border border-border-subtle">
      <div className="px-3.5 py-2 border-b border-hairline bg-card-2/30">
        <span className="text-caption text-muted font-semibold uppercase tracking-[0.07em]">Model change</span>
      </div>
      <div className="flex items-center gap-3.5 justify-center px-3.5 py-4">
        <ModelBox label="From" name={details.currentModelName} color={fromColor} tint="color-mix(in srgb, var(--danger) 6%, transparent)"/>
        <span className="text-h2 text-muted">→</span>
        <ModelBox label="To" name={details.proposedModelName} color={toColor} tint="color-mix(in srgb, var(--success) 6%, transparent)"/>
      </div>
    </div>
  );
}

function ModelBox({ label, name, color, tint }: { label: string; name: string; color: string; tint: string }) {
  return (
    <div
      className="rounded-md text-center min-w-[160px] px-4 py-2.5"
      style={{ background: tint }}
    >
      <div
        className="text-caption font-semibold uppercase tracking-[0.07em] mb-1"
        style={{ color: label === 'To' ? 'var(--success)' : 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div className="mono text-h2 font-bold" style={{ color }}>{name}</div>
    </div>
  );
}

function ToolUpdateSection({ details }: { details: ToolDetailsDto }) {
  const currentNames = new Set(details.currentTools.map(t => t.name));
  const proposedNames = new Set(details.proposedTools.map(t => t.name));
  const added    = details.proposedTools.filter(t => !currentNames.has(t.name));
  const removed  = details.currentTools.filter(t => !proposedNames.has(t.name));

  return (
    <div className="bg-[rgba(0,0,0,0.4)] rounded-md overflow-hidden border border-border-subtle">
      <div className="px-3.5 py-2 border-b border-hairline bg-card-2/30">
        <span className="text-caption text-muted font-semibold uppercase tracking-[0.07em]">Tool definition diff</span>
      </div>
      {added.map(t => <ToolRow key={`a-${t.name}`} kind="add" tool={t}/>)}
      {removed.map(t => <ToolRow key={`r-${t.name}`} kind="del" tool={t}/>)}
      {added.length === 0 && removed.length === 0 && (
        <div className="px-3.5 py-3 text-body text-muted">No tool additions or removals.</div>
      )}
    </div>
  );
}

function ToolRow({ kind, tool }: { kind: 'add' | 'del'; tool: ToolSpecDto }) {
  const isAdd = kind === 'add';
  const color = isAdd ? 'var(--success)' : 'var(--danger)';
  const bg = isAdd ? 'color-mix(in srgb, var(--success) 6%, transparent)' : 'color-mix(in srgb, var(--danger) 6%, transparent)';
  const label = isAdd ? '+ added' : '− removed';
  const nameColor = isAdd ? 'var(--success)' : 'var(--danger)';
  return (
    <div
      className="px-3.5 py-3"
      style={{ background: bg, borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="mono text-body-sm font-bold" style={{ color }}>{label}</span>
        <span className="mono text-title font-bold" style={{ color: nameColor }}>{tool.name}</span>
      </div>
      <div className="text-body text-secondary leading-snug pl-2">{tool.description}</div>
    </div>
  );
}

function EvidenceList({ ids }: { ids: string[] }) {
  return (
    <Card elevation="raised" padding="none" className="overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-hairline">
        <span className="text-title font-semibold">Evidence</span>
        <span className="text-body-sm text-muted">· {ids.length} failing run{ids.length !== 1 ? 's' : ''} motivated this</span>
      </div>
      {ids.map((id, i) => (
        <Link
          key={id}
          to={`/runs?run=${id}`}
          className="grid w-full items-center gap-2.5 px-3.5 py-2.5 hover:bg-card-2/40 transition-colors"
          style={{ gridTemplateColumns: '8px 1fr auto auto', borderTop: i === 0 ? 'none' : '1px solid var(--hairline)' }}
        >
          <span className="size-1.5 rounded-full bg-warn"/>
          <div className="min-w-0">
            <div className="text-title font-medium mb-0.5 text-primary">Test run {id.slice(0, 8)}</div>
            <div className="text-body-sm text-muted">Captured failing trace cluster</div>
          </div>
          <span className="mono text-caption text-muted">{id.slice(0, 8)}</span>
          <span className="text-muted inline-flex items-center gap-1 text-caption">
            <ExternalLinkIcon size={11}/>
            <ChevronRightIcon size={12}/>
          </span>
        </Link>
      ))}
    </Card>
  );
}
