import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { agentsApi } from '../../api/agents';
import { QUERY_KEYS } from '../../api/query-keys';
import { useCurrentProject } from '../../contexts/ProjectContext';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { LIST_PAGE_SIZE } from '../../lib/constants';
import { AgentList } from './AgentList';
import { AgentDetail } from './AgentDetail';

export default function Agents() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
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

  const agents = useMemo(
    () => showSystem ? allAgents : allAgents.filter(a => !a.isSystemAgent),
    [allAgents, showSystem],
  );

  // If preselected agent is a system agent, auto-enable system visibility.
  useEffect(() => {
    if (preselect && allAgents.some(a => a.id === preselect && a.isSystemAgent)) {
      setShowSystem(true);
    }
  }, [preselect, allAgents]);

  useEffect(() => {
    if (selectedId && agents.some(a => a.id === selectedId)) return;
    if (agents.length > 0) setSelectedId(agents[0].id);
    else setSelectedId(null);
  }, [agents, selectedId]);

  const selected = agents.find(a => a.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    next.delete('tool');
    setSearchParams(next, { replace: true });
  };

  const delAgent = useMutation({
    mutationFn: () => agentsApi.delete(selected!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.agents(currentProjectId ?? undefined) });
      const remaining = agents.filter(a => a.id !== selected!.id);
      setSelectedId(remaining[0]?.id ?? null);
      setDeleteOpen(false);
    },
    onError: (err) => toast((err as Error).message || 'Failed to delete agent', 'error'),
  });

  const hasSystemAgents = allAgents.some(a => a.isSystemAgent);
  const isEmpty = !isLoading && allAgents.length === 0;

  return (
    <div className="w-full max-w-[1480px] mx-auto min-w-0 flex flex-col gap-3 h-full overflow-hidden">
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
          onConfirm={() => delAgent.mutate()}
          onCancel={() => setDeleteOpen(false)}
          loading={delAgent.isPending}
        />
      )}
    </div>
  );
}
