import { useMemo } from 'react';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { SparklesIcon } from '../../components/icons';
import { useSelectedId } from '../../hooks/useSelectedId';
import { agentColor } from '../../lib/colors';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterDropdown, type FilterDropdownOption } from '../../components/ui/FilterDropdown';
import { Skeleton } from '../../components/ui/Skeleton';
import { BoardStats } from './components/BoardStats';
import { TheoryCard } from './components/TheoryCard';
import { TheoryColumn } from './components/TheoryColumn';
import { TheoryDrawer } from './TheoryDrawer';
import { useProposals } from './hooks/useProposals';
import { useTheories } from './hooks/useTheories';
import { useSuiteNames } from './hooks/useSuiteNames';
import { useSetProposalStatus } from './hooks/useSetProposalStatus';
import { useResetTheory } from './hooks/useResetTheory';
import { ProposalStatus, TheoryStatus } from '../../api/models';
import { BOARD_COLUMNS, boardStats, groupByColumn } from './theoryBoard';

export default function Proposals() {
  const { t } = useLingui();
  const { theories, isLoading } = useTheories();
  // While any theory is still validating, proposals can appear/change server-side — poll alongside.
  const hasActiveTheories = theories.some(
    t => t.status === TheoryStatus.Proposed || t.status === TheoryStatus.Validating,
  );
  const { proposals } = useProposals(hasActiveTheories);
  const suiteName = useSuiteNames();
  const setStatus = useSetProposalStatus();
  const resetTheory = useResetTheory();

  // The open theory drawer is encoded in ?id= so it survives refresh and links.
  const [selectedId, setSelectedId] = useSelectedId();
  // Agent filter lives in ?agentId= — shareable, survives refresh, and is the deep-link
  // target from agent/theory cards elsewhere in the app.
  // eslint-disable-next-line lingui/no-unlocalized-strings -- query-param key, not UI copy
  const [agentFilter, setAgentFilter] = useSelectedId('agentId');

  const agentOptions = useMemo<FilterDropdownOption[]>(() => {
    const byAgent = new Map<string, { name: string; count: number }>();
    for (const t of theories) {
      const existing = byAgent.get(t.agentId);
      if (existing) existing.count += 1;
      else byAgent.set(t.agentId, { name: t.agentName, count: 1 });
    }
    return [
      { key: '', label: t`All agents (${theories.length})` },
      ...Array.from(byAgent, ([id, { name, count }]) => ({ key: id, label: `${name} (${count})`, accent: agentColor(id) })),
    ];
  }, [theories, t]);

  const visibleTheories = agentFilter ? theories.filter(t => t.agentId === agentFilter) : theories;

  const groups = groupByColumn(visibleTheories);
  const stats = boardStats(visibleTheories);

  const selectedTheory = selectedId ? theories.find(t => t.id === selectedId) ?? null : null;
  const selectedProposal = selectedTheory?.resultingProposalId
    ? proposals.find(p => p.id === selectedTheory.resultingProposalId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-3.5 w-full xl:flex-1 xl:min-h-0">
      {/* Header */}
      <div className="fade-up flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-h1 font-bold tracking-[-0.02em] m-0"><Trans>Optimization Theories</Trans></h1>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-body-sm font-semibold text-accent-hover bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_20%,transparent),color-mix(in_srgb,var(--teal)_12%,transparent))]">
              <SparklesIcon size={11} /> <Trans>Auto-generated</Trans>
            </span>
          </div>
          <p className="text-body-sm text-muted m-0">
            <Trans>Hypotheses spawned from failing test results, moving through validation — from untested to proven.</Trans>
          </p>
        </div>
        <BoardStats stats={stats} />
      </div>

      {/* Agent filter */}
      {theories.length > 0 && (
        <div className="fade-up flex items-center gap-3 shrink-0 [animation-delay:30ms]" data-testid="proposals-agent-filter">
          <FilterDropdown
            label={t`Agent`}
            value={agentFilter ?? ''}
            options={agentOptions}
            onChange={key => setAgentFilter(key || null)}
            active={!!agentFilter}
            accent={agentFilter ? agentColor(agentFilter) : undefined}
            width={240}
          />
          <span className="text-body-sm text-muted">
            <Plural value={visibleTheories.length} one="# theory" other="# theories" />
          </span>
        </div>
      )}

      {/* Board */}
      {!isLoading && theories.length === 0 ? (
        <EmptyState
          title={t`No optimization theories yet`}
          description={t`Theories appear here when an optimizer, you, or Tracey AI proposes a change to validate.`}
        />
      ) : (
        <div
          className="fade-up grid gap-3.5 [animation-delay:40ms] grid-cols-1 md:grid-cols-2 xl:grid-cols-4 xl:flex-1 xl:min-h-0"
          data-testid="theory-board"
        >
          {BOARD_COLUMNS.map(column => {
            const columnTheories = groups[column.status];
            return (
              <TheoryColumn key={column.status} column={column} count={columnTheories.length}>
                {isLoading
                  ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[150px] rounded-lg" />)
                  : columnTheories.length === 0
                    ? <p className="text-caption text-muted px-1 py-2"><Trans>Nothing here yet.</Trans></p>
                    : columnTheories.map(theory => (
                        <TheoryCard
                          key={theory.id}
                          theory={theory}
                          suiteName={suiteName(theory.suiteId)}
                          onOpen={() => setSelectedId(theory.id)}
                          onPromote={() => { if (theory.resultingProposalId) setStatus.mutate({ id: theory.resultingProposalId, status: ProposalStatus.Accepted }); }}
                          isPromoting={setStatus.isPending && setStatus.variables?.id === theory.resultingProposalId && setStatus.variables?.status === ProposalStatus.Accepted}
                        />
                      ))}
              </TheoryColumn>
            );
          })}
        </div>
      )}

      {selectedTheory && (
        <TheoryDrawer
          theory={selectedTheory}
          proposal={selectedProposal}
          suiteName={suiteName(selectedTheory.suiteId)}
          onSetStatus={(status) => { if (selectedProposal) setStatus.mutate({ id: selectedProposal.id, status }); }}
          onReset={() => resetTheory.mutate(selectedTheory.id)}
          actionPending={setStatus.isPending}
          resetPending={resetTheory.isPending}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
