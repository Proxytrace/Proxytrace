import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { agentsApi } from '../../api/agents';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { LIST_PAGE_SIZE } from '../../lib/constants';
import { AgentList } from './AgentList';
import { AgentDetail } from './AgentDetail';

export default function Agents() {
  const qc = useQueryClient();
  const { currentProjectId } = useCurrentProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const preselect = searchParams.get('id');
  const highlightTool = searchParams.get('tool');

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.agents(currentProjectId ?? undefined),
    queryFn: () => agentsApi.list({ projectId: currentProjectId ?? undefined, pageSize: LIST_PAGE_SIZE }),
    enabled: currentProjectId !== null,
  });
  const allAgents = data?.items ?? [];

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

  const delAgent = useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: (_result, id) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.agents(currentProjectId ?? undefined) });
      const remaining = agents.filter(a => a.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
      setDeleteOpen(false);
    },
  });

  const hasSystemAgents = allAgents.some(a => a.isSystemAgent);
  const isEmpty = !isLoading && allAgents.length === 0;

  return (
    <div className="w-full min-w-0 flex flex-col gap-3 h-full overflow-hidden">
      {isEmpty && (
        <EmptyState title="No agents found" description="Agents are auto-created when traces are captured." />
      )}

      {(isLoading || allAgents.length > 0) && (
        <div
          className="fade-up flex-1 min-h-0 grid gap-4"
          style={{ gridTemplateColumns: 'minmax(260px, 300px) minmax(0, 1fr)', animationDelay: '20ms' }}
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
