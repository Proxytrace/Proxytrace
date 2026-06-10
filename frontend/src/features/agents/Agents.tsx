import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { useSelectedId } from '../../hooks/useSelectedId';
import { AgentList } from './AgentList';
import { AgentDetail } from './AgentDetail';
import { useAgents, useAgentDetail, useDeleteAgent } from './hooks/useAgents';

export default function Agents() {
  // Selection lives in ?id= (survives refresh); ?tool= is a transient deep-link from a trace.
  const [selectedId, setSelectedId] = useSelectedId();
  const [searchParams] = useSearchParams();
  const highlightTool = searchParams.get('tool');

  const { allAgents, isLoading } = useAgents();

  const [showSystem, setShowSystem] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selectedIsSystem = selectedId
    ? allAgents.some(a => a.id === selectedId && a.isSystemAgent)
    : false;

  const agents = (showSystem || selectedIsSystem) ? allAgents : allAgents.filter(a => !a.isSystemAgent);

  const effectiveSelectedId = (selectedId && agents.some(a => a.id === selectedId))
    ? selectedId
    : agents[0]?.id ?? null;

  const selected = agents.find(a => a.id === effectiveSelectedId) ?? null;
  // The list rows are light; the detail panel needs the full agent (system message, tools, params).
  const { agent: selectedAgent } = useAgentDetail(selected?.id ?? null);

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
            {selected && selectedAgent ? (
              <AgentDetail
                key={selectedAgent.id}
                agent={selectedAgent}
                onDelete={() => setDeleteOpen(true)}
                highlightTool={highlightTool}
              />
            ) : selected ? (
              <div className="text-center py-12 text-body text-muted">Loading agent…</div>
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
