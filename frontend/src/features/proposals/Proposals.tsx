import { useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { ChevronRightIcon } from '../../components/icons';
import { useSelectedId } from '../../hooks/useSelectedId';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { agentColor } from '../../lib/colors';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LIST_RAIL_COLS } from '../../components/ui/ListRail';
import type { FilterDropdownOption } from '../../components/ui/FilterDropdown';
import { DossierPane } from './components/DossierPane';
import { LoopStrip } from './components/LoopStrip';
import { QueueRail } from './components/QueueRail';
import { useProposals } from './hooks/useProposals';
import { useTheories } from './hooks/useTheories';
import { useSuiteNames } from './hooks/useSuiteNames';
import { useSetProposalStatus } from './hooks/useSetProposalStatus';
import { useResetTheory } from './hooks/useResetTheory';
import { useRejectTheory } from './hooks/useRejectTheory';
import { TheoryStatus } from '../../api/models';
import type { QueueGroupKey } from './theoryQueue';
import { groupIntoQueue, indexProposals, loopStats, proposalFor, queueGroupOf } from './theoryQueue';

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
  const rejectTheory = useRejectTheory();

  // The open dossier is encoded in ?id= so it survives refresh and links; the agent filter
  // lives in ?agentId= — the deep-link target from agent/theory cards elsewhere in the app.
  const [selectedId, setSelectedId] = useSelectedId();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- query-param key, not UI copy
  const [agentFilter, setAgentFilter] = useSelectedId('agentId');
  const [historyOpen, setHistoryOpen] = useState(false);
  const isMobile = useIsMobile();

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
  const proposalById = useMemo(() => indexProposals(proposals), [proposals]);
  const groups = groupIntoQueue(visibleTheories, proposalById);
  const stats = loopStats(visibleTheories, proposalById);

  // On mobile the queue and dossier are separate screens: only an explicit selection opens the
  // dossier. Desktop defaults to the first proposal that needs a decision.
  const explicitTheory = selectedId ? theories.find(t => t.id === selectedId) ?? null : null;
  const selectedTheory = explicitTheory ?? (isMobile ? null : groups.decision[0] ?? null);
  const selectedProposal = selectedTheory ? proposalFor(selectedTheory, proposalById) : null;

  // A deep link into a history item must not hide behind the collapsed group.
  const selectedInHistory =
    explicitTheory != null && queueGroupOf(explicitTheory, proposalFor(explicitTheory, proposalById)) === 'history';

  const jumpToGroup = (group: QueueGroupKey) => {
    if (group === 'history') setHistoryOpen(true);
    requestAnimationFrame(() => {
      // eslint-disable-next-line lingui/no-unlocalized-strings -- DOM element id + scroll options, not UI copy
      document.getElementById(`queue-group-${group}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-3.5 min-h-0">
      {/* Title bar: the loop strip is the page's header */}
      <div className="fade-up shrink-0 rounded-lg bg-card px-3 py-2 shadow-[var(--shadow-card)]">
        <LoopStrip stats={stats} onJump={jumpToGroup} />
      </div>

      {!isLoading && theories.length === 0 ? (
        <EmptyState
          title={t`No optimization theories yet`}
          description={t`Theories appear here when an optimizer, you, or Tracey AI proposes a change to validate.`}
        />
      ) : (
        <div
          className={cn(
            'fade-up flex-1 min-h-0 [animation-delay:40ms]',
            isMobile ? 'flex flex-col' : `grid gap-4 ${LIST_RAIL_COLS}`,
          )}
          data-testid="review-desk"
        >
          {(!isMobile || !selectedTheory) && (
            <QueueRail
              groups={groups}
              proposals={proposalById}
              selection={{ id: selectedTheory?.id ?? null, onSelect: setSelectedId }}
              history={{
                open: historyOpen || selectedInHistory,
                onToggle: () => setHistoryOpen(o => !o || selectedInHistory),
                winRate: stats.winRate,
              }}
              filter={{
                value: agentFilter ?? '',
                options: agentOptions,
                accent: agentFilter ? agentColor(agentFilter) : undefined,
                onChange: key => setAgentFilter(key || null),
              }}
              loading={isLoading}
            />
          )}

          {(!isMobile || selectedTheory) && (
            <div className={cn('flex min-h-0 min-w-0 flex-col gap-2', isMobile && 'flex-1')}>
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 self-start"
                  data-testid="proposals-back-to-list"
                  onClick={() => setSelectedId(null)}
                  leftIcon={<ChevronRightIcon size={14} className="rotate-180" />}
                >
                  <Trans>All proposals</Trans>
                </Button>
              )}
              {selectedTheory ? (
                <DossierPane
                  key={selectedTheory.id}
                  theory={selectedTheory}
                  proposal={selectedProposal}
                  suiteName={suiteName(selectedTheory.suiteId)}
                  onSetStatus={status => { if (selectedProposal) setStatus.mutate({ id: selectedProposal.id, status }); }}
                  onReset={() => resetTheory.mutate(selectedTheory.id)}
                  onReject={() => rejectTheory.mutate(selectedTheory.id)}
                  actionPending={setStatus.isPending}
                  resetPending={resetTheory.isPending}
                  rejectPending={rejectTheory.isPending}
                />
              ) : (
                <Card>
                  <div className="py-15 text-center text-body text-muted"><Trans>Select a proposal to review it.</Trans></div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
