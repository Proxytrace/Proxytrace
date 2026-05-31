import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { AgentList } from './AgentList';
import { AgentDetail } from './AgentDetail';
import { useAgents, useDeleteAgent } from './hooks/useAgents';

export default function Agents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselect = searchParams.get('id');
  const highlightTool = searchParams.get('tool');

  const { allAgents, isLoading } = useAgents();

  const [showSystem, setShowSystem] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(preselect ?? null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const preselectIsSystem = preselect
    ? allAgents.some(a => a.id === preselect && a.isSystemAgent)
    : false;

  const agents = (showSystem || preselectIsSystem) ? allAgents : allAgents.filter(a => !a.isSystemAgent);

  const effectiveSelectedId = (selectedId && agents.some(a => a.id === selectedId))
    ? selectedId
    : agents[0]?.id ?? null;

  const selected = agents.find(a => a.id === effectiveSelectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    next.delete('tool');
    setSearchParams(next, { replace: true });
  };

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
          <EmptyState title="No agents yet" description="Agents are auto-created when traces are captured." />
        </div>
      )}

      {(isLoading || allAgents.length > 0) && (
        <div
          className="fade-up flex-1 min-h-0 grid gap-4 grid-cols-[minmax(260px,300px)_minmax(0,1fr)] [animation-delay:20ms]"
        >
          <aside className="min-h-0 flex flex-col">
            <AgentList
              agents={agents}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
              isLoading={isLoading}
              showSystem={showSystem}
              onToggleSystem={hasSystemAgents ? () => setShowSystem(v => !v) : undefined}
            />
          </aside>

          <main className="min-w-0 min-h-0 overflow-y-auto pr-1 pb-6">
            {selected ? (
              <AgentDetail
                key={selected.id}
                agent={selected}
                onDelete={() => setDeleteOpen(true)}
                highlightTool={highlightTool}
              />
            ) : !isLoading ? (
              <div className="text-center py-12 text-body text-muted">Select an agent to view details.</div>
            ) : null}
          </main>
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
