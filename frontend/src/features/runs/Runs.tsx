import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../api/test-run-groups';
import { agentsApi } from '../../api/agents';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import { agentColor } from '../../lib/colors';
import { REFETCH_INTERVAL_LIVE, LIST_PAGE_SIZE } from '../../lib/constants';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { Card } from '../../components/ui/Card';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { GroupListCard } from './components/GroupListCard';
import { GroupDetail } from './GroupDetail';

export default function Runs() {
  const qc = useQueryClient();
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;
  const [agentFilter, setAgentFilter] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.testRunGroups(agentFilter, projectId),
    queryFn: () => testRunGroupsApi.list({ agentId: agentFilter || undefined, projectId: agentFilter ? undefined : projectId, pageSize: 100 }),
    refetchInterval: REFETCH_INTERVAL_LIVE,
    enabled,
  });
  const { data: agentsData } = useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: LIST_PAGE_SIZE }),
    enabled,
  });

  const groups = data?.items ?? [];
  const agents = agentsData?.items ?? [];

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? groups[0] ?? null;
  const agentOptions = [
    { key: '', label: 'All agents' },
    ...agents.map(a => ({ key: a.id, label: a.name, accent: agentColor(a.id) })),
  ];

  const deleteTarget = groups.find(g => g.id === deleteGroupId);

  const delGroup = useMutation({
    mutationFn: (id: string) => testRunGroupsApi.delete(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunGroupsRoot });
      setDeleteGroupId(null);
      if (id === selectedGroupId) setSelectedGroupId(null);
    },
  });

  return (
    <div className="w-full min-w-0 flex flex-col gap-3.5">
      <div className="fade-up grid gap-3.5 items-start grid-cols-[280px_1fr] [animation-delay:40ms]">
        {/* Left: group list */}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex">
            <FilterDropdown
              label="Agent"
              value={agentFilter}
              options={agentOptions}
              onChange={setAgentFilter}
              active={agentFilter !== ''}
              accent={agentFilter ? agentColor(agentFilter) : undefined}
              width={240}
            />
          </div>

          {isLoading && <SkeletonList rows={5} height={110} gap={8} />}

          {groups.map(group => (
            <GroupListCard
              key={group.id}
              group={group}
              isSelected={selectedGroup?.id === group.id}
              onSelect={() => setSelectedGroupId(group.id)}
              onDelete={() => setDeleteGroupId(group.id)}
            />
          ))}

          {!isLoading && groups.length === 0 && (
            <EmptyState title="No test runs yet" description="Run a suite to get started." />
          )}
        </div>

        {/* Right: detail */}
        <div className="min-w-0">
          {selectedGroup
            ? <GroupDetail key={selectedGroup.id} group={selectedGroup} onDelete={() => setDeleteGroupId(selectedGroup.id)} />
            : <Card><div className="py-[60px] text-center text-muted text-body">Select a run to see details.</div></Card>
          }
        </div>
      </div>

      {deleteGroupId && deleteTarget && (
        <ConfirmDialog entityName={deleteTarget.suiteName} onConfirm={() => delGroup.mutate(deleteGroupId)} onCancel={() => setDeleteGroupId(null)} loading={delGroup.isPending} />
      )}
    </div>
  );
}
