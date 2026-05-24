import { useState } from 'react';
import { cn } from '../../lib/cn';
import { SparklesIcon } from '../../components/icons';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import type { OptimizationProposalDto } from '../../api/models';
import { ProposalKind, ProposalStatus, TestRunStatus } from '../../api/models';
import { ProposalCard } from './ProposalCard';
import { ProposalDetail } from './ProposalDetail';
import { useProposals } from './hooks/useProposals';
import { KIND_META } from './shared';

type StatusFilter = 'open' | 'all' | 'new' | 'ab_running' | 'ready' | 'promoted' | 'dismissed';
type KindFilter = 'all' | ProposalKind;

type KpiTone = 'accent' | 'success';

// Semantic tone → Tailwind text-class. Each maps byte-identically to the
// token the KPI value previously set via `style={{ color: 'var(--…)' }}`.
const KPI_TONE_TEXT: Record<KpiTone, string> = {
  accent: 'text-accent-hover', // was var(--accent-hover)
  success: 'text-success',     // was var(--success)
};

// Per-kind filter button classes. Replaces threading `KIND_META[t.key].color`
// (a finite ProposalKind set) through `style={{}}`. Values are byte-identical:
// active bg = color-mix(kind 14%), text = kind color, ring = inset 1px kind 26%,
// dot = kind color. accent-primary=#c9944a, success=#3daa6f, teal=#6b9eaa.
const KIND_FILTER_ACTIVE: Record<ProposalKind, string> = {
  [ProposalKind.SystemPrompt]: cn(
    'bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-accent',
    'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent-primary)_26%,transparent)]',
  ),
  [ProposalKind.Tool]: cn(
    'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success',
    'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--success)_26%,transparent)]',
  ),
  [ProposalKind.ModelSwitch]: cn(
    'bg-[color-mix(in_srgb,var(--teal)_14%,transparent)] text-teal',
    'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--teal)_26%,transparent)]',
  ),
};

const KIND_FILTER_DOT: Record<ProposalKind, string> = {
  [ProposalKind.SystemPrompt]: 'bg-accent',
  [ProposalKind.Tool]: 'bg-success',
  [ProposalKind.ModelSwitch]: 'bg-teal',
};

