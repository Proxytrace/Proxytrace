import { Trans, useLingui } from '@lingui/react/macro';
import type { TestRunGroupListItemDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { FOCUS_RING } from '../../../lib/constants';
import { ListRail } from '../../../components/ui/ListRail';
import { FilterDropdown, type FilterDropdownOption } from '../../../components/ui/FilterDropdown';
import { EmptyState } from '../../../components/ui/EmptyState';
import { GroupListCard } from './GroupListCard';

interface Props {
  groups: TestRunGroupListItemDto[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  agentFilter: { value: string; options: FilterDropdownOption[]; accent?: string; onChange: (v: string) => void };
  showSystem: boolean;
  onToggleSystem: () => void;
}

/** Left column of the Runs master–detail, built on the shared `ListRail`. Runs are not created
 * here (no create action) and aren't searched — both header slots collapse; the filter band holds
 * the agent filter + the A/B-runs toggle. The page owns the Runs/Scheduled tabs above this. */
export function RunList({ groups, isLoading, selectedId, onSelect, onDelete, agentFilter, showSystem, onToggleSystem }: Props) {
  const { t } = useLingui();
  return (
    <ListRail
      // eslint-disable-next-line lingui/no-unlocalized-strings -- test id, not UI copy
      listTestId="run-list"
      title={t`Runs`}
      count={groups.length}
      filter={
        <div className="flex items-center gap-2">
          <FilterDropdown
            label={t`Agent`}
            value={agentFilter.value}
            options={agentFilter.options}
            onChange={agentFilter.onChange}
            active={!!agentFilter.value}
            accent={agentFilter.accent}
            size="sm"
            width={240}
          />
          {/* eslint-disable-next-line no-restricted-syntax -- single bespoke filter toggle pill */}
          <button
            type="button"
            onClick={onToggleSystem}
            aria-pressed={showSystem}
            title={t`Show ephemeral A/B validation runs`}
            className={cn(
              'shrink-0 rounded-md px-2.5 py-1 text-body-sm font-medium cursor-pointer transition-colors duration-[var(--motion-fast)]',
              FOCUS_RING,
              showSystem ? 'bg-accent-subtle text-accent' : 'bg-card-2 text-muted hover:text-secondary',
            )}
          >
            <Trans>A/B runs</Trans>
          </button>
        </div>
      }
      loading={isLoading}
      skeletonHeight={110}
      isEmpty={groups.length === 0}
      empty={<EmptyState title={t`No test runs yet`} description={t`Run a suite to get started.`} />}
    >
      <div className="flex flex-col gap-2">
        {groups.map(group => (
          <GroupListCard
            key={group.id}
            group={group}
            isSelected={selectedId === group.id}
            onSelect={() => onSelect(group.id)}
            onDelete={() => onDelete(group.id)}
          />
        ))}
      </div>
    </ListRail>
  );
}
