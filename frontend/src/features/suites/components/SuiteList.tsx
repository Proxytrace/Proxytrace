import { useState } from 'react';
import type { TestSuiteListItemDto } from '../../../api/models';
import { Button, IconButton } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { FilterDropdown, type FilterDropdownOption } from '../../../components/ui/FilterDropdown';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { PlusIcon, SearchLineIcon, XIcon } from '../../../components/icons';
import { SuiteListCard } from './SuiteListCard';

interface Props {
  suites: TestSuiteListItemDto[];
  isLoading: boolean;
  selectedId: string | null;
  highlightId: string | null;
  onSelect: (id: string) => void;
  onDelete: (suite: TestSuiteListItemDto) => void;
  onNew: () => void;
  agentFilter: { value: string; options: FilterDropdownOption[]; accent?: string; onChange: (v: string) => void };
}

/** Left column of the Suites master–detail: New-suite action, agent filter, name search, and the
 * selectable suite cards. Self-contained like `AgentList` / `EvalRail` — the page stays orchestration. */
export function SuiteList({ suites, isLoading, selectedId, highlightId, onSelect, onDelete, onNew, agentFilter }: Props) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q ? suites.filter(s => s.name.toLowerCase().includes(q)) : suites;

  return (
    <div className="flex flex-col gap-2.5 min-h-0">
      <Button
        variant="primary"
        size="sm"
        fullWidth
        data-testid="suite-create-btn"
        leftIcon={<PlusIcon size={12} />}
        onClick={onNew}
      >
        New suite
      </Button>

      <div className="flex items-center gap-2">
        <FilterDropdown
          label="Agent"
          value={agentFilter.value}
          options={agentFilter.options}
          onChange={agentFilter.onChange}
          active={!!agentFilter.value}
          accent={agentFilter.accent}
          width={220}
        />
        <span className="text-caption text-muted shrink-0">
          {suites.length} suite{suites.length !== 1 ? 's' : ''}
        </span>
      </div>

      <Input
        leftAddon={<SearchLineIcon size={12} />}
        inputSize="sm"
        rightAddon={search ? (
          <IconButton size="sm" onClick={() => setSearch('')} aria-label="Clear search"><XIcon size={12} /></IconButton>
        ) : undefined}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search suites…"
      />

      <div data-testid="suite-list" className="flex-1 min-h-0 overflow-y-auto pr-[2px] flex flex-col gap-1.5">
        {isLoading && <SkeletonList rows={6} height={84} gap={6} />}
        {!isLoading && filtered.length === 0 && (
          <div data-testid="suite-empty-state">
            <EmptyState
              title={suites.length === 0 ? 'No test suites yet' : 'No matches'}
              description={suites.length === 0 ? 'Create one to start evaluating.' : 'Clear the search to see all suites.'}
            />
          </div>
        )}
        {filtered.map(suite => (
          <SuiteListCard
            key={suite.id}
            suite={suite}
            selected={selectedId === suite.id}
            highlight={highlightId === suite.id}
            onSelect={() => onSelect(suite.id)}
            onDelete={() => onDelete(suite)}
          />
        ))}
      </div>
    </div>
  );
}
