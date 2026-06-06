import { useState } from 'react';
import { agentColor } from '../../lib/colors';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { Card } from '../../components/ui/Card';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { GroupListCard } from './components/GroupListCard';
import { GroupDetail } from './GroupDetail';
import { useTestRunGroups } from './hooks/useTestRunGroups';
import { useProjectAgents } from './hooks/useProjectAgents';
import { useDeleteTestRunGroup } from './hooks/useDeleteTestRunGroup';

export default function Runs() {
  const [agentFilter, setAgentFilter] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const { groups, isLoading } = useTestRunGroups(agentFilter);
  const { agents } = useProjectAgents();
  const delGroup = useDeleteTestRunGroup();

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? groups[0] ?? null;
  const agentOptions = [
    { key: '', label: 'All agents' },
    ...agents.map(a => ({ key: a.id, label: a.name, accent: agentColor(a.id) })),
  ];

  const deleteTarget = groups.find(g => g.id === deleteGroupId);

  const confirmDelete = () => {
    if (!deleteGroupId) return;
    const id = deleteGroupId;
    delGroup.mutate(id, {
      onSuccess: () => {
        setDeleteGroupId(null);
        if (id === selectedGroupId) setSelectedGroupId(null);
      },
    });
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-3.5 px-1 pt-1 flex-1 min-h-0">
      <div className="fade-up grid gap-4 grid-cols-[280px_1fr] [animation-delay:40ms] flex-1 min-h-0">
        {/* Left: group list — scrolls independently of the detail panel */}
        <div className="flex flex-col gap-2 min-w-0 min-h-0 overflow-y-auto pr-1 -mr-1">
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
        <div className="min-w-0 min-h-0">
          {selectedGroup
            ? <GroupDetail key={selectedGroup.id} group={selectedGroup} onDelete={() => setDeleteGroupId(selectedGroup.id)} />
            : <Card><div className="py-[60px] text-center text-muted text-body">Select a run to see details.</div></Card>
          }
        </div>
      </div>

      {deleteGroupId && deleteTarget && (
        <ConfirmDialog entityName={deleteTarget.suiteName} onConfirm={confirmDelete} onCancel={() => setDeleteGroupId(null)} loading={delGroup.isPending} />
      )}
    </div>
  );
}
