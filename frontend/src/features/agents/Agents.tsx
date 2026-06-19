import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { LIST_RAIL_COLS } from '../../components/ui/ListRail';
import { ChevronRightIcon } from '../../components/icons';
import { cn } from '../../lib/cn';
import { useSelectedId } from '../../hooks/useSelectedId';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { AgentList } from './AgentList';
import { AgentDetail } from './AgentDetail';
import { useAgents, useAgentDetail, useDeleteAgent } from './hooks/useAgents';

export default function Agents() {
  const { t } = useLingui();
  // Selection lives in ?id= (survives refresh); ?tool= is a transient deep-link from a trace.
  const [selectedId, setSelectedId] = useSelectedId();
  const [searchParams] = useSearchParams();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- query-string param key
  const highlightTool = searchParams.get('tool');

  const { allAgents, isLoading } = useAgents();

  const [showSystem, setShowSystem] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selectedIsSystem = selectedId
    ? allAgents.some(a => a.id === selectedId && a.isSystemAgent)
    : false;

  const agents = (showSystem || selectedIsSystem) ? allAgents : allAgents.filter(a => !a.isSystemAgent);

  // On mobile the list and detail are separate screens — only an explicit selection opens the
  // detail. Desktop keeps the select-first default.
  const isMobile = useIsMobile();
  const explicitSelectedId = (selectedId && agents.some(a => a.id === selectedId)) ? selectedId : null;
  const effectiveSelectedId = explicitSelectedId ?? (isMobile ? null : agents[0]?.id ?? null);

  const selected = agents.find(a => a.id === effectiveSelectedId) ?? null;
  // The list rows are light; the detail panel needs the full agent (system message, tools, params).
  const { agent: selectedAgent } = useAgentDetail(selected?.id ?? null);

  // eslint-disable-next-line lingui/no-unlocalized-strings -- query-string param key
  const handleSelect = (id: string) => setSelectedId(id, ['tool']);

  const delAgent = useDeleteAgent(id => {
    const remaining = agents.filter(a => a.id !== id);
    setSelectedId(remaining[0]?.id ?? null);
    setDeleteOpen(false);
  });

  const hasSystemAgents = allAgents.some(a => a.isSystemAgent);
  const isEmpty = !isLoading && allAgents.length === 0;

  return (
    <div className="w-full min-w-0 flex flex-col gap-3 h-full overflow-hidden">
      {isEmpty && (
        <div data-testid="agent-empty-state">
          <EmptyState title={t`No agents yet`} description={t`Agents are auto-created when traces are captured.`} />
        </div>
      )}

      {(isLoading || allAgents.length > 0) && (
        <div
          className={cn(
            'fade-up flex-1 min-h-0 [animation-delay:20ms]',
            isMobile ? 'flex flex-col' : `grid gap-4 ${LIST_RAIL_COLS}`,
          )}
        >
          {(!isMobile || !selected) && (
            <AgentList
              agents={agents}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
              isLoading={isLoading}
              showSystem={showSystem}
              onToggleSystem={hasSystemAgents ? () => setShowSystem(v => !v) : undefined}
            />
          )}

          {(!isMobile || selected) && (
          <main className="min-w-0 min-h-0 overflow-y-auto pr-1 pb-6">
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                className="mb-2"
                data-testid="agents-back-to-list"
                // eslint-disable-next-line lingui/no-unlocalized-strings -- query-string param key
                onClick={() => setSelectedId(null, ['tool'])}
                leftIcon={<ChevronRightIcon size={14} className="rotate-180" />}
              >
                <Trans>All agents</Trans>
              </Button>
            )}
            {selected && selectedAgent ? (
              <AgentDetail
                key={selectedAgent.id}
                agent={selectedAgent}
                onDelete={() => setDeleteOpen(true)}
                highlightTool={highlightTool}
              />
            ) : selected ? (
              <div className="text-center py-12 text-body text-muted"><Trans>Loading agent…</Trans></div>
            ) : !isLoading ? (
              <div className="text-center py-12 text-body text-muted"><Trans>Select an agent to view details.</Trans></div>
            ) : null}
          </main>
          )}
        </div>
      )}

      {deleteOpen && selected && (
        <ConfirmDialog
          entityName={selected.name}
          onConfirm={() => delAgent.mutate(selected.id)}
          onCancel={() => setDeleteOpen(false)}
          loading={delAgent.isPending}
        />
      )}
    </div>
  );
}
