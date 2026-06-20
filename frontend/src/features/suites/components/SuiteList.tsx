import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import type { TestSuiteListItemDto } from '../../../api/models';
import { ListRail } from '../../../components/ui/ListRail';
import { FilterDropdown, type FilterDropdownOption } from '../../../components/ui/FilterDropdown';
import { EmptyState } from '../../../components/ui/EmptyState';
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

/** Left column of the Suites master–detail, built on the shared `ListRail`: New-suite action,
 * agent filter, name search, and the selectable suite cards. The page stays orchestration. */
export function SuiteList({ suites, isLoading, selectedId, highlightId, onSelect, onDelete, onNew, agentFilter }: Props) {
  const { t } = useLingui();
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q ? suites.filter(s => s.name.toLowerCase().includes(q)) : suites;

  return (
    <ListRail
      // eslint-disable-next-line lingui/no-unlocalized-strings -- data-testid value, not UI copy
      listTestId="suite-list"
      title={t`Test suites`}
      count={suites.length}
      create={{ onClick: onNew, label: t`New suite`, testId: 'suite-create-btn' }}
      search={{ value: search, onChange: setSearch, placeholder: t`Search suites…` }}
      filter={
        <FilterDropdown
          label={t`Agent`}
          value={agentFilter.value}
          options={agentFilter.options}
          onChange={agentFilter.onChange}
          active={!!agentFilter.value}
          accent={agentFilter.accent}
          size="sm"
          width={220}
        />
      }
      loading={isLoading}
      isEmpty={filtered.length === 0}
      empty={
        <div data-testid="suite-empty-state">
          <EmptyState
            title={suites.length === 0 ? t`No test suites yet` : t`No matches`}
            description={suites.length === 0 ? t`Create one to start evaluating.` : t`Clear the search to see all suites.`}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-1.5">
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
    </ListRail>
  );
}