export default function Proposals() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [kindFilter, setKindFilter]     = useState<KindFilter>('all');
  const [selectedId, setSelectedId]     = useState<string | null>(null);

  const { proposals, isLoading } = useProposals();

  const isAbRunning = (p: OptimizationProposalDto) =>
    p.abTestRun?.status === TestRunStatus.Running || p.abTestRun?.status === TestRunStatus.Pending;
  const isReady = (p: OptimizationProposalDto) =>
    p.status === ProposalStatus.Draft && p.abTestRun?.status === TestRunStatus.Completed;
  const isNew = (p: OptimizationProposalDto) =>
    p.status === ProposalStatus.Draft && !p.abTestRun;

  const counts = {
    open:       proposals.filter(p => p.status === ProposalStatus.Draft).length,
    new:        proposals.filter(isNew).length,
    ab_running: proposals.filter(isAbRunning).length,
    ready:      proposals.filter(isReady).length,
    promoted:   proposals.filter(p => p.status === ProposalStatus.Accepted).length,
    dismissed:  proposals.filter(p => p.status === ProposalStatus.Rejected).length,
    all:        proposals.length,
  };

  const filtered = proposals.filter(p => {
    switch (statusFilter) {
      case 'open':       if (p.status !== ProposalStatus.Draft) return false; break;
      case 'new':        if (!isNew(p)) return false; break;
      case 'ab_running': if (!isAbRunning(p)) return false; break;
      case 'ready':      if (!isReady(p)) return false; break;
      case 'promoted':   if (p.status !== ProposalStatus.Accepted) return false; break;
      case 'dismissed':  if (p.status !== ProposalStatus.Rejected) return false; break;
      case 'all':        break;
    }
    if (kindFilter !== 'all' && p.kind !== kindFilter) return false;
    return true;
  });

  const explicitSelected = selectedId ? filtered.find(p => p.id === selectedId) ?? null : null;
  const selected = explicitSelected ?? filtered[0] ?? null;
  const effectiveSelectedId = selected?.id ?? null;

  // :noExpectedPassRateDelta
  // expectedPassRateDelta doesn't seem to exist on ModelSwitchDetailsDto
  // const potentialGainPt = useMemo(() =>
  //   proposals
  //     .filter(p => p.status === ProposalStatus.Draft && p.details.kind === 'ModelSwitch')
  //     .reduce((sum, p) => {
  //       const d = p.details.kind === 'ModelSwitch' ? p.details.expectedPassRateDelta : null;
  //       return sum + Math.max(0, Math.round((d ?? 0) * 100));
  //     }, 0),
  //   [proposals]);

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'open',       label: 'Open',          count: counts.open },
    { key: 'new',        label: 'New',           count: counts.new },
    { key: 'ab_running', label: 'A/B running',   count: counts.ab_running },
    { key: 'ready',      label: 'Ready',         count: counts.ready },
    { key: 'promoted',   label: 'Promoted',      count: counts.promoted },
    { key: 'dismissed',  label: 'Dismissed',     count: counts.dismissed },
    { key: 'all',        label: 'All',           count: counts.all },
  ];

  const kindTabs: { key: KindFilter; label: string }[] = [
    { key: 'all',                     label: 'All types' },
    { key: ProposalKind.SystemPrompt, label: 'Prompt' },
    { key: ProposalKind.Tool,         label: 'Tool' },
    { key: ProposalKind.ModelSwitch,  label: 'Model' },
  ];

  const kpis: { label: string; value: string; tone: KpiTone }[] = [
    { label: 'Open',                     value: String(counts.open),  tone: 'accent' },
    { label: 'Ready to promote', value: String(counts.ready), tone: 'success' },
    // :noExpectedPassRateDelta
    // { label: 'Potential pass-rate gain', value: `+${potentialGainPt}pt`, tone: 'teal' },
  ];

  return (
    <div className="flex flex-col gap-3.5 flex-1 min-h-0 w-full">
      {/* Header */}
      <div className="fade-up flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-h1 font-bold tracking-[-0.02em] m-0">Optimization Proposals</h1>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-body-sm font-semibold text-accent-hover bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_20%,transparent),color-mix(in_srgb,var(--teal)_12%,transparent))]"
            >
              <SparklesIcon size={11}/> Auto-generated
            </span>
          </div>
          <p className="text-body-sm text-muted m-0">
            Data-driven prompt, tool, and model improvements derived from failing test cases and production traces.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          {kpis.map(k => (
            <div
              key={k.label}
              className="bg-card rounded-lg shadow-[var(--shadow-card)] text-center min-w-[90px] px-4 py-2.5"
            >
              <div className={cn('text-h1 font-bold tracking-[-0.02em] mono leading-none', KPI_TONE_TEXT[k.tone])}>
                {k.value}
              </div>
              <div className="text-caption text-muted mt-1">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="fade-up flex gap-2.5 flex-wrap items-center shrink-0 [animation-delay:30ms]">
        <div className="flex flex-row gap-[3px] p-[3px] bg-card rounded-md shadow-[var(--shadow-pill)]">
          {statusTabs.map(t => {
            const active = statusFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 rounded-sm text-body-sm font-medium transition-colors duration-[var(--motion-base)] cursor-pointer',
                  active ? 'bg-card-2 text-primary' : 'text-muted hover:text-secondary',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'mono inline-flex items-center justify-center px-1.5 min-w-[16px] h-[14px] text-caption font-semibold rounded-full',
                    active ? 'bg-accent-subtle text-accent-hover' : 'bg-card-2 text-muted',
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-px h-[22px] bg-hairline"/>

        <div className="flex gap-1">
          {kindTabs.map(t => {
            const active = kindFilter === t.key;
            const meta = t.key === 'all' ? null : KIND_META[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setKindFilter(t.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-body-sm font-medium transition-colors duration-[var(--motion-base)] cursor-pointer',
                  !active && 'bg-transparent text-muted',
                  active && (t.key === 'all'
                    ? 'bg-card-2 text-primary'
                    : KIND_FILTER_ACTIVE[t.key]),
                )}
              >
                {meta && t.key !== 'all' && (
                  <span className={cn('inline-block size-1.5 rounded-[2px]', KIND_FILTER_DOT[t.key])} />
                )}
                {t.label}
              </button>
            );
          })}
        </div>

        <span className="ml-auto text-body-sm text-muted">
          {filtered.length} proposal{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Master-detail */}
      <div className="fade-up flex-1 min-h-[420px] overflow-hidden grid gap-3.5 [animation-delay:60ms] grid-cols-[340px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        {/* Left list */}
        <div className="min-h-0 overflow-y-auto pr-2 pt-1 pb-6">
            <div className="flex flex-col gap-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[124px] rounded-lg"/>
                ))
              ) : filtered.length > 0 ? (
                filtered.map(p => (
                  <ProposalCard
                    key={p.id}
                    dto={p}
                    isActive={effectiveSelectedId === p.id}
                    onClick={() => setSelectedId(p.id)}
                  />
                ))
              ) : (
                <EmptyState
                  title="No proposals match this filter"
                  description="Adjust the filters above or wait for the optimizer to generate new suggestions."
                />
              )}
            </div>
        </div>

        {/* Right detail */}
        <div className="flex flex-col min-h-0 min-w-0">
          {selected
            ? <ProposalDetailWrapper key={selected.id} dto={selected}/>
            : <div className="text-body text-muted text-center p-14">Select a proposal to inspect.</div>
          }
        </div>
      </div>
    </div>
  );
}

function ProposalDetailWrapper({ dto }: { dto: OptimizationProposalDto }) {
  return <ProposalDetail dto={dto}/>;
}
